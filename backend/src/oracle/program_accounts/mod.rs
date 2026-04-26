use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use solana_sdk::pubkey::Pubkey;

use crate::{
    oracle::track_a::{
        anchor_account_discriminator, read_i64, read_pubkey, read_string, read_u16, read_u64,
        read_u8,
    },
    solana::client::SolanaClient,
};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MasterAgreementParticipantInfo {
    pub insurer: String,
    pub share_bps: u16,
    pub confirmed: bool,
    pub pool_wallet: String,
    pub deposit_wallet: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MasterAgreementInfo {
    pub pubkey: String,
    pub master_id: u64,
    pub leader: String,
    pub operator: String,
    pub currency_mint: String,
    pub coverage_start_ts: i64,
    pub coverage_end_ts: i64,
    pub premium_per_policy: u64,
    pub payout_delay_2h: u64,
    pub payout_delay_3h: u64,
    pub payout_delay_4to5h: u64,
    pub payout_delay_6h_or_cancelled: u64,
    pub leader_share_bps: u16,
    pub ceded_ratio_bps: u16,
    pub reins_commission_bps: u16,
    pub reinsurer_effective_bps: u16,
    pub reinsurer: Option<String>,
    pub reinsurer_confirmed: bool,
    pub reinsurer_pool_wallet: Option<String>,
    pub reinsurer_deposit_wallet: Option<String>,
    pub leader_pool_wallet: String,
    pub leader_deposit_wallet: String,
    pub participants: Vec<MasterAgreementParticipantInfo>,
    pub oracle_feed: String,
    pub status: u8,
    pub status_label: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FlightPolicyInfo {
    pub pubkey: String,
    pub child_policy_id: u64,
    pub master: String,
    pub creator: String,
    pub subscriber_ref: String,
    pub flight_no: String,
    pub route: String,
    pub departure_ts: i64,
    pub premium_paid: u64,
    pub delay_minutes: u16,
    pub cancelled: bool,
    pub payout_amount: u64,
    pub status: u8,
    pub status_label: String,
    pub premium_distributed: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

pub fn scan_master_agreements(
    client: &SolanaClient,
    program_id: &Pubkey,
) -> Result<Vec<MasterAgreementInfo>> {
    // TODO: 온체인 Anchor account discriminator는 smart contract와 맞물려 있어 "MasterAgreement"를 유지한다.
    scan_accounts(client, program_id, "MasterAgreement", parse_master_agreement)
}

pub fn fetch_master_agreement(
    client: &SolanaClient,
    master_agreement_pubkey: &Pubkey,
) -> Result<MasterAgreementInfo> {
    let account = client.get_account(master_agreement_pubkey)?;
    parse_master_agreement(master_agreement_pubkey, &account.data)
}

pub fn scan_flight_policies(
    client: &SolanaClient,
    program_id: &Pubkey,
) -> Result<Vec<FlightPolicyInfo>> {
    scan_accounts(client, program_id, "FlightPolicy", parse_flight_policy)
}

pub fn fetch_flight_policy(
    client: &SolanaClient,
    flight_policy_pubkey: &Pubkey,
) -> Result<FlightPolicyInfo> {
    let account = client.get_account(flight_policy_pubkey)?;
    parse_flight_policy(flight_policy_pubkey, &account.data)
}

fn scan_accounts<T>(
    client: &SolanaClient,
    program_id: &Pubkey,
    account_name: &str,
    parser: fn(&Pubkey, &[u8]) -> Result<T>,
) -> Result<Vec<T>> {
    let discriminator = anchor_account_discriminator(account_name);
    let accounts = client
        .rpc
        .get_program_accounts(program_id)
        .with_context(|| format!("{account_name} getProgramAccounts 실패"))?;

    let mut result = Vec::new();
    for (pubkey, account) in accounts {
        if account.data.len() < 8 || account.data[..8] != discriminator {
            continue;
        }

        match parser(&pubkey, &account.data) {
            Ok(info) => result.push(info),
            Err(err) => {
                tracing::warn!("[program_accounts] {account_name} 파싱 실패 {pubkey}: {err}");
            }
        }
    }

    Ok(result)
}

fn parse_master_agreement(pubkey: &Pubkey, data: &[u8]) -> Result<MasterAgreementInfo> {
    let mut offset = 8usize;

    let master_id = read_u64(data, &mut offset)?;
    let leader = read_pubkey(data, &mut offset)?;
    let operator = read_pubkey(data, &mut offset)?;
    let currency_mint = read_pubkey(data, &mut offset)?;
    let coverage_start_ts = read_i64(data, &mut offset)?;
    let coverage_end_ts = read_i64(data, &mut offset)?;
    let premium_per_policy = read_u64(data, &mut offset)?;
    let payout_delay_2h = read_u64(data, &mut offset)?;
    let payout_delay_3h = read_u64(data, &mut offset)?;
    let payout_delay_4to5h = read_u64(data, &mut offset)?;
    let payout_delay_6h_or_cancelled = read_u64(data, &mut offset)?;
    let leader_share_bps = read_u16(data, &mut offset)?;
    let ceded_ratio_bps = read_u16(data, &mut offset)?;
    let reins_commission_bps = read_u16(data, &mut offset)?;
    let reinsurer_effective_bps = read_u16(data, &mut offset)?;
    let reinsurer = read_optional_pubkey(data, &mut offset)?;
    let reinsurer_confirmed = read_bool(data, &mut offset)?;
    let reinsurer_pool_wallet = read_optional_pubkey(data, &mut offset)?;
    let reinsurer_deposit_wallet = read_optional_pubkey(data, &mut offset)?;
    let leader_pool_wallet = read_pubkey(data, &mut offset)?;
    let leader_deposit_wallet = read_pubkey(data, &mut offset)?;
    let participants = read_master_participants(data, &mut offset)?;
    let oracle_feed = read_pubkey(data, &mut offset)?;
    let status = read_u8(data, &mut offset)?;
    let created_at = read_i64(data, &mut offset)?;
    let _bump = read_u8(data, &mut offset)?;

    Ok(MasterAgreementInfo {
        pubkey: pubkey.to_string(),
        master_id,
        leader: leader.to_string(),
        operator: operator.to_string(),
        currency_mint: currency_mint.to_string(),
        coverage_start_ts,
        coverage_end_ts,
        premium_per_policy,
        payout_delay_2h,
        payout_delay_3h,
        payout_delay_4to5h,
        payout_delay_6h_or_cancelled,
        leader_share_bps,
        ceded_ratio_bps,
        reins_commission_bps,
        reinsurer_effective_bps,
        reinsurer: reinsurer.map(|v| v.to_string()),
        reinsurer_confirmed,
        reinsurer_pool_wallet: reinsurer_pool_wallet.map(|v| v.to_string()),
        reinsurer_deposit_wallet: reinsurer_deposit_wallet.map(|v| v.to_string()),
        leader_pool_wallet: leader_pool_wallet.to_string(),
        leader_deposit_wallet: leader_deposit_wallet.to_string(),
        participants,
        oracle_feed: oracle_feed.to_string(),
        status,
        status_label: master_agreement_status_label(status).to_string(),
        created_at,
    })
}

fn parse_flight_policy(pubkey: &Pubkey, data: &[u8]) -> Result<FlightPolicyInfo> {
    let mut offset = 8usize;

    let child_policy_id = read_u64(data, &mut offset)?;
    let master = read_pubkey(data, &mut offset)?;
    let creator = read_pubkey(data, &mut offset)?;
    let subscriber_ref = read_string(data, &mut offset)?;
    let flight_no = read_string(data, &mut offset)?;
    let route = read_string(data, &mut offset)?;
    let departure_ts = read_i64(data, &mut offset)?;
    let premium_paid = read_u64(data, &mut offset)?;
    let delay_minutes = read_u16(data, &mut offset)?;
    let cancelled = read_bool(data, &mut offset)?;
    let payout_amount = read_u64(data, &mut offset)?;
    let status = read_u8(data, &mut offset)?;
    let premium_distributed = read_bool(data, &mut offset)?;
    let created_at = read_i64(data, &mut offset)?;
    let updated_at = read_i64(data, &mut offset)?;
    let _bump = read_u8(data, &mut offset)?;

    Ok(FlightPolicyInfo {
        pubkey: pubkey.to_string(),
        child_policy_id,
        master: master.to_string(),
        creator: creator.to_string(),
        subscriber_ref,
        flight_no,
        route,
        departure_ts,
        premium_paid,
        delay_minutes,
        cancelled,
        payout_amount,
        status,
        status_label: flight_policy_status_label(status).to_string(),
        premium_distributed,
        created_at,
        updated_at,
    })
}

fn read_bool(data: &[u8], offset: &mut usize) -> Result<bool> {
    Ok(read_u8(data, offset)? != 0)
}

fn read_optional_pubkey(data: &[u8], offset: &mut usize) -> Result<Option<Pubkey>> {
    let tag = read_u8(data, offset)?;
    match tag {
        0 => Ok(None),
        1 => Ok(Some(read_pubkey(data, offset)?)),
        _ => anyhow::bail!("invalid Option<Pubkey> tag: {tag}"),
    }
}

fn read_master_participants(
    data: &[u8],
    offset: &mut usize,
) -> Result<Vec<MasterAgreementParticipantInfo>> {
    let len = read_vec_len(data, offset)?;
    let mut participants = Vec::with_capacity(len);

    for _ in 0..len {
        let insurer = read_pubkey(data, offset)?;
        let share_bps = read_u16(data, offset)?;
        let confirmed = read_bool(data, offset)?;
        let pool_wallet = read_pubkey(data, offset)?;
        let deposit_wallet = read_pubkey(data, offset)?;

        participants.push(MasterAgreementParticipantInfo {
            insurer: insurer.to_string(),
            share_bps,
            confirmed,
            pool_wallet: pool_wallet.to_string(),
            deposit_wallet: deposit_wallet.to_string(),
        });
    }

    Ok(participants)
}

fn read_vec_len(data: &[u8], offset: &mut usize) -> Result<usize> {
    let len_bytes: [u8; 4] = data[*offset..*offset + 4]
        .try_into()
        .context("Vec 길이 읽기 실패")?;
    *offset += 4;
    Ok(u32::from_le_bytes(len_bytes) as usize)
}

fn master_agreement_status_label(status: u8) -> &'static str {
    match status {
        0 => "Draft",
        1 => "PendingConfirm",
        2 => "Active",
        3 => "Closed",
        4 => "Cancelled",
        _ => "Unknown",
    }
}

fn flight_policy_status_label(status: u8) -> &'static str {
    match status {
        0 => "Issued",
        1 => "AwaitingOracle",
        2 => "Claimable",
        3 => "Paid",
        4 => "NoClaim",
        5 => "Expired",
        _ => "Unknown",
    }
}

#[cfg(test)]
mod tests;
