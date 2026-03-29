/// Track B — Switchboard On-Demand
///
/// 흐름:
///   1. getProgramAccounts로 Active(state=3) Policy 목록 조회
///   2. Switchboard Crossbar API에서 오라클 업데이트(Ed25519 서명) 수신
///   3. [Ed25519 ix, verified_update ix, check_oracle_and_create_claim ix] 트랜잭션 전송
use anyhow::{Context, Result};
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signer::Signer,
    sysvar,
};

use crate::{
    config::Config,
    oracle::track_a::anchor_instruction_discriminator,
    solana::{client::SolanaClient, pda::claim_pda, POLICY_STATE_ACTIVE},
    switchboard,
};

/// Policy 계정에서 읽어낸 최소 정보
#[derive(Debug)]
pub struct PolicyInfo {
    pub pubkey: Pubkey,
    pub policy_id: u64,
    pub leader: Pubkey,
    pub flight_no: String,
    pub departure_date: i64,
    pub oracle_feed: Pubkey,
    pub state: u8,
}

/// Active 상태 Policy 목록을 온체인에서 조회한다.
pub fn scan_policies(
    client: &SolanaClient,
    program_id: &Pubkey,
) -> Result<Vec<PolicyInfo>> {
    let accounts = client
        .rpc
        .get_program_accounts(program_id)
        .context("Policy getProgramAccounts 실패")?;

    let mut result = Vec::new();
    for (pubkey, account) in accounts {
        if account.data.len() < 8 {
            continue;
        }
        // discriminator 확인 (sha256("account:Policy")[..8])
        let disc = crate::oracle::track_a::anchor_account_discriminator("Policy");
        if account.data[..8] != disc {
            continue;
        }
        match parse_policy(&pubkey, &account.data) {
            Ok(info) => result.push(info),
            Err(e) => {
                tracing::warn!("[track_b] Policy 파싱 실패 {pubkey}: {e}");
            }
        }
    }
    Ok(result)
}

/// Active 상태이며 leader가 일치하는 Policy 목록을 온체인에서 조회한다.
pub fn scan_active_policies(
    client: &SolanaClient,
    program_id: &Pubkey,
    leader_pubkey: &Pubkey,
) -> Result<Vec<PolicyInfo>> {
    let policies = scan_policies(client, program_id)?;
    Ok(policies
        .into_iter()
        .filter(|info| info.state == POLICY_STATE_ACTIVE && info.leader == *leader_pubkey)
        .collect())
}

/// Policy 계정 데이터를 역직렬화한다 (borsh 레이아웃).
///
/// Policy 필드 순서 (state.rs 기준):
///   discriminator[8], policy_id[8], leader[32], route[4+len], flight_no[4+len],
///   departure_date[8], delay_threshold_min[2], payout_amount[8],
///   currency_mint[32], oracle_feed[32], state[1], ...
fn parse_policy(pubkey: &Pubkey, data: &[u8]) -> Result<PolicyInfo> {
    use crate::oracle::track_a::{
        read_i64, read_pubkey, read_string, read_u16, read_u64, read_u8,
    };
    let mut offset = 8usize; // skip discriminator

    let policy_id = read_u64(data, &mut offset)?;
    let leader = read_pubkey(data, &mut offset)?;
    let _route = read_string(data, &mut offset)?;
    let flight_no = read_string(data, &mut offset)?;
    let departure_date = read_i64(data, &mut offset)?;
    let _delay_threshold = read_u16(data, &mut offset)?;
    let _payout_amount = read_u64(data, &mut offset)?;
    let _currency_mint = read_pubkey(data, &mut offset)?;
    let oracle_feed = read_pubkey(data, &mut offset)?;
    let state = read_u8(data, &mut offset)?;

    Ok(PolicyInfo {
        pubkey: *pubkey,
        policy_id,
        leader,
        flight_no,
        departure_date,
        oracle_feed,
        state,
    })
}

/// Track B 오라클 실행: Switchboard Crossbar 조회 → check_oracle_and_create_claim 전송
pub async fn run(
    config: &Config,
    client: &SolanaClient,
    leader: &solana_sdk::signature::Keypair,
    policy: &PolicyInfo,
) -> Result<()> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_secs() as i64;

    // 출발 예정 시각 이전이면 스킵
    if now < policy.departure_date {
        tracing::info!(
            "[track_b] {} 아직 출발 전 (departure_ts={}), 스킵",
            policy.flight_no,
            policy.departure_date
        );
        return Ok(());
    }

    tracing::info!(
        "[track_b] {} 오라클 조회 시작 (Policy={})",
        policy.flight_no,
        policy.pubkey
    );

    // Switchboard Crossbar에서 서명된 oracle update 수신
    let oracle_update =
        switchboard::fetch_oracle_update(&config.switchboard_queue, &policy.oracle_feed, &client.rpc)
            .await
            .context("Switchboard oracle update 수신 실패")?;

    tracing::info!(
        "[track_b] {} oracle 값: {}분",
        policy.flight_no,
        oracle_update.value
    );

    // oracle_round = 현재 슬롯 (Claim PDA seed로 사용)
    let oracle_round = client.get_slot()?;
    let (claim_key, _) = claim_pda(&config.program_id, &policy.pubkey, oracle_round);

    // check_oracle_and_create_claim instruction 빌드
    let our_ix = build_check_oracle_ix(
        &config.program_id,
        &policy.pubkey,
        &claim_key,
        &leader.pubkey(),
        &policy.oracle_feed,
        &config.switchboard_queue,
        oracle_round,
    )?;

    // 트랜잭션 순서 필수: [Ed25519, verified_update, our ix]
    let instructions = vec![
        oracle_update.ed25519_ix,
        oracle_update.verified_update_ix,
        our_ix,
    ];

    let sig = client
        .send_v0_transaction(instructions, &oracle_update.luts, leader)
        .context("check_oracle_and_create_claim 트랜잭션 실패")?;

    tracing::info!(
        "[track_b] {} check_oracle_and_create_claim 완료. tx={}",
        policy.flight_no,
        sig
    );
    Ok(())
}

