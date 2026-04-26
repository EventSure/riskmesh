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
    oracle::program_accounts::{
        fetch_master_agreement, scan_flight_policies, scan_master_agreements,
    },
    solana::client::SolanaClient,
};

use super::{
    client::ProgramClient,
    repository::{InsuranceRepository, MasterAgreementDisplayNames},
    types::{
        CreateFlightPolicyParamsWire, CreateFlightPolicyRequest, CreateFlightPolicyResponse,
        EventsQuery, FlightPoliciesQuery, FlightPoliciesResponse, HealthResponse,
        MasterAgreementAccountTree, MasterAgreementAccountsResponse,
        MasterAgreementDisplayNamesResponse, MasterAgreementFlightPoliciesResponse,
        MasterAgreementsQuery, MasterAgreementsResponse, MasterAgreementsTreeResponse,
        ParticipantDisplayNamePayload, PutMasterAgreementDisplayNamesRequest,
        ReinsurerDisplayNamePayload,
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

pub(super) async fn list_master_agreements(
    repository: &dyn InsuranceRepository,
    query: &MasterAgreementsQuery,
) -> Result<MasterAgreementsResponse> {
    let master_agreements = repository.list_master_agreements().await?;
    let master_agreements = master_agreements
        .into_iter()
        .filter(|mp| {
            if let Some(leader) = query.leader.as_deref() {
                return mp.leader == leader;
            }
            if let Some(wallet) = query.wallet.as_deref() {
                return mp.leader == wallet
                    || mp.reinsurer.as_deref() == Some(wallet)
                    || mp.participants.iter().any(|p| p.insurer == wallet);
            }
            true
        })
        .collect();

    Ok(MasterAgreementsResponse { master_agreements })
}

pub(super) fn list_master_agreement_accounts(
    client: &SolanaClient,
    config: &Config,
) -> Result<MasterAgreementAccountsResponse> {
    let master_agreement_pubkeys = scan_master_agreements(client, &config.program_id)
        .context("MasterAgreement 조회 실패")?
        .into_iter()
        .map(|master_agreement| master_agreement.pubkey)
        .collect::<Vec<_>>();

    Ok(MasterAgreementAccountsResponse {
        program_id: config.program_id.to_string(),
        count: master_agreement_pubkeys.len(),
        master_agreement_pubkeys,
    })
}

pub(super) async fn get_master_agreement(
    repository: &dyn InsuranceRepository,
    master_agreement_pubkey: &str,
) -> Result<crate::oracle::program_accounts::MasterAgreementInfo> {
    let master_agreement = repository
        .get_master_agreement(master_agreement_pubkey)
        .await?
        .ok_or_else(|| anyhow::anyhow!("account not found"))?;

    Ok(master_agreement)
}

pub(super) async fn get_master_agreement_display_names(
    repository: &dyn InsuranceRepository,
    master_policy_pubkey: &str,
) -> Result<MasterAgreementDisplayNamesResponse> {
    ensure_master_agreement_exists(repository, master_policy_pubkey).await?;

    let payload = repository
        .get_master_agreement_display_names(master_policy_pubkey)
        .await?
        .unwrap_or_else(|| MasterAgreementDisplayNames {
            master_policy_pubkey: master_policy_pubkey.to_string(),
            participants: Vec::new(),
            reinsurer: None,
        });

    Ok(display_names_response(payload))
}

pub(super) async fn put_master_agreement_display_names(
    repository: &dyn InsuranceRepository,
    master_policy_pubkey: &str,
    payload: PutMasterAgreementDisplayNamesRequest,
) -> Result<MasterAgreementDisplayNamesResponse> {
    ensure_master_agreement_exists(repository, master_policy_pubkey).await?;

    let stored_payload = MasterAgreementDisplayNames {
        master_policy_pubkey: master_policy_pubkey.to_string(),
        participants: payload
            .participants
            .into_iter()
            .map(|participant| {
                Ok(
                    crate::api::repository::display_names::ParticipantDisplayName {
                        wallet: participant.wallet,
                        display_name: validated_display_name(participant.display_name)?,
                    },
                )
            })
            .collect::<Result<Vec<_>>>()?,
        reinsurer: match payload.reinsurer {
            Some(reinsurer) => Some(
                crate::api::repository::display_names::ReinsurerDisplayName {
                    wallet: reinsurer.wallet,
                    display_name: validated_display_name(reinsurer.display_name)?,
                },
            ),
            None => None,
        },
    };

    repository
        .put_master_agreement_display_names(&stored_payload)
        .await?;

    Ok(display_names_response(stored_payload))
}

pub(super) async fn create_db_test_document(
    repository: &dyn InsuranceRepository,
) -> Result<serde_json::Value> {
    // 간단한 DB 연결 테스트 — list_master_agreements 호출로 확인
    let master_agreements = repository.list_master_agreements().await?;
    Ok(serde_json::json!({
        "status": "ok",
        "master_agreement_count": master_agreements.len(),
    }))
}

pub(super) async fn list_flight_policies(
    repository: &dyn InsuranceRepository,
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
    repository: &dyn InsuranceRepository,
    flight_policy_pubkey: &str,
) -> Result<crate::oracle::program_accounts::FlightPolicyInfo> {
    let flight_policy = repository
        .get_flight_policy(flight_policy_pubkey)
        .await?
        .ok_or_else(|| anyhow::anyhow!("account not found"))?;

    Ok(flight_policy)
}

pub(super) async fn list_flight_policies_by_master_agreement(
    repository: &dyn InsuranceRepository,
    config: &Config,
    master_agreement_pubkey: &Pubkey,
) -> Result<MasterAgreementFlightPoliciesResponse> {
    let master_agreement_key = master_agreement_pubkey.to_string();
    let _master_agreement = repository
        .get_master_agreement(&master_agreement_key)
        .await?
        .ok_or_else(|| anyhow::anyhow!("account not found"))?;
    let flight_policies = repository.list_flight_policies().await?;

    let flight_policies = flight_policies
        .into_iter()
        .filter(|flight_policy| flight_policy.master == master_agreement_key)
        .collect::<Vec<_>>();

    Ok(MasterAgreementFlightPoliciesResponse {
        program_id: config.program_id.to_string(),
        master_agreement_pubkey: master_agreement_key,
        count: flight_policies.len(),
        flight_policies,
    })
}

pub(super) async fn list_master_agreements_tree(
    repository: &dyn InsuranceRepository,
    config: &Config,
) -> Result<MasterAgreementsTreeResponse> {
    let master_agreements = repository.list_master_agreements().await?;
    let flight_policies = repository.list_flight_policies().await?;

    let master_agreements = master_agreements
        .into_iter()
        .map(|master_agreement| {
            let flight_policy_pubkeys = flight_policies
                .iter()
                .filter(|flight_policy| flight_policy.master == master_agreement.pubkey)
                .map(|flight_policy| flight_policy.pubkey.clone())
                .collect();

            MasterAgreementAccountTree {
                master_agreement_pubkey: master_agreement.pubkey,
                flight_policy_pubkeys,
            }
        })
        .collect::<Vec<_>>();

    Ok(MasterAgreementsTreeResponse {
        program_id: config.program_id.to_string(),
        count: master_agreements.len(),
        master_agreements,
    })
}

pub(super) fn create_flight_policy(
    client: &SolanaClient,
    config: &Config,
    master_agreement_pubkey: &Pubkey,
    req: CreateFlightPolicyRequest,
) -> Result<CreateFlightPolicyResponse> {
    let program_client = ProgramClient::new(client, config);

    let master_agreement = fetch_master_agreement(client, master_agreement_pubkey)
        .context("MasterAgreement 조회 실패")?;

    if master_agreement.status_label != "Active" {
        anyhow::bail!(
            "MasterAgreement가 Active 상태가 아닙니다: status={}",
            master_agreement.status_label
        );
    }

    if master_agreement.leader != config.leader_pubkey.to_string()
        && master_agreement.operator != config.leader_pubkey.to_string()
    {
        anyhow::bail!("현재 서버 키는 이 MasterAgreement의 leader/operator 권한이 없습니다");
    }

    if req.subscriber_ref.is_empty() || req.flight_no.is_empty() || req.route.is_empty() {
        anyhow::bail!("subscriber_ref, flight_no, route는 비어 있을 수 없습니다");
    }

    let child_policy_id = scan_flight_policies(client, &config.program_id)
        .context("FlightPolicy 조회 실패")?
        .into_iter()
        .filter(|flight_policy| flight_policy.master == master_agreement_pubkey.to_string())
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
        program_client.derive_flight_policy_pubkey(master_agreement_pubkey, child_policy_id);
    let currency_mint = parse_pubkey("currency_mint", &master_agreement.currency_mint)
        .context("currency_mint 파싱 실패")?;
    let payer_token_pubkey =
        program_client.derive_associated_token_account_pubkey(&leader.pubkey(), &currency_mint);
    let leader_deposit_token = Pubkey::from_str(&master_agreement.leader_deposit_wallet)
        .context("leader_deposit_wallet 주소 파싱 실패")?;

    let tx_signature = program_client.create_flight_policy(
        &leader,
        master_agreement_pubkey,
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
        master_agreement_pubkey: master_agreement_pubkey.to_string(),
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
        "master_agreement_updated" => json
            .get("pubkey")
            .and_then(|value| value.as_str())
            .map(|pubkey| pubkey == master_filter)
            .unwrap_or(false),
        _ => true,
    }
}

fn display_names_response(
    payload: MasterAgreementDisplayNames,
) -> MasterAgreementDisplayNamesResponse {
    MasterAgreementDisplayNamesResponse {
        master_policy_pubkey: payload.master_policy_pubkey,
        participants: payload
            .participants
            .into_iter()
            .map(|participant| ParticipantDisplayNamePayload {
                wallet: participant.wallet,
                display_name: participant.display_name,
            })
            .collect(),
        reinsurer: payload
            .reinsurer
            .map(|reinsurer| ReinsurerDisplayNamePayload {
                wallet: reinsurer.wallet,
                display_name: reinsurer.display_name,
            }),
    }
}

fn validated_display_name(display_name: String) -> Result<String> {
    let trimmed = display_name.trim();
    if trimmed.is_empty() {
        anyhow::bail!("validation error: display_name cannot be empty");
    }

    Ok(trimmed.to_string())
}

async fn ensure_master_agreement_exists(
    repository: &dyn InsuranceRepository,
    master_policy_pubkey: &str,
) -> Result<()> {
    repository
        .get_master_agreement(master_policy_pubkey)
        .await?
        .ok_or_else(|| anyhow::anyhow!("account not found"))?;

    Ok(())
}

#[cfg(test)]
mod tests;
