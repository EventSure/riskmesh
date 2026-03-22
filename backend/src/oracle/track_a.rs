/// Track A — Trusted Resolver
///
/// 흐름:
///   1. getProgramAccounts로 처리 대상 FlightPolicy 목록 조회
///      (Issued / AwaitingOracle / Claimable / NoClaim 상태)
///   2. AviationStack API로 항공편 지연 정보 조회 (미결 건만)
///   3. resolve_flight_delay 트랜잭션 전송
///   4. 결과에 따라 settle_flight_claim / settle_flight_no_claim 자동 실행
use anyhow::{Context, Result};
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signer::Signer,
};

use crate::{
    config::Config,
    flight_api,
    solana::{
        client::SolanaClient,
        discriminators::FLIGHT_POLICY,
        FLIGHT_POLICY_STATUS_AWAITING_ORACLE, FLIGHT_POLICY_STATUS_CLAIMABLE,
        FLIGHT_POLICY_STATUS_ISSUED, FLIGHT_POLICY_STATUS_NO_CLAIM,
    },
};

const DELAY_THRESHOLD_MIN: u16 = 120;
const SPL_TOKEN_PROGRAM: Pubkey = solana_sdk::pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

// ─── 데이터 구조체 ──────────────────────────────────────────────────────────────

/// FlightPolicy 계정에서 읽어낸 최소 정보
#[derive(Debug)]
pub struct FlightPolicyInfo {
    pub pubkey: Pubkey,
    pub master_policy: Pubkey,
    pub flight_no: String,
    pub departure_ts: i64,
    pub status: u8,
}

/// MasterPolicy 계정에서 정산에 필요한 토큰 계정 주소 모음
struct MasterPolicyInfo {
    leader_deposit_wallet: Pubkey,
    reinsurer_pool_wallet: Pubkey,
    reinsurer_deposit_wallet: Pubkey,
    /// settle_flight_claim remaining_accounts 순서
    participant_pool_wallets: Vec<Pubkey>,
    /// settle_flight_no_claim remaining_accounts 순서
    participant_deposit_wallets: Vec<Pubkey>,
}

// ─── 스캔 ───────────────────────────────────────────────────────────────────────

/// 처리 대상 FlightPolicy 목록을 온체인에서 조회한다.
///
/// 조회 대상 status:
///   Issued(0), AwaitingOracle(1) — 아직 resolve 전
///   Claimable(2), NoClaim(4)    — resolve 완료 but 정산 미완료 (데몬 재시작 복구)
pub async fn scan_active_flight_policies(
    client: &SolanaClient,
    program_id: &Pubkey,
    _leader_pubkey: &Pubkey,
) -> Result<Vec<FlightPolicyInfo>> {
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
            Ok(info) => {
                if info.status == FLIGHT_POLICY_STATUS_ISSUED
                    || info.status == FLIGHT_POLICY_STATUS_AWAITING_ORACLE
                    || info.status == FLIGHT_POLICY_STATUS_CLAIMABLE
                    || info.status == FLIGHT_POLICY_STATUS_NO_CLAIM
                {
                    result.push(info);
                }
            }
            Err(e) => {
                tracing::warn!("[track_a] FlightPolicy 파싱 실패 {pubkey}: {e}");
            }
        }
    }
    Ok(result)
}

// ─── 메인 실행 ─────────────────────────────────────────────────────────────────

/// Track A 오라클 실행 (status별 분기)
pub async fn run(
    config: &Config,
    client: &SolanaClient,
    leader: &solana_sdk::signature::Keypair,
    policy: &FlightPolicyInfo,
) -> Result<()> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_secs() as i64;

    if policy.status == FLIGHT_POLICY_STATUS_ISSUED
        || policy.status == FLIGHT_POLICY_STATUS_AWAITING_ORACLE
    {
        // 출발 전이면 스킵
        if now < policy.departure_ts {
            tracing::info!(
                "[track_a] {} 아직 출발 전 (departure_ts={}), 스킵",
                policy.flight_no,
                policy.departure_ts
            );
            return Ok(());
        }

        // AviationStack 조회 → resolve
        let is_claimable = match do_resolve(config, client, leader, policy).await? {
            Some(b) => b,
            None => return Ok(()), // 항공편 데이터 없음, 스킵
        };

        do_settle(config, client, leader, policy, is_claimable)?;
    } else if policy.status == FLIGHT_POLICY_STATUS_CLAIMABLE {
        // 이전 실행에서 resolve만 완료, 정산 재시도
        tracing::info!(
            "[track_a] {} Claimable 상태 — 정산 재시도",
            policy.flight_no
        );
        do_settle(config, client, leader, policy, true)?;
    } else if policy.status == FLIGHT_POLICY_STATUS_NO_CLAIM {
        // 이전 실행에서 resolve만 완료, 정산 재시도
        tracing::info!(
            "[track_a] {} NoClaim 상태 — 정산 재시도",
            policy.flight_no
        );
        do_settle(config, client, leader, policy, false)?;
    }

    Ok(())
}

