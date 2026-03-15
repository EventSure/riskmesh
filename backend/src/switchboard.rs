/// Switchboard On-Demand: Crossbar HTTP API를 통해 오라클 업데이트를 가져온다.
///
/// Crossbar는 Switchboard 오라클 노드들의 서명된 피드 업데이트를 집계하는
/// HTTP 서비스다. 아래 엔드포인트로 최신 업데이트(Ed25519 서명 포함)를
/// 가져올 수 있다:
///   POST https://crossbar.switchboard.xyz/updates/solana/{queue}/{feed_pubkey}
///
/// 응답에는 트랜잭션에 바로 삽입 가능한 base64 인코딩 instruction 바이트들이
/// 포함된다.
use anyhow::{bail, Context, Result};
use serde::Deserialize;
use solana_sdk::{
    address_lookup_table::AddressLookupTableAccount, instruction::Instruction, pubkey::Pubkey,
};
use std::str::FromStr;

const CROSSBAR_URL: &str = "https://crossbar.switchboard.xyz";

/// Crossbar에서 받은 오라클 업데이트 데이터
#[derive(Debug)]
pub struct OracleUpdate {
    /// 트랜잭션 ix[0]: Ed25519 서명 검증
    pub ed25519_ix: Instruction,
    /// 트랜잭션 ix[1]: verified_update (feed 계정 갱신)
    pub verified_update_ix: Instruction,
    /// v0 트랜잭션용 Address Lookup Tables
    pub luts: Vec<AddressLookupTableAccount>,
    /// 오라클이 보고한 값 (지연 분)
    pub value: f64,
}

#[derive(Deserialize, Debug)]
struct CrossbarResponse {
    /// base64 인코딩된 instruction 직렬화 바이트 배열
    instructions: Option<Vec<String>>,
    /// Address Lookup Table 주소 목록
    luts: Option<Vec<String>>,
    /// 현재 피드 값
    value: Option<f64>,
    error: Option<String>,
}

/// Switchboard Crossbar API에서 오라클 업데이트 instruction을 가져온다.
///
/// 반환된 OracleUpdate의 instruction들은 반드시 아래 순서로
/// 트랜잭션에 배치해야 한다:
///   [0] ed25519_ix
///   [1] verified_update_ix
///   [2] check_oracle_and_create_claim (우리 프로그램)
pub async fn fetch_oracle_update(
    queue: &Pubkey,
    feed_pubkey: &Pubkey,
    rpc_client: &solana_client::rpc_client::RpcClient,
) -> Result<OracleUpdate> {
    let url = format!(
        "{CROSSBAR_URL}/updates/solana/{queue}/{feed_pubkey}"
    );

    let resp: CrossbarResponse = reqwest::Client::new()
        .post(&url)
        .send()
        .await
        .context("Crossbar API 호출 실패")?
        .json()
        .await
        .context("Crossbar 응답 파싱 실패")?;

    if let Some(err) = resp.error {
        bail!("Crossbar 오류: {err}");
    }

    let ixs = resp
        .instructions
        .context("Crossbar 응답에 instructions 없음")?;
    if ixs.len() < 2 {
        bail!(
            "Crossbar 응답 instruction 수 부족: {} (최소 2개 필요)",
            ixs.len()
        );
    }

    let ed25519_ix = decode_instruction(&ixs[0])
        .context("Ed25519 instruction 디코딩 실패")?;
    let verified_update_ix = decode_instruction(&ixs[1])
        .context("verified_update instruction 디코딩 실패")?;

    // LUT 계정 로드
    let mut luts = Vec::new();
    if let Some(lut_addrs) = resp.luts {
        for addr_str in lut_addrs {
            let addr = Pubkey::from_str(&addr_str)
                .with_context(|| format!("LUT 주소 파싱 실패: {addr_str}"))?;
            let account = rpc_client
                .get_account(&addr)
                .with_context(|| format!("LUT 계정 조회 실패: {addr}"))?;
            let lut = solana_sdk::address_lookup_table::state::AddressLookupTable::deserialize(
                &account.data,
            )
            .with_context(|| format!("LUT 역직렬화 실패: {addr}"))?;
            luts.push(AddressLookupTableAccount {
                key: addr,
                addresses: lut.addresses.to_vec(),
            });
        }
    }

    let value = resp.value.unwrap_or(0.0);

    Ok(OracleUpdate {
        ed25519_ix,
        verified_update_ix,
        luts,
        value,
    })
}

fn decode_instruction(b64: &str) -> Result<Instruction> {
    let bytes = base64_decode(b64).context("base64 디코딩 실패")?;
    bincode::deserialize::<Instruction>(&bytes).context("instruction 역직렬화 실패")
}

fn base64_decode(s: &str) -> Result<Vec<u8>> {
    use std::io::Read;
    let mut decoder = base64::read::DecoderReader::new(
        std::io::Cursor::new(s.as_bytes()),
        &base64::engine::general_purpose::STANDARD,
    );
    let mut out = Vec::new();
    decoder.read_to_end(&mut out)?;
    Ok(out)
}
