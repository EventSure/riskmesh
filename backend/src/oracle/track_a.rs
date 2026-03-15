/// Track A — Trusted Resolver
///
/// 흐름:
///   1. getProgramAccounts로 처리 대상 FlightPolicy 목록 조회
///   2. AviationStack API로 항공편 지연 정보 조회
///   3. resolve_flight_delay 트랜잭션 전송
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
        FLIGHT_POLICY_STATUS_AWAITING_ORACLE, FLIGHT_POLICY_STATUS_ISSUED,
    },
};

/// FlightPolicy 계정에서 읽어낸 최소 정보
#[derive(Debug)]
pub struct FlightPolicyInfo {
    pub pubkey: Pubkey,
    pub master_policy: Pubkey,
    pub flight_no: String,
    pub departure_ts: i64,
    pub status: u8,
}

/// 처리 가능한 FlightPolicy 목록을 온체인에서 조회한다.
/// status == Issued(0) 또는 AwaitingOracle(1) 인 계정만 반환.
pub async fn scan_active_flight_policies(
    client: &SolanaClient,
    program_id: &Pubkey,
    _leader_pubkey: &Pubkey, // 추후 leader 필터 추가 시 사용
) -> Result<Vec<FlightPolicyInfo>> {
    // discriminator 필터만 적용하고 상태는 클라이언트에서 확인
    // (FlightPolicy에 가변 길이 필드가 있어 바이트 오프셋이 불확정)
    let accounts = client
        .rpc
        .get_program_accounts(program_id)
        .context("FlightPolicy getProgramAccounts 실패")?;

    let mut result = Vec::new();
    for (pubkey, account) in accounts {
        if account.data.len() < 8 {
            continue;
        }
        // discriminator 확인
        if account.data[..8] != FLIGHT_POLICY {
            continue;
        }
        match parse_flight_policy(&pubkey, &account.data) {
            Ok(info)
                if info.status == FLIGHT_POLICY_STATUS_ISSUED
                    || info.status == FLIGHT_POLICY_STATUS_AWAITING_ORACLE =>
            {
                result.push(info);
            }
            Ok(_) => {} // 다른 상태는 스킵
            Err(e) => {
                tracing::warn!("[track_a] FlightPolicy 파싱 실패 {pubkey}: {e}");
            }
        }
    }
    Ok(result)
}

/// FlightPolicy 계정 데이터를 역직렬화한다 (borsh 레이아웃).
///
/// FlightPolicy 필드 순서 (state.rs 기준):
///   discriminator[8], child_policy_id[8], master[32], creator[32],
///   subscriber_ref[4+len], flight_no[4+len], route[4+len],
///   departure_ts[8], premium_paid[8], delay_minutes[2], cancelled[1],
///   payout_amount[8], status[1], ...
fn parse_flight_policy(pubkey: &Pubkey, data: &[u8]) -> Result<FlightPolicyInfo> {
    let mut offset = 8usize; // skip discriminator

    // child_policy_id (u64)
    let _child_id = read_u64(data, &mut offset)?;

    // master (Pubkey, 32 bytes)
    let master_policy = read_pubkey(data, &mut offset)?;

    // creator (Pubkey, 32 bytes)
    let _creator = read_pubkey(data, &mut offset)?;

    // subscriber_ref (String: 4-byte len prefix + bytes)
    let _subscriber_ref = read_string(data, &mut offset)?;

    // flight_no
    let flight_no = read_string(data, &mut offset)?;

    // route
    let _route = read_string(data, &mut offset)?;

    // departure_ts (i64)
    let departure_ts = read_i64(data, &mut offset)?;

    // premium_paid (u64)
    let _premium = read_u64(data, &mut offset)?;

    // delay_minutes (u16)
    let _delay = read_u16(data, &mut offset)?;

    // cancelled (bool, 1 byte)
    let _cancelled = read_u8(data, &mut offset)?;

    // payout_amount (u64)
    let _payout = read_u64(data, &mut offset)?;

    // status (u8)
    let status = read_u8(data, &mut offset)?;

    Ok(FlightPolicyInfo {
        pubkey: *pubkey,
        master_policy,
        flight_no,
        departure_ts,
        status,
    })
}

/// Track A 오라클 실행: AviationStack 조회 → resolve_flight_delay 전송
pub async fn run(
    config: &Config,
    client: &SolanaClient,
    leader: &solana_sdk::signature::Keypair,
    policy: &FlightPolicyInfo,
) -> Result<()> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_secs() as i64;

    // 출발 예정 시각 이전이면 스킵
    if now < policy.departure_ts {
        tracing::info!(
            "[track_a] {} 아직 출발 전 (departure_ts={}), 스킵",
            policy.flight_no,
            policy.departure_ts
        );
        return Ok(());
    }

    tracing::info!(
        "[track_a] {} 오라클 조회 시작 (FlightPolicy={})",
        policy.flight_no,
        policy.pubkey
    );

    // AviationStack 조회
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
            return Ok(());
        }
    };

    // resolve_flight_delay instruction 빌드
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
    Ok(())
}

/// resolve_flight_delay instruction을 수동으로 빌드한다.
///
/// Anchor discriminator: sha256("global:resolve_flight_delay")[..8]
fn build_resolve_flight_delay_ix(
    program_id: &Pubkey,
    resolver: &Pubkey,
    master_policy: &Pubkey,
    flight_policy: &Pubkey,
    delay_minutes: u16,
    cancelled: bool,
) -> Result<Instruction> {
    // anchor discriminator for "resolve_flight_delay"
    let discriminator = anchor_instruction_discriminator("resolve_flight_delay");

    // args: delay_minutes (u16 LE) + cancelled (bool)
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

// ─── 역직렬화 헬퍼 (track_b에서도 재사용) ──────────────────────────────────

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
