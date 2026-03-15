use anyhow::{Context, Result};
use solana_sdk::pubkey::Pubkey;
use std::str::FromStr;

#[derive(Debug, Clone)]
pub struct Config {
    pub rpc_url: String,
    pub program_id: Pubkey,
    pub leader_keypair_path: String,
    pub leader_pubkey: Pubkey,
    pub aviationstack_api_key: String,
    pub switchboard_queue: Pubkey,
    pub oracle_check_cron: String,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        dotenv::dotenv().ok();

        Ok(Config {
            rpc_url: env("RPC_URL", "https://api.devnet.solana.com"),
            program_id: pubkey_env("PROGRAM_ID")
                .context("PROGRAM_ID 환경변수 필요")?,
            leader_keypair_path: env(
                "LEADER_KEYPAIR_PATH",
                "~/.config/solana/id.json",
            ),
            leader_pubkey: pubkey_env("LEADER_PUBKEY")
                .context("LEADER_PUBKEY 환경변수 필요")?,
            aviationstack_api_key: std::env::var("AVIATIONSTACK_API_KEY")
                .unwrap_or_default(),
            switchboard_queue: pubkey_env("SWITCHBOARD_QUEUE")
                .context("SWITCHBOARD_QUEUE 환경변수 필요")?,
            oracle_check_cron: env("ORACLE_CHECK_CRON", "0 */15 * * * *"),
        })
    }
}

fn env(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.to_string())
}

fn pubkey_env(key: &str) -> Result<Pubkey> {
    let val = std::env::var(key)
        .with_context(|| format!("환경변수 {key} 없음"))?;
    Pubkey::from_str(&val).with_context(|| format!("{key} 주소 파싱 실패: {val}"))
}
