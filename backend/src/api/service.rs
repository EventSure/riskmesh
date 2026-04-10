use anyhow::{Context, Result};
use axum::response::sse::{Event, Sse};
use futures_util::{stream::select, Stream, StreamExt};
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::Signer;
use std::{convert::Infallible, str::FromStr, sync::Arc, time::Duration};
use tokio::time::{interval_at, Instant};
use tokio_stream::wrappers::{BroadcastStream, IntervalStream};

use crate::{
    config::Config,
    events::{EventBus, SseMessage},
    oracle::program_accounts::{fetch_master_policy, scan_flight_policies, scan_master_policies},
    solana::client::SolanaClient,
};

use super::{
    client::ProgramClient,
    repository::PolicyRepository,
    types::{
        CreateFlightPolicyParamsWire, CreateFlightPolicyRequest, CreateFlightPolicyResponse,
        EventsQuery, FlightPoliciesQuery, FlightPoliciesResponse,
        HealthResponse, MasterFlightPoliciesResponse, MasterPoliciesQuery, MasterPoliciesResponse,
        MasterPoliciesTreeResponse, MasterPolicyAccountTree, MasterPolicyAccountsResponse,
    },
};

pub(super) fn health_response(config: &Config) -> HealthResponse {
    HealthResponse {
        status: "ok",
        rpc_url: config.rpc_url.clone(),
        leader_pubkey: config.leader_pubkey.to_string(),
    }
}