// ─── resolve ───────────────────────────────────────────────────────────────────

/// AviationStack 조회 후 resolve_flight_delay 전송.
/// Returns: Some(is_claimable) | None (데이터 없음, 스킵)
async fn do_resolve(
    config: &Config,
    client: &SolanaClient,
    leader: &solana_sdk::signature::Keypair,
    policy: &FlightPolicyInfo,
) -> Result<Option<bool>> {
    tracing::info!(
        "[track_a] {} 오라클 조회 시작 (FlightPolicy={})",
        policy.flight_no,
        policy.pubkey
    );

    let delay_result = flight_api::fetch_flight_delay(
        &config.aviationstack_api_key,
        &policy.flight_no,
        None,
    )
    .await
    .with_context(|| format!("AviationStack 조회 실패: {}", policy.flight_no))?;

    let (delay_minutes, cancelled) = match delay_result {
        Some(r) => {
            tracing::info!(
                "[track_a] {} 지연={}분, 결항={}, 상태={}",
                r.flight_iata,
                r.departure_delay,
                r.cancelled,
                r.status
            );
            (r.departure_delay, r.cancelled)
        }
        None => {
            tracing::warn!("[track_a] {} 데이터 없음, 스킵", policy.flight_no);
            return Ok(None);
        }
    };

    let ix = build_resolve_flight_delay_ix(
        &config.program_id,
        &leader.pubkey(),
        &policy.master_policy,
        &policy.pubkey,
        delay_minutes,
        cancelled,
    )?;

    let sig = client
        .send_transaction(&[ix], leader)
        .context("resolve_flight_delay 트랜잭션 실패")?;

    tracing::info!(
        "[track_a] {} resolve_flight_delay 완료. tx={}",
        policy.flight_no,
        sig
    );

    Ok(Some(delay_minutes >= DELAY_THRESHOLD_MIN || cancelled))
}

// ─── settle ────────────────────────────────────────────────────────────────────

/// MasterPolicy를 읽어 settle_flight_claim / settle_flight_no_claim 전송
fn do_settle(
    config: &Config,
    client: &SolanaClient,
    leader: &solana_sdk::signature::Keypair,
    policy: &FlightPolicyInfo,
    is_claimable: bool,
) -> Result<()> {
    let master_account = client
        .get_account(&policy.master_policy)
        .with_context(|| format!("MasterPolicy 조회 실패: {}", policy.master_policy))?;
    let master = parse_master_policy(&master_account.data)
        .context("MasterPolicy 파싱 실패")?;

    if is_claimable {
        let ix = build_settle_flight_claim_ix(
            &config.program_id,
            &leader.pubkey(),
            &policy.master_policy,
            &policy.pubkey,
            &master.leader_deposit_wallet,
            &master.reinsurer_pool_wallet,
            &master.participant_pool_wallets,
        )?;
        let sig = client
            .send_transaction(&[ix], leader)
            .context("settle_flight_claim 트랜잭션 실패")?;
        tracing::info!(
            "[track_a] {} settle_flight_claim 완료. tx={}",
            policy.flight_no,
            sig
        );
    } else {
        let ix = build_settle_flight_no_claim_ix(
            &config.program_id,
            &leader.pubkey(),
            &policy.master_policy,
            &policy.pubkey,
            &master.leader_deposit_wallet,
            &master.reinsurer_deposit_wallet,
            &master.participant_deposit_wallets,
        )?;
        let sig = client
            .send_transaction(&[ix], leader)
            .context("settle_flight_no_claim 트랜잭션 실패")?;
        tracing::info!(
            "[track_a] {} settle_flight_no_claim 완료. tx={}",
            policy.flight_no,
            sig
        );
    }

    Ok(())
}

// ─── Instruction 빌더 ──────────────────────────────────────────────────────────

fn build_resolve_flight_delay_ix(
    program_id: &Pubkey,
    resolver: &Pubkey,
    master_policy: &Pubkey,
    flight_policy: &Pubkey,
    delay_minutes: u16,
    cancelled: bool,
) -> Result<Instruction> {
    let discriminator = anchor_instruction_discriminator("resolve_flight_delay");
    let mut data = discriminator.to_vec();
    data.extend_from_slice(&delay_minutes.to_le_bytes());
    data.push(cancelled as u8);

    Ok(Instruction {
        program_id: *program_id,
        accounts: vec![
            AccountMeta::new_readonly(*resolver, true),
            AccountMeta::new_readonly(*master_policy, false),
            AccountMeta::new(*flight_policy, false),
        ],
        data,
    })
}

