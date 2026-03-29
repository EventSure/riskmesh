use anyhow::{Context, Result};
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::Signer;
use std::str::FromStr;

use crate::{
    config::Config,
    oracle::program_accounts::{
        fetch_flight_policy, fetch_master_policy, scan_flight_policies, scan_master_policies,
    },
    solana::client::SolanaClient,
};

use super::{
    client::ProgramClient,
    repository::FirebaseRepository,
    types::{
        CreateFlightPolicyParamsWire, CreateFlightPolicyRequest, CreateFlightPolicyResponse,
        FirebaseTestDocumentResponse, FlightPoliciesResponse, FlightPolicyResponse, HealthResponse,
        MasterFlightPoliciesResponse,
        MasterPoliciesResponse, MasterPoliciesTreeResponse, MasterPolicyAccountTree,
        MasterPolicyAccountsResponse, MasterPolicyResponse,
    },
};

pub(super) fn health_response(config: &Config) -> HealthResponse {
    HealthResponse {
        status: "ok",
        service: "riskmesh-backend",
        rpc_url: config.rpc_url.clone(),
        leader_pubkey: config.leader_pubkey.to_string(),
    }
}

pub(super) fn list_master_policies(
    client: &SolanaClient,
    config: &Config,
) -> Result<MasterPoliciesResponse> {
    let master_policies =
        scan_master_policies(client, &config.program_id).context("MasterPolicy 조회 실패")?;

    Ok(MasterPoliciesResponse {
        program_id: config.program_id.to_string(),
        count: master_policies.len(),
        master_policies,
    })
}

pub(super) fn list_master_policy_accounts(
    client: &SolanaClient,
    config: &Config,
) -> Result<MasterPolicyAccountsResponse> {
    let master_policy_pubkeys = scan_master_policies(client, &config.program_id)
        .context("MasterPolicy 조회 실패")?
        .into_iter()
        .map(|master_policy| master_policy.pubkey)
        .collect::<Vec<_>>();

    Ok(MasterPolicyAccountsResponse {
        program_id: config.program_id.to_string(),
        count: master_policy_pubkeys.len(),
        master_policy_pubkeys,
    })
}

pub(super) fn get_master_policy(
    client: &SolanaClient,
    config: &Config,
    master_policy_pubkey: &Pubkey,
) -> Result<MasterPolicyResponse> {
    let master_policy =
        fetch_master_policy(client, master_policy_pubkey).context("MasterPolicy 조회 실패")?;

    Ok(MasterPolicyResponse {
        program_id: config.program_id.to_string(),
        master_policy,
    })
}

pub(super) async fn create_firebase_test_document(
) -> Result<FirebaseTestDocumentResponse> {
    let saved = FirebaseRepository::from_env()?
        .insert_test_document()
        .await?;

    Ok(FirebaseTestDocumentResponse {
        firebase_saved: true,
        collection_id: saved.collection_id,
        document_id: saved.document_id,
        firebase_document_path: saved.document.name,
        auth_principal: saved.auth_local_id,
    })
}

pub(super) fn list_flight_policies(
    client: &SolanaClient,
    config: &Config,
) -> Result<FlightPoliciesResponse> {
    let flight_policies =
        scan_flight_policies(client, &config.program_id).context("FlightPolicy 조회 실패")?;

    Ok(FlightPoliciesResponse {
        program_id: config.program_id.to_string(),
        count: flight_policies.len(),
        flight_policies,
    })
}

pub(super) fn get_flight_policy(
    client: &SolanaClient,
    config: &Config,
    flight_policy_pubkey: &Pubkey,
) -> Result<FlightPolicyResponse> {
    let flight_policy =
        fetch_flight_policy(client, flight_policy_pubkey).context("FlightPolicy 조회 실패")?;

    Ok(FlightPolicyResponse {
        program_id: config.program_id.to_string(),
        flight_policy,
    })
}