pub(super) fn stream_events(
    event_bus: Arc<EventBus>,
    query: EventsQuery,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let updates = BroadcastStream::new(event_bus.subscribe()).filter_map(move |message| {
        let master_filter = query.master.clone();
        async move {
            match message {
                Ok(message) if message_matches_filter(&message, master_filter.as_deref()) => {
                    Some(Ok(Event::default().event(message.event).data(message.data)))
                }
                Ok(_) => None,
                Err(_) => None,
            }
        }
    });

    let heartbeats = IntervalStream::new(interval_at(
        Instant::now() + Duration::from_secs(30),
        Duration::from_secs(30),
    ))
    .map(|_| {
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        Ok(Event::default()
            .event("heartbeat")
            .data(format!(r#"{{"ts":{ts}}}"#)))
    });

    Sse::new(select(updates, heartbeats))
}

pub(super) async fn list_master_policies(
    repository: &dyn PolicyRepository,
    query: &MasterPoliciesQuery,
) -> Result<MasterPoliciesResponse> {
    let master_policies = repository.list_master_policies().await?;
    let master_policies = master_policies
        .into_iter()
        .filter(|mp| {
            if let Some(leader) = query.leader.as_deref() {
                return mp.leader == leader;
            }
            if let Some(wallet) = query.wallet.as_deref() {
                return mp.leader == wallet
                    || mp.reinsurer == wallet
                    || mp.participants.iter().any(|p| p.insurer == wallet);
            }
            true
        })
        .collect();

    Ok(MasterPoliciesResponse { master_policies })
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

pub(super) async fn get_master_policy(
    repository: &dyn PolicyRepository,
    master_policy_pubkey: &str,
) -> Result<crate::oracle::program_accounts::MasterPolicyInfo> {
    let master_policy = repository
        .get_master_policy(master_policy_pubkey)
        .await?
        .ok_or_else(|| anyhow::anyhow!("account not found"))?;

    Ok(master_policy)
}

pub(super) async fn create_db_test_document(
    repository: &dyn PolicyRepository,
) -> Result<serde_json::Value> {
    // 간단한 DB 연결 테스트 — list_master_policies 호출로 확인
    let master_policies = repository.list_master_policies().await?;
    Ok(serde_json::json!({
        "status": "ok",
        "master_policy_count": master_policies.len(),
    }))
}

pub(super) async fn list_flight_policies(
    repository: &dyn PolicyRepository,
    query: &FlightPoliciesQuery,
) -> Result<FlightPoliciesResponse> {
    let flight_policies = repository.list_flight_policies().await?;
    let flight_policies = flight_policies
        .into_iter()
        .filter(|flight_policy| {
            let master_matches = query
                .master
                .as_deref()
                .map(|master| flight_policy.master == master)
                .unwrap_or(true);
            let status_matches = query
                .status
                .map(|status| flight_policy.status == status)
                .unwrap_or(true);
            master_matches && status_matches
        })
        .collect();

    Ok(FlightPoliciesResponse { flight_policies })
}

pub(super) async fn get_flight_policy(
    repository: &dyn PolicyRepository,
    flight_policy_pubkey: &str,
) -> Result<crate::oracle::program_accounts::FlightPolicyInfo> {
    let flight_policy = repository
        .get_flight_policy(flight_policy_pubkey)
        .await?
        .ok_or_else(|| anyhow::anyhow!("account not found"))?;

    Ok(flight_policy)
}

pub(super) async fn list_flight_policies_by_master(
    repository: &dyn PolicyRepository,
    config: &Config,
    master_policy_pubkey: &Pubkey,
) -> Result<MasterFlightPoliciesResponse> {
    let master_policy_key = master_policy_pubkey.to_string();
    let _master_policy = repository
        .get_master_policy(&master_policy_key)
        .await?
        .ok_or_else(|| anyhow::anyhow!("account not found"))?;
    let flight_policies = repository.list_flight_policies().await?;

    let flight_policies = flight_policies
        .into_iter()
        .filter(|flight_policy| flight_policy.master == master_policy_key)
        .collect::<Vec<_>>();

    Ok(MasterFlightPoliciesResponse {
        program_id: config.program_id.to_string(),
        master_policy_pubkey: master_policy_key,
        count: flight_policies.len(),
        flight_policies,
    })
}

pub(super) async fn list_master_policies_tree(
    repository: &dyn PolicyRepository,
    config: &Config,
) -> Result<MasterPoliciesTreeResponse> {
    let master_policies = repository.list_master_policies().await?;
    let flight_policies = repository.list_flight_policies().await?;

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

    let child_policy_id = scan_flight_policies(client, &config.program_id)
        .context("FlightPolicy 조회 실패")?
        .into_iter()
        .filter(|flight_policy| flight_policy.master == master_policy_pubkey.to_string())
        .map(|flight_policy| flight_policy.child_policy_id)
        .max()
        .map(|max_id| {
            max_id
                .checked_add(1)
                .ok_or_else(|| anyhow::anyhow!("child_policy_id가 u64 범위를 초과했습니다"))
        })
        .transpose()?
        .unwrap_or(1);

    let leader = program_client.load_leader_signer()?;
    let flight_policy_pubkey =
        program_client.derive_flight_policy_pubkey(master_policy_pubkey, child_policy_id);
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
            child_policy_id,
            subscriber_ref: req.subscriber_ref,
            flight_no: req.flight_no,
            route: req.route,
            departure_ts: req.departure_ts,
        },
    )?;

    Ok(CreateFlightPolicyResponse {
        program_id: config.program_id.to_string(),
        master_policy_pubkey: master_policy_pubkey.to_string(),
        child_policy_id,
        flight_policy_pubkey: flight_policy_pubkey.to_string(),
        tx_signature,
    })
}

fn parse_pubkey(field_name: &str, value: &str) -> Result<Pubkey> {
    Pubkey::from_str(value).with_context(|| format!("{field_name} 주소 파싱 실패: {value}"))
}

fn message_matches_filter(message: &SseMessage, master_filter: Option<&str>) -> bool {
    let Some(master_filter) = master_filter else {
        return true;
    };

    let parsed = serde_json::from_str::<serde_json::Value>(&message.data);
    let Ok(json) = parsed else {
        tracing::warn!(
            "[events] SSE payload 필터링 JSON 파싱 실패: {}",
            message.event
        );
        return false;
    };

    match message.event.as_str() {
        "flight_policy_updated" => json
            .get("master")
            .and_then(|value| value.as_str())
            .map(|master| master == master_filter)
            .unwrap_or(false),
        "master_policy_updated" => json
            .get("pubkey")
            .and_then(|value| value.as_str())
            .map(|pubkey| pubkey == master_filter)
            .unwrap_or(false),
        _ => true,
    }
}
