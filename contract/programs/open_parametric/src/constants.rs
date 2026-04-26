use anchor_lang::prelude::Pubkey;
use anchor_lang::pubkey;
use std::str::FromStr;

use crate::errors::OpenParamError;

pub const DELAY_THRESHOLD_MIN: u16 = 120;
pub const ORACLE_MAX_STALENESS_SLOTS: u64 = 150; // approx 60-90s depending on cluster

pub const MAX_ROUTE_LEN: usize = 16;
pub const MAX_FLIGHT_NO_LEN: usize = 16;
pub const MAX_MASTER_PARTICIPANTS: usize = 5;
pub const MAX_SUBSCRIBER_REF_LEN: usize = 64;
pub const APPROVED_MASTER_CURRENCY_MINT_ENV: &str =
    "OPEN_PARAMETRIC_APPROVED_MASTER_CURRENCY_MINT";
pub const DEFAULT_APPROVED_MASTER_CURRENCY_MINT: Pubkey =
    pubkey!("A6ty3ZmdzFW9JS92QCc5n7XPUM2cfwKzdnPmyXP2hY8w");

// oracle_feed(32 bytes) 추가됐지만 4096 버퍼로 충분.
pub const MASTER_POLICY_SPACE: usize = 4096;
pub const FLIGHT_POLICY_SPACE: usize = 1024;

pub fn approved_master_currency_mint() -> std::result::Result<Pubkey, OpenParamError> {
    match option_env!("OPEN_PARAMETRIC_APPROVED_MASTER_CURRENCY_MINT") {
        Some(mint) => Pubkey::from_str(mint).map_err(|_| OpenParamError::InvalidInput),
        None => Ok(DEFAULT_APPROVED_MASTER_CURRENCY_MINT),
    }
}