pub(super) fn list_flight_policies_by_master(
    client: &SolanaClient,
    config: &Config,
    master_policy_pubkey: &Pubkey,
) -> Result<MasterFlightPoliciesResponse> {
    let _master_policy =
        fetch_master_policy(client, master_policy_pubkey).context("MasterPolicy 조회 실패")?;
    let flight_policies =
        scan_flight_policies(client, &config.program_id).context("FlightPolicy 조회 실패")?;

    let flight_policies = flight_policies
        .into_iter()
        .filter(|flight_policy| flight_policy.master == master_policy_pubkey.to_string())
        .collect::<Vec<_>>();

    Ok(MasterFlightPoliciesResponse {
        program_id: config.program_id.to_string(),
        master_policy_pubkey: master_policy_pubkey.to_string(),
        count: flight_policies.len(),
        flight_policies,
    })
}

pub(super) fn list_master_policies_tree(
    client: &SolanaClient,
    config: &Config,
) -> Result<MasterPoliciesTreeResponse> {
    let master_policies =
        scan_master_policies(client, &config.program_id).context("MasterPolicy 조회 실패")?;
    let flight_policies =
        scan_flight_policies(client, &config.program_id).context("FlightPolicy 조회 실패")?;

    let master_policies = master_policies
        .into_iter()
        .map(|master_policy| {
            let flight_policy_pubkeys = flight_policies
                .iter()
                .filter(|flight_policy| flight_policy.master == master_policy.pubkey)
                .map(|flight_policy| flight_policy.pubkey.clone())
                .collect();

            MasterPolicyAccountTree {
                master_policy_pubkey: master_policy.pubkey,
                flight_policy_pubkeys,
            }
        })
        .collect::<Vec<_>>();

    Ok(MasterPoliciesTreeResponse {
        program_id: config.program_id.to_string(),
        count: master_policies.len(),
        master_policies,
    })
}

pub(super) fn create_flight_policy(
    client: &SolanaClient,
    config: &Config,
    master_policy_pubkey: &Pubkey,
    req: CreateFlightPolicyRequest,
) -> Result<CreateFlightPolicyResponse> {
    let program_client = ProgramClient::new(client, config);

    let master_policy =
        fetch_master_policy(client, master_policy_pubkey).context("MasterPolicy 조회 실패")?;

    if master_policy.status_label != "Active" {
        anyhow::bail!(
            "MasterPolicy가 Active 상태가 아닙니다: status={}",
            master_policy.status_label
        );
    }

    if master_policy.leader != config.leader_pubkey.to_string()
        && master_policy.operator != config.leader_pubkey.to_string()
    {
        anyhow::bail!("현재 서버 키는 이 MasterPolicy의 leader/operator 권한이 없습니다");
    }

    if req.subscriber_ref.is_empty() || req.flight_no.is_empty() || req.route.is_empty() {
        anyhow::bail!("subscriber_ref, flight_no, route는 비어 있을 수 없습니다");
    }

    let leader = program_client.load_leader_signer()?;
    let flight_policy_pubkey =
        program_client.derive_flight_policy_pubkey(master_policy_pubkey, req.child_policy_id);
    let currency_mint = parse_pubkey("currency_mint", &master_policy.currency_mint)
        .context("currency_mint 파싱 실패")?;
    let payer_token_pubkey =
        program_client.derive_associated_token_account_pubkey(&leader.pubkey(), &currency_mint);
    let leader_deposit_token = Pubkey::from_str(&master_policy.leader_deposit_wallet)
        .context("leader_deposit_wallet 주소 파싱 실패")?;

    let tx_signature = program_client.create_flight_policy(
        &leader,
        master_policy_pubkey,
        &flight_policy_pubkey,
        &payer_token_pubkey,
        &leader_deposit_token,
        CreateFlightPolicyParamsWire {
            child_policy_id: req.child_policy_id,
            subscriber_ref: req.subscriber_ref,
            flight_no: req.flight_no,
            route: req.route,
            departure_ts: req.departure_ts,
        },
    )?;

    Ok(CreateFlightPolicyResponse {
        program_id: config.program_id.to_string(),
        master_policy_pubkey: master_policy_pubkey.to_string(),
        flight_policy_pubkey: flight_policy_pubkey.to_string(),
        tx_signature,
    })
}

fn parse_pubkey(field_name: &str, value: &str) -> Result<Pubkey> {
    Pubkey::from_str(value).with_context(|| format!("{field_name} 주소 파싱 실패: {value}"))
}