/// settle_flight_claim: executor, master_policy, flight_policy,
///   leader_deposit_token, reinsurer_pool_token, token_program,
///   remaining: participants' pool_wallets (mut)
fn build_settle_flight_claim_ix(
    program_id: &Pubkey,
    executor: &Pubkey,
    master_policy: &Pubkey,
    flight_policy: &Pubkey,
    leader_deposit_token: &Pubkey,
    reinsurer_pool_token: &Pubkey,
    participant_pool_wallets: &[Pubkey],
) -> Result<Instruction> {
    let discriminator = anchor_instruction_discriminator("settle_flight_claim");
    let data = discriminator.to_vec();

    let mut accounts = vec![
        AccountMeta::new_readonly(*executor, true),
        AccountMeta::new_readonly(*master_policy, false),
        AccountMeta::new(*flight_policy, false),
        AccountMeta::new(*leader_deposit_token, false),
        AccountMeta::new(*reinsurer_pool_token, false),
        AccountMeta::new_readonly(SPL_TOKEN_PROGRAM, false),
    ];
    for pw in participant_pool_wallets {
        accounts.push(AccountMeta::new(*pw, false));
    }

    Ok(Instruction { program_id: *program_id, accounts, data })
}

/// settle_flight_no_claim: executor, master_policy, flight_policy,
///   leader_deposit_token, reinsurer_deposit_token, token_program,
///   remaining: participants' deposit_wallets (mut)
fn build_settle_flight_no_claim_ix(
    program_id: &Pubkey,
    executor: &Pubkey,
    master_policy: &Pubkey,
    flight_policy: &Pubkey,
    leader_deposit_token: &Pubkey,
    reinsurer_deposit_token: &Pubkey,
    participant_deposit_wallets: &[Pubkey],
) -> Result<Instruction> {
    let discriminator = anchor_instruction_discriminator("settle_flight_no_claim");
    let data = discriminator.to_vec();

    let mut accounts = vec![
        AccountMeta::new_readonly(*executor, true),
        AccountMeta::new_readonly(*master_policy, false),
        AccountMeta::new(*flight_policy, false),
        AccountMeta::new(*leader_deposit_token, false),
        AccountMeta::new(*reinsurer_deposit_token, false),
        AccountMeta::new_readonly(SPL_TOKEN_PROGRAM, false),
    ];
    for dw in participant_deposit_wallets {
        accounts.push(AccountMeta::new(*dw, false));
    }

    Ok(Instruction { program_id: *program_id, accounts, data })
}

// ─── MasterPolicy 파싱 ─────────────────────────────────────────────────────────

/// MasterPolicy 계정 데이터에서 정산에 필요한 주소를 역직렬화한다.
///
/// MasterPolicy 필드 순서 (state.rs 기준):
///   discriminator[8], master_id[8], leader[32], operator[32], currency_mint[32],
///   coverage_start_ts[8], coverage_end_ts[8], premium_per_policy[8],
///   payout_delay_2h[8], payout_delay_3h[8], payout_delay_4to5h[8],
///   payout_delay_6h_or_cancelled[8],
///   ceded_ratio_bps[2], reins_commission_bps[2], reinsurer_effective_bps[2],
///   reinsurer[32], reinsurer_confirmed[1],
///   reinsurer_pool_wallet[32], reinsurer_deposit_wallet[32], leader_deposit_wallet[32],
///   participants: Vec<MasterParticipant> (4-byte len + each 99 bytes),
///   status[1], created_at[8], bump[1]
fn parse_master_policy(data: &[u8]) -> Result<MasterPolicyInfo> {
    let mut offset = 8; // skip discriminator

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

    // Vec<MasterParticipant>: 4-byte len + each (insurer[32]+share_bps[2]+confirmed[1]+pool[32]+deposit[32])
    let participant_count = u32::from_le_bytes(
        data[offset..offset + 4]
            .try_into()
            .context("participants 길이 읽기 실패")?,
    ) as usize;
    offset += 4;

    let mut participant_pool_wallets = Vec::with_capacity(participant_count);
    let mut participant_deposit_wallets = Vec::with_capacity(participant_count);

    for _ in 0..participant_count {
        let _insurer = read_pubkey(data, &mut offset)?;
        let _share_bps = read_u16(data, &mut offset)?;
        let _confirmed = read_u8(data, &mut offset)?;
        let pool_wallet = read_pubkey(data, &mut offset)?;
        let deposit_wallet = read_pubkey(data, &mut offset)?;
        participant_pool_wallets.push(pool_wallet);
        participant_deposit_wallets.push(deposit_wallet);
    }

    Ok(MasterPolicyInfo {
        leader_deposit_wallet,
        reinsurer_pool_wallet,
        reinsurer_deposit_wallet,
        participant_pool_wallets,
        participant_deposit_wallets,
    })
}