/// check_oracle_and_create_claim instruction을 수동으로 빌드한다.
fn build_check_oracle_ix(
    program_id: &Pubkey,
    policy: &Pubkey,
    claim: &Pubkey,
    payer: &Pubkey,
    oracle_feed: &Pubkey,
    queue: &Pubkey,
    oracle_round: u64,
) -> Result<Instruction> {
    let discriminator =
        anchor_instruction_discriminator("check_oracle_and_create_claim");

    // args: oracle_round (u64 LE)
    let mut data = discriminator.to_vec();
    data.extend_from_slice(&oracle_round.to_le_bytes());

    // Switchboard sysvar 주소 (devnet 상수)
    // slot_hashes sysvar: SysvarS1otHashes111111111111111111111111111
    // instructions sysvar: Sysvar1nstructions1111111111111111111111111
    let slot_hashes_sysvar = sysvar::slot_hashes::id();
    let instructions_sysvar = sysvar::instructions::id();

    Ok(Instruction {
        program_id: *program_id,
        accounts: vec![
            AccountMeta::new(*policy, false),
            AccountMeta::new(*claim, false),
            AccountMeta::new(*payer, true),
            AccountMeta::new_readonly(*oracle_feed, false),
            AccountMeta::new_readonly(*queue, false),
            AccountMeta::new_readonly(slot_hashes_sysvar, false),
            AccountMeta::new_readonly(instructions_sysvar, false),
            AccountMeta::new_readonly(solana_sdk::system_program::id(), false),
        ],
        data,
    })
}

#[cfg(test)]
mod tests {
    use super::{scan_active_policies, scan_policies};
    use crate::solana::client::SolanaClient;
    use solana_sdk::pubkey::Pubkey;
    use std::{str::FromStr, sync::Once};

    static LOAD_TEST_ENV: Once = Once::new();

    fn load_test_env() {
        LOAD_TEST_ENV.call_once(|| {
            dotenv::dotenv().ok();
            dotenv::from_filename("../.env").ok();
        });
    }

    fn env_pubkey(key: &str) -> Pubkey {
        load_test_env();
        let value = std::env::var(key)
            .unwrap_or_else(|_| panic!("{key} 환경변수가 필요합니다"));
        Pubkey::from_str(&value)
            .unwrap_or_else(|err| panic!("{key} 파싱 실패: {value} ({err})"))
    }

    fn rpc_url() -> String {
        load_test_env();
        std::env::var("RPC_URL").unwrap_or_else(|_| "https://api.devnet.solana.com".to_string())
    }

    #[test]
    #[ignore = "실제 Solana RPC와 PROGRAM_ID 환경변수가 필요합니다. `cargo test scan_policies_prints_results -- --ignored --nocapture`로 실행하세요."]
    fn scan_policies_prints_results() {
        let client = SolanaClient::new(&rpc_url());
        let program_id = env_pubkey("PROGRAM_ID");

        let policies =
            scan_policies(&client, &program_id).expect("policies should be fetched from RPC");

        println!(
            "[scan_policies_prints_results] program_id={} matched_policies={}",
            program_id,
            policies.len()
        );

        for policy in &policies {
            println!(
                "[scan_policies_prints_results] policy_pubkey={} policy_id={} leader={} flight_no={} departure_date={} oracle_feed={} state={}",
                policy.pubkey,
                policy.policy_id,
                policy.leader,
                policy.flight_no,
                policy.departure_date,
                policy.oracle_feed,
                policy.state
            );
        }
    }

    #[test]
    #[ignore = "실제 Solana RPC와 PROGRAM_ID/LEADER_PUBKEY 환경변수가 필요합니다. `cargo test scan_active_policies_prints_results -- --ignored --nocapture`로 실행하세요."]
    fn scan_active_policies_prints_results() {
        let client = SolanaClient::new(&rpc_url());
        let program_id = env_pubkey("PROGRAM_ID");
        let leader_pubkey = env_pubkey("LEADER_PUBKEY");

        let policies = scan_active_policies(&client, &program_id, &leader_pubkey)
            .expect("active policies should be fetched from RPC");

        println!(
            "[scan_active_policies_prints_results] program_id={} leader_pubkey={} matched_policies={}",
            program_id,
            leader_pubkey,
            policies.len()
        );

        for policy in &policies {
            println!(
                "[scan_active_policies_prints_results] policy_pubkey={} policy_id={} flight_no={} departure_date={} oracle_feed={} state={}",
                policy.pubkey,
                policy.policy_id,
                policy.flight_no,
                policy.departure_date,
                policy.oracle_feed,
                policy.state
            );
        }
    }
}
