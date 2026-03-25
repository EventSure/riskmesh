/// Track B — Switchboard On-Demand 자동화
///
/// 흐름:
///   1. getProgramAccounts로 AwaitingOracle(1) FlightPolicy 목록 조회
///   2. FlightPolicy.master 주소로 MasterPolicy 계정 RPC 조회 → oracle_feed 추출
///   3. Switchboard Crossbar API에서 오라클 업데이트 수신
///   4. [Ed25519 ix, verified_update ix, check_oracle_and_resolve_flight ix] 트랜잭션 전송
///   5. FlightPolicy 재조회 → Claimable → settle_flight_claim, NoClaim → settle_flight_no_claim
use anyhow::{Context, Result};
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signer::Signer,
    sysvar,
};
use std::str::FromStr;

use crate::{
    config::Config,
    oracle::track_a::{
        anchor_instruction_discriminator, parse_flight_policy, read_i64, read_pubkey, read_u16,
        read_u64, read_u8, FlightPolicyInfo,
    },
    solana::{
        client::SolanaClient,
        discriminators::FLIGHT_POLICY,
        FLIGHT_POLICY_STATUS_AWAITING_ORACLE,
    },
    switchboard,
};

// FlightPolicy 상태 상수 — oracle 완료 후 settle 단계 판별용
const FLIGHT_POLICY_STATUS_CLAIMABLE: u8 = 2;
const FLIGHT_POLICY_STATUS_NO_CLAIM: u8 = 4;

/// MasterPolicy 계정에서 Track B 처리에 필요한 최소 정보
#[derive(Debug)]
struct MasterPolicyInfo {
    pub pubkey: Pubkey,
    pub oracle_feed: Pubkey,
    pub leader_deposit_wallet: Pubkey,
    pub reinsurer_pool_wallet: Pubkey,
    pub reinsurer_deposit_wallet: Pubkey,
    /// settle_flight_claim remaining_accounts 순서와 일치
    pub participant_pool_wallets: Vec<Pubkey>,
    /// settle_flight_no_claim remaining_accounts 순서와 일치
    pub participant_deposit_wallets: Vec<Pubkey>,
}

