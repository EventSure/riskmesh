/// Track B — Switchboard On-Demand
///
/// 흐름:
///   1. getProgramAccounts로 Active(state=3) Policy 목록 조회
///   2. Switchboard Crossbar API에서 오라클 업데이트(Ed25519 서명) 수신
///   3. [Ed25519 ix, verified_update ix, check_oracle_and_create_claim ix] 트랜잭션 전송
///   4. oracle 값 >= 120분이면 approve_claim → settle_claim 자동 실행
use anyhow::{Context, Result};
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signer::Signer,
    sysvar,
};

use crate::{
    config::Config,
    oracle::track_a::{
        anchor_instruction_discriminator, read_i64, read_pubkey, read_string, read_u16, read_u64,
        read_u8,
    },
    solana::{
        client::SolanaClient,
        pda::{claim_pda, get_associated_token_address, risk_pool_pda},
        POLICY_STATE_ACTIVE,
    },
    switchboard,
};

const DELAY_THRESHOLD_MIN: i64 = 120;
const SPL_TOKEN_PROGRAM: Pubkey = solana_sdk::pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

// ─── 데이터 구조체 ──────────────────────────────────────────────────────────────

/// Policy 계정에서 읽어낸 최소 정보
#[derive(Debug)]
pub struct PolicyInfo {
    pub pubkey: Pubkey,
    pub policy_id: u64,
    pub leader: Pubkey,
    pub flight_no: String,
    pub departure_date: i64,
    pub oracle_feed: Pubkey,
    pub currency_mint: Pubkey,
    pub state: u8,
}

// ─── 스캔 ───────────────────────────────────────────────────────────────────────

/// Active 상태 Policy 목록을 온체인에서 조회한다.
pub fn scan_active_policies(
    client: &SolanaClient,
    program_id: &Pubkey,
    leader_pubkey: &Pubkey,
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
        let disc = crate::oracle::track_a::anchor_account_discriminator("Policy");
        if account.data[..8] != disc {
            continue;
        }
        match parse_policy(&pubkey, &account.data) {
            Ok(info)
                if info.state == POLICY_STATE_ACTIVE && info.leader == *leader_pubkey =>
            {
                result.push(info);
            }
            Ok(_) => {}
            Err(e) => {
                tracing::warn!("[track_b] Policy 파싱 실패 {pubkey}: {e}");
            }
        }
    }
    Ok(result)
}

// ─── 메인 실행 ─────────────────────────────────────────────────────────────────

/// Track B 오라클 실행: Switchboard Crossbar 조회 → check_oracle_and_create_claim
/// oracle 값 >= 임계치이면 approve_claim → settle_claim 자동 실행
pub async fn run(
    config: &Config,
    client: &SolanaClient,
    leader: &solana_sdk::signature::Keypair,
    policy: &PolicyInfo,
) -> Result<()> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_secs() as i64;

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

    let oracle_update =
        switchboard::fetch_oracle_update(&config.switchboard_queue, &policy.oracle_feed, &client.rpc)
            .await
            .context("Switchboard oracle update 수신 실패")?;

    tracing::info!(
        "[track_b] {} oracle 값: {}분",
        policy.flight_no,
        oracle_update.value
    );

    let oracle_round = client.get_slot()?;
    let (claim_key, _) = claim_pda(&config.program_id, &policy.pubkey, oracle_round);

    let our_ix = build_check_oracle_ix(
        &config.program_id,
        &policy.pubkey,
        &claim_key,
        &leader.pubkey(),
        &policy.oracle_feed,
        &config.switchboard_queue,
        oracle_round,
    )?;

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

    // oracle 값이 임계치 이상이면 Claim이 생성됨 → approve + settle
    let oracle_minutes = oracle_update.value as i64;
    if oracle_minutes >= DELAY_THRESHOLD_MIN {
        if let Err(e) = approve_and_settle(config, client, leader, policy, &claim_key) {
            tracing::error!(
                "[track_b] {} approve/settle 실패: {e:#}",
                policy.flight_no
            );
        }
    } else {
        tracing::info!(
            "[track_b] {} oracle={}분 < {}분 (임계치), 지급 없음",
            policy.flight_no,
            oracle_minutes,
            DELAY_THRESHOLD_MIN
        );
    }

    Ok(())
}

// ─── approve + settle ──────────────────────────────────────────────────────────

fn approve_and_settle(
    config: &Config,
    client: &SolanaClient,
    leader: &solana_sdk::signature::Keypair,
    policy: &PolicyInfo,
    claim_key: &Pubkey,
) -> Result<()> {
    // approve_claim
    let approve_ix = build_approve_claim_ix(
        &config.program_id,
        &policy.pubkey,
        &leader.pubkey(),
        claim_key,
    )?;
    let sig = client
        .send_transaction(&[approve_ix], leader)
        .context("approve_claim 트랜잭션 실패")?;
    tracing::info!(
        "[track_b] {} approve_claim 완료. tx={}",
        policy.flight_no,
        sig
    );

    // RiskPool 조회 → vault 주소
    let (risk_pool_key, _) = risk_pool_pda(&config.program_id, &policy.pubkey);
    let risk_pool_account = client
        .get_account(&risk_pool_key)
        .context("RiskPool 계정 조회 실패")?;
    let vault = parse_risk_pool_vault(&risk_pool_account.data)
        .context("RiskPool vault 파싱 실패")?;

    // beneficiary = leader의 ATA (currency_mint 기준)
    let beneficiary_token = get_associated_token_address(&leader.pubkey(), &policy.currency_mint);

    // settle_claim
    let settle_ix = build_settle_claim_ix(
        &config.program_id,
        &policy.pubkey,
        &leader.pubkey(),
        claim_key,
        &risk_pool_key,
        &vault,
        &beneficiary_token,
    )?;
    let sig = client
        .send_transaction(&[settle_ix], leader)
        .context("settle_claim 트랜잭션 실패")?;
    tracing::info!(
        "[track_b] {} settle_claim 완료. tx={}",
        policy.flight_no,
        sig
    );

    Ok(())
}