// ─── FlightPolicy 파싱 ─────────────────────────────────────────────────────────

/// FlightPolicy 계정 데이터를 역직렬화한다 (borsh 레이아웃).
///
/// FlightPolicy 필드 순서 (state.rs 기준):
///   discriminator[8], child_policy_id[8], master[32], creator[32],
///   subscriber_ref[4+len], flight_no[4+len], route[4+len],
///   departure_ts[8], premium_paid[8], delay_minutes[2], cancelled[1],
///   payout_amount[8], status[1], ...
fn parse_flight_policy(pubkey: &Pubkey, data: &[u8]) -> Result<FlightPolicyInfo> {
    let mut offset = 8usize; // skip discriminator

    let _child_id = read_u64(data, &mut offset)?;
    let master_policy = read_pubkey(data, &mut offset)?;
    let _creator = read_pubkey(data, &mut offset)?;
    let _subscriber_ref = read_string(data, &mut offset)?;
    let flight_no = read_string(data, &mut offset)?;
    let _route = read_string(data, &mut offset)?;
    let departure_ts = read_i64(data, &mut offset)?;
    let _premium = read_u64(data, &mut offset)?;
    let _delay = read_u16(data, &mut offset)?;
    let _cancelled = read_u8(data, &mut offset)?;
    let _payout = read_u64(data, &mut offset)?;
    let status = read_u8(data, &mut offset)?;

    Ok(FlightPolicyInfo {
        pubkey: *pubkey,
        master_policy,
        flight_no,
        departure_ts,
        status,
    })
}

// ─── 역직렬화 헬퍼 ─────────────────────────────────────────────────────────────

pub fn read_u8(data: &[u8], offset: &mut usize) -> Result<u8> {
    let v = *data.get(*offset).context("u8 읽기 실패: 범위 초과")?;
    *offset += 1;
    Ok(v)
}

pub fn read_u16(data: &[u8], offset: &mut usize) -> Result<u16> {
    let bytes: [u8; 2] = data[*offset..*offset + 2]
        .try_into()
        .context("u16 읽기 실패")?;
    *offset += 2;
    Ok(u16::from_le_bytes(bytes))
}

pub fn read_u64(data: &[u8], offset: &mut usize) -> Result<u64> {
    let bytes: [u8; 8] = data[*offset..*offset + 8]
        .try_into()
        .context("u64 읽기 실패")?;
    *offset += 8;
    Ok(u64::from_le_bytes(bytes))
}

pub fn read_i64(data: &[u8], offset: &mut usize) -> Result<i64> {
    let bytes: [u8; 8] = data[*offset..*offset + 8]
        .try_into()
        .context("i64 읽기 실패")?;
    *offset += 8;
    Ok(i64::from_le_bytes(bytes))
}

pub fn read_pubkey(data: &[u8], offset: &mut usize) -> Result<Pubkey> {
    let bytes: [u8; 32] = data[*offset..*offset + 32]
        .try_into()
        .context("Pubkey 읽기 실패")?;
    *offset += 32;
    Ok(Pubkey::from(bytes))
}

pub fn read_string(data: &[u8], offset: &mut usize) -> Result<String> {
    let len = u32::from_le_bytes(
        data[*offset..*offset + 4]
            .try_into()
            .context("String 길이 읽기 실패")?,
    ) as usize;
    *offset += 4;
    let s = std::str::from_utf8(&data[*offset..*offset + len])
        .context("String UTF-8 디코딩 실패")?
        .to_string();
    *offset += len;
    Ok(s)
}

/// Anchor instruction discriminator: sha256("global:<name>")[..8]
pub fn anchor_instruction_discriminator(name: &str) -> [u8; 8] {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(format!("global:{name}").as_bytes());
    let result = hasher.finalize();
    result[..8].try_into().expect("sha256 길이 보장")
}

/// Anchor account discriminator: sha256("account:<Name>")[..8]
pub fn anchor_account_discriminator(name: &str) -> [u8; 8] {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(format!("account:{name}").as_bytes());
    let result = hasher.finalize();
    result[..8].try_into().expect("sha256 길이 보장")
}