/// AwaitingOracle(1) 상태 FlightPolicy 목록을 온체인에서 조회한다.
///
/// # TODO: 고아 Claimable/NoClaim 재시도 미지원
/// `check_oracle_and_resolve_flight` 성공 후 `settle_flight_claim/no_claim`이 실패하면
/// FlightPolicy는 Claimable(2) 또는 NoClaim(4) 상태에 머문다.
/// 이 함수는 AWAITING_ORACLE만 스캔하므로 해당 flight는 다음 사이클에서도 선택되지 않는다.
/// Track A도 ISSUED/AWAITING_ORACLE만 처리하므로 수동 개입이 필요하다.
///
/// 해결 방향: scan 단계에서 Claimable/NoClaim도 포함하고 settle만 재시도하도록 분기 추가.
pub async fn scan_flight_policies(
    client: &SolanaClient,
    program_id: &Pubkey,
) -> Result<Vec<FlightPolicyInfo>> {
    // 가변 길이 필드가 앞에 있어 status 바이트 오프셋이 불확정 — 클라이언트 측에서 파싱 후 필터링
    let accounts = client
        .rpc
        .get_program_accounts(program_id)
        .context("FlightPolicy getProgramAccounts 실패")?;

    let mut result = Vec::new();
    for (pubkey, account) in accounts {
        if account.data.len() < 8 {
            continue;
        }
        if account.data[..8] != FLIGHT_POLICY {
            continue;
        }
        match parse_flight_policy(&pubkey, &account.data) {
            Ok(info) if info.status == FLIGHT_POLICY_STATUS_AWAITING_ORACLE => {
                result.push(info);
            }
            Ok(_) => {}
            Err(e) => {
                tracing::warn!("[track_b] FlightPolicy 파싱 실패 {pubkey}: {e}");
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

/// Track B 오라클 실행:
///   MasterPolicy 조회 → Switchboard oracle resolve → FlightPolicy 재조회 → auto-settle
pub async fn run(
    config: &Config,
    client: &SolanaClient,
    payer: &solana_sdk::signature::Keypair,
    flight: &FlightPolicyInfo,
) -> Result<()> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_secs() as i64;

    if now < flight.departure_ts {
        tracing::info!(
            "[track_b] {} 아직 출발 전 (departure_ts={}), 스킵",
            flight.flight_no,
            flight.departure_ts
        );
        return Ok(());
    }

    tracing::info!(
        "[track_b] {} 처리 시작 (FlightPolicy={})",
        flight.flight_no,
        flight.pubkey
    );

    // 1. MasterPolicy 계정 조회 → oracle_feed + 정산 지갑 목록 추출
    let master = fetch_master_policy(client, &flight.master_policy)
        .with_context(|| format!("MasterPolicy 조회 실패: {}", flight.master_policy))?;

    if master.oracle_feed == Pubkey::default() {
        tracing::info!(
            "[track_b] {} oracle_feed 미설정 (Track A 전용 master), 스킵",
            flight.flight_no
        );
        return Ok(());
    }

    // 2. Switchboard Crossbar에서 서명된 oracle update 수신
    let oracle_update = switchboard::fetch_oracle_update(
        &config.switchboard_queue,
        &master.oracle_feed,
        &client.rpc,
    )
    .await
    .context("Switchboard oracle update 수신 실패")?;

    tracing::info!(
        "[track_b] {} oracle 값: {}분",
        flight.flight_no,
        oracle_update.value
    );

    // 3. check_oracle_and_resolve_flight 트랜잭션 전송
    //    트랜잭션 순서 필수: [Ed25519 ix, verified_update ix, our ix]
    let our_ix = build_check_oracle_and_resolve_flight_ix(
        &config.program_id,
        &payer.pubkey(),
        &master.pubkey,
        &flight.pubkey,
        &master.oracle_feed,
        &config.switchboard_queue,
    )?;

    let instructions = vec![
        oracle_update.ed25519_ix,
        oracle_update.verified_update_ix,
        our_ix,
    ];

    let sig = client
        .send_v0_transaction(instructions, &oracle_update.luts, payer)
        .context("check_oracle_and_resolve_flight 트랜잭션 실패")?;

    tracing::info!(
        "[track_b] {} oracle resolve 완료. tx={}",
        flight.flight_no,
        sig
    );

    // 4. FlightPolicy 재조회 → Claimable/NoClaim에 따라 자동 settle
    let updated_account = client
        .get_account(&flight.pubkey)
        .with_context(|| format!("FlightPolicy 재조회 실패: {}", flight.pubkey))?;
    let updated = parse_flight_policy(&flight.pubkey, &updated_account.data)
        .context("FlightPolicy 재파싱 실패")?;

    match updated.status {
        FLIGHT_POLICY_STATUS_CLAIMABLE => {
            tracing::info!("[track_b] {} Claimable → settle_flight_claim", flight.flight_no);
            let settle_ix = build_settle_flight_claim_ix(
                &config.program_id,
                &payer.pubkey(),
                &master.pubkey,
                &flight.pubkey,
                &master.leader_deposit_wallet,
                &master.reinsurer_pool_wallet,
                &master.participant_pool_wallets,
            )?;
            let sig = client
                .send_transaction(&[settle_ix], payer)
                .context("settle_flight_claim 트랜잭션 실패")?;
            tracing::info!(
                "[track_b] {} settle_flight_claim 완료. tx={}",
                flight.flight_no,
                sig
            );
        }
        FLIGHT_POLICY_STATUS_NO_CLAIM => {
            tracing::info!("[track_b] {} NoClaim → settle_flight_no_claim", flight.flight_no);
            let settle_ix = build_settle_flight_no_claim_ix(
                &config.program_id,
                &payer.pubkey(),
                &master.pubkey,
                &flight.pubkey,
                &master.leader_deposit_wallet,
                &master.reinsurer_deposit_wallet,
                &master.participant_deposit_wallets,
            )?;
            let sig = client
                .send_transaction(&[settle_ix], payer)
                .context("settle_flight_no_claim 트랜잭션 실패")?;
            tracing::info!(
                "[track_b] {} settle_flight_no_claim 완료. tx={}",
                flight.flight_no,
                sig
            );
        }
        s => {
            tracing::warn!(
                "[track_b] {} oracle 완료 후 예상치 못한 상태: {s}, settle 스킵",
                flight.flight_no
            );
        }
    }

    Ok(())
}

// ─── MasterPolicy 파싱 ────────────────────────────────────────────────────────

/// MasterPolicy 계정을 RPC로 직접 조회해 Track B 필요 정보를 파싱한다.
fn fetch_master_policy(client: &SolanaClient, master_key: &Pubkey) -> Result<MasterPolicyInfo> {
    let account = client.get_account(master_key)?;
    parse_master_policy(master_key, &account.data)
}

/// MasterPolicy 계정 데이터를 역직렬화한다 (borsh 레이아웃).
///
/// MasterPolicy 필드 순서 (state.rs 기준):
///   discriminator[8], master_id[8], leader[32], operator[32], currency_mint[32],
///   coverage_start_ts[8], coverage_end_ts[8], premium_per_policy[8],
///   payout_delay_2h[8], payout_delay_3h[8], payout_delay_4to5h[8],
///   payout_delay_6h_or_cancelled[8], ceded_ratio_bps[2], reins_commission_bps[2],
///   reinsurer_effective_bps[2], reinsurer[32], reinsurer_confirmed[1],
///   reinsurer_pool_wallet[32], reinsurer_deposit_wallet[32], leader_deposit_wallet[32],
///   participants: Vec (u32 len [4] + n × MasterParticipant [99 each]),
///   oracle_feed[32], status[1], created_at[8], bump[1]
///
/// MasterParticipant: insurer[32] + share_bps[2] + confirmed[1] + pool_wallet[32] + deposit_wallet[32]
fn parse_master_policy(pubkey: &Pubkey, data: &[u8]) -> Result<MasterPolicyInfo> {
    let mut offset = 8usize; // skip discriminator

    let _master_id = read_u64(data, &mut offset)?;
    let _leader = read_pubkey(data, &mut offset)?;
    let _operator = read_pubkey(data, &mut offset)?;
    let _currency_mint = read_pubkey(data, &mut offset)?;
    let _coverage_start_ts = read_i64(data, &mut offset)?;
    let _coverage_end_ts = read_i64(data, &mut offset)?;
    let _premium_per_policy = read_u64(data, &mut offset)?;
    let _payout_delay_2h = read_u64(data, &mut offset)?;
    let _payout_delay_3h = read_u64(data, &mut offset)?;
    let _payout_delay_4to5h = read_u64(data, &mut offset)?;
    let _payout_delay_6h_or_cancelled = read_u64(data, &mut offset)?;
    let _ceded_ratio_bps = read_u16(data, &mut offset)?;
    let _reins_commission_bps = read_u16(data, &mut offset)?;
    let _reinsurer_effective_bps = read_u16(data, &mut offset)?;
    let _reinsurer = read_pubkey(data, &mut offset)?;
    let _reinsurer_confirmed = read_u8(data, &mut offset)?;
    let reinsurer_pool_wallet = read_pubkey(data, &mut offset)?;
    let reinsurer_deposit_wallet = read_pubkey(data, &mut offset)?;
    let leader_deposit_wallet = read_pubkey(data, &mut offset)?;

    // Vec<MasterParticipant>: borsh 직렬화는 u32 길이 접두사 + 요소 배열
    let num_participants = {
        let bytes: [u8; 4] = data[offset..offset + 4]
            .try_into()
            .context("participants 길이 읽기 실패")?;
        offset += 4;
        u32::from_le_bytes(bytes) as usize
    };

    let mut participant_pool_wallets = Vec::with_capacity(num_participants);
    let mut participant_deposit_wallets = Vec::with_capacity(num_participants);

    for _ in 0..num_participants {
        let _insurer = read_pubkey(data, &mut offset)?;
        let _share_bps = read_u16(data, &mut offset)?;
        let _confirmed = read_u8(data, &mut offset)?;
        let pool_wallet = read_pubkey(data, &mut offset)?;
        let deposit_wallet = read_pubkey(data, &mut offset)?;
        participant_pool_wallets.push(pool_wallet);
        participant_deposit_wallets.push(deposit_wallet);
    }

    let oracle_feed = read_pubkey(data, &mut offset)?;

    Ok(MasterPolicyInfo {
        pubkey: *pubkey,
        oracle_feed,
        leader_deposit_wallet,
        reinsurer_pool_wallet,
        reinsurer_deposit_wallet,
        participant_pool_wallets,
        participant_deposit_wallets,
    })
}

// ─── Instruction 빌더 ─────────────────────────────────────────────────────────

/// check_oracle_and_resolve_flight instruction을 빌드한다 (인자 없음).
///
/// 계정 순서 (check_oracle_and_resolve_flight.rs Accounts 구조체 기준):
///   [0] payer        (signer, mut)
///   [1] master_policy (readonly)
///   [2] flight_policy (mut)
///   [3] oracle_feed   (readonly, CHECK)
///   [4] queue         (readonly, CHECK — address = default_queue())
///   [5] slot_hashes   (sysvar, readonly)
///   [6] instructions  (sysvar, readonly)
fn build_check_oracle_and_resolve_flight_ix(
    program_id: &Pubkey,
    payer: &Pubkey,
    master_policy: &Pubkey,
    flight_policy: &Pubkey,
    oracle_feed: &Pubkey,
    queue: &Pubkey,
) -> Result<Instruction> {
    let discriminator = anchor_instruction_discriminator("check_oracle_and_resolve_flight");
    Ok(Instruction {
        program_id: *program_id,
        accounts: vec![
            AccountMeta::new(*payer, true),
            AccountMeta::new_readonly(*master_policy, false),
            AccountMeta::new(*flight_policy, false),
            AccountMeta::new_readonly(*oracle_feed, false),
            AccountMeta::new_readonly(*queue, false),
            AccountMeta::new_readonly(sysvar::slot_hashes::id(), false),
            AccountMeta::new_readonly(sysvar::instructions::id(), false),
        ],
        data: discriminator.to_vec(),
    })
}

/// settle_flight_claim instruction을 빌드한다.
///
/// 계정 순서 (settle_flight_claim.rs Accounts 구조체 기준):
///   [0] executor            (signer)
///   [1] master_policy        (readonly)
///   [2] flight_policy        (mut)
///   [3] leader_deposit_token (mut)
///   [4] reinsurer_pool_token (mut)
///   [5] token_program        (readonly)
///   remaining: participant pool_wallets (mut) — master.participants 순서와 동일
fn build_settle_flight_claim_ix(
    program_id: &Pubkey,
    executor: &Pubkey,
    master_policy: &Pubkey,
    flight_policy: &Pubkey,
    leader_deposit_wallet: &Pubkey,
    reinsurer_pool_wallet: &Pubkey,
    participant_pool_wallets: &[Pubkey],
) -> Result<Instruction> {
    let discriminator = anchor_instruction_discriminator("settle_flight_claim");
    let mut accounts = vec![
        AccountMeta::new_readonly(*executor, true),
        AccountMeta::new_readonly(*master_policy, false),
        AccountMeta::new(*flight_policy, false),
        AccountMeta::new(*leader_deposit_wallet, false),
        AccountMeta::new(*reinsurer_pool_wallet, false),
        AccountMeta::new_readonly(spl_token_program_id(), false),
    ];
    for pw in participant_pool_wallets {
        accounts.push(AccountMeta::new(*pw, false));
    }
    Ok(Instruction {
        program_id: *program_id,
        accounts,
        data: discriminator.to_vec(),
    })
}

/// settle_flight_no_claim instruction을 빌드한다.
///
/// 계정 순서 (settle_flight_no_claim.rs Accounts 구조체 기준):
///   [0] executor               (signer)
///   [1] master_policy           (readonly)
///   [2] flight_policy           (mut)
///   [3] leader_deposit_token    (mut)
///   [4] reinsurer_deposit_token (mut)
///   [5] token_program           (readonly)
///   remaining: participant deposit_wallets (mut) — master.participants 순서와 동일
fn build_settle_flight_no_claim_ix(
    program_id: &Pubkey,
    executor: &Pubkey,
    master_policy: &Pubkey,
    flight_policy: &Pubkey,
    leader_deposit_wallet: &Pubkey,
    reinsurer_deposit_wallet: &Pubkey,
    participant_deposit_wallets: &[Pubkey],
) -> Result<Instruction> {
    let discriminator = anchor_instruction_discriminator("settle_flight_no_claim");
    let mut accounts = vec![
        AccountMeta::new_readonly(*executor, true),
        AccountMeta::new_readonly(*master_policy, false),
        AccountMeta::new(*flight_policy, false),
        AccountMeta::new(*leader_deposit_wallet, false),
        AccountMeta::new(*reinsurer_deposit_wallet, false),
        AccountMeta::new_readonly(spl_token_program_id(), false),
    ];
    for dw in participant_deposit_wallets {
        accounts.push(AccountMeta::new(*dw, false));
    }
    Ok(Instruction {
        program_id: *program_id,
        accounts,
        data: discriminator.to_vec(),
    })
}

/// SPL Token 프로그램 ID (모든 클러스터 공통)
fn spl_token_program_id() -> Pubkey {
    Pubkey::from_str("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA").expect("valid pubkey")
}