// ─── Instruction 빌더 ──────────────────────────────────────────────────────────

fn build_check_oracle_ix(
    program_id: &Pubkey,
    policy: &Pubkey,
    claim: &Pubkey,
    payer: &Pubkey,
    oracle_feed: &Pubkey,
    queue: &Pubkey,
    oracle_round: u64,
) -> Result<Instruction> {
    let discriminator = anchor_instruction_discriminator("check_oracle_and_create_claim");
    let mut data = discriminator.to_vec();
    data.extend_from_slice(&oracle_round.to_le_bytes());

    Ok(Instruction {
        program_id: *program_id,
        accounts: vec![
            AccountMeta::new(*policy, false),
            AccountMeta::new(*claim, false),
            AccountMeta::new(*payer, true),
            AccountMeta::new_readonly(*oracle_feed, false),
            AccountMeta::new_readonly(*queue, false),
            AccountMeta::new_readonly(sysvar::slot_hashes::id(), false),
            AccountMeta::new_readonly(sysvar::instructions::id(), false),
            AccountMeta::new_readonly(solana_sdk::system_program::id(), false),
        ],
        data,
    })
}

/// approve_claim: policy(mut), leader(signer,ro), claim(mut)
fn build_approve_claim_ix(
    program_id: &Pubkey,
    policy: &Pubkey,
    leader: &Pubkey,
    claim: &Pubkey,
) -> Result<Instruction> {
    let discriminator = anchor_instruction_discriminator("approve_claim");
    let data = discriminator.to_vec();

    Ok(Instruction {
        program_id: *program_id,
        accounts: vec![
            AccountMeta::new(*policy, false),
            AccountMeta::new_readonly(*leader, true),
            AccountMeta::new(*claim, false),
        ],
        data,
    })
}

/// settle_claim: policy(mut), leader(signer,ro), claim(mut),
///   risk_pool(mut), vault(mut), beneficiary_token(mut), token_program(ro)
fn build_settle_claim_ix(
    program_id: &Pubkey,
    policy: &Pubkey,
    leader: &Pubkey,
    claim: &Pubkey,
    risk_pool: &Pubkey,
    vault: &Pubkey,
    beneficiary_token: &Pubkey,
) -> Result<Instruction> {
    let discriminator = anchor_instruction_discriminator("settle_claim");
    let data = discriminator.to_vec();

    Ok(Instruction {
        program_id: *program_id,
        accounts: vec![
            AccountMeta::new(*policy, false),
            AccountMeta::new_readonly(*leader, true),
            AccountMeta::new(*claim, false),
            AccountMeta::new(*risk_pool, false),
            AccountMeta::new(*vault, false),
            AccountMeta::new(*beneficiary_token, false),
            AccountMeta::new_readonly(SPL_TOKEN_PROGRAM, false),
        ],
        data,
    })
}

// ─── Policy / RiskPool 파싱 ────────────────────────────────────────────────────

/// Policy 계정 데이터를 역직렬화한다 (borsh 레이아웃).
///
/// Policy 필드 순서 (state.rs 기준):
///   discriminator[8], policy_id[8], leader[32], route[4+len], flight_no[4+len],
///   departure_date[8], delay_threshold_min[2], payout_amount[8],
///   currency_mint[32], oracle_feed[32], state[1], ...
fn parse_policy(pubkey: &Pubkey, data: &[u8]) -> Result<PolicyInfo> {
    let mut offset = 8usize; // skip discriminator

    let policy_id = read_u64(data, &mut offset)?;
    let leader = read_pubkey(data, &mut offset)?;
    let _route = read_string(data, &mut offset)?;
    let flight_no = read_string(data, &mut offset)?;
    let departure_date = read_i64(data, &mut offset)?;
    let _delay_threshold = read_u16(data, &mut offset)?;
    let _payout_amount = read_u64(data, &mut offset)?;
    let currency_mint = read_pubkey(data, &mut offset)?;
    let oracle_feed = read_pubkey(data, &mut offset)?;
    let state = read_u8(data, &mut offset)?;

    Ok(PolicyInfo {
        pubkey: *pubkey,
        policy_id,
        leader,
        flight_no,
        departure_date,
        oracle_feed,
        currency_mint,
        state,
    })
}

/// RiskPool 계정에서 vault 주소를 읽는다.
///
/// RiskPool 필드 순서:
///   discriminator[8], policy[32], currency_mint[32], vault[32], ...
fn parse_risk_pool_vault(data: &[u8]) -> Result<Pubkey> {
    let mut offset = 8; // skip discriminator
    let _policy = read_pubkey(data, &mut offset)?;
    let _currency_mint = read_pubkey(data, &mut offset)?;
    let vault = read_pubkey(data, &mut offset)?;
    Ok(vault)
}
