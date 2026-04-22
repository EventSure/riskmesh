use std::collections::HashMap;

use tokio::sync::{broadcast, RwLock};

use crate::oracle::program_accounts::{FlightPolicyInfo, MasterAgreementInfo};

#[derive(Clone, Debug)]
pub(crate) struct SseMessage {
    pub(crate) event: String,
    pub(crate) data: String,
}

pub(crate) struct EventBus {
    tx: broadcast::Sender<SseMessage>,
    snapshot: RwLock<SnapshotState>,
}

#[derive(Default)]
struct SnapshotState {
    initialized: bool,
    agreements: HashMap<String, MasterAgreementInfo>,
    flights: HashMap<String, FlightPolicyInfo>,
}

impl EventBus {
    pub(crate) fn new(buffer: usize) -> Self {
        let (tx, _) = broadcast::channel(buffer);
        Self {
            tx,
            snapshot: RwLock::new(SnapshotState::default()),
        }
    }

    pub(crate) fn subscribe(&self) -> broadcast::Receiver<SseMessage> {
        self.tx.subscribe()
    }

    pub(crate) async fn publish_agreement_updates(
        &self,
        master_agreements: &[MasterAgreementInfo],
        flight_policies: &[FlightPolicyInfo],
    ) {
        let mut snapshot = self.snapshot.write().await;

        if !snapshot.initialized {
            snapshot.agreements = master_agreements
                .iter()
                .cloned()
                .map(|policy| (policy.pubkey.clone(), policy))
                .collect();
            snapshot.flights = flight_policies
                .iter()
                .cloned()
                .map(|policy| (policy.pubkey.clone(), policy))
                .collect();
            snapshot.initialized = true;
            return;
        }

        for policy in master_agreements {
            let changed = snapshot
                .agreements
                .get(&policy.pubkey)
                .map(|prev| prev != policy)
                .unwrap_or(true);

            if changed {
                // TODO: SSE event name is consumed outside backend; rename with frontend contract update.
                self.send_json("master_agreement_updated", policy);
            }
        }

        for policy in flight_policies {
            let changed = snapshot
                .flights
                .get(&policy.pubkey)
                .map(|prev| prev != policy)
                .unwrap_or(true);

            if changed {
                self.send_json("flight_policy_updated", policy);
            }
        }

        snapshot.agreements = master_agreements
            .iter()
            .cloned()
            .map(|policy| (policy.pubkey.clone(), policy))
            .collect();
        snapshot.flights = flight_policies
            .iter()
            .cloned()
            .map(|policy| (policy.pubkey.clone(), policy))
            .collect();
    }

    fn send_json<T: serde::Serialize>(&self, event: &str, payload: &T) {
        match serde_json::to_string(payload) {
            Ok(data) => {
                let _ = self.tx.send(SseMessage {
                    event: event.to_string(),
                    data,
                });
            }
            Err(error) => {
                tracing::warn!("[events] SSE payload 직렬화 실패 ({event}): {error}");
            }
        }
    }
}

#[cfg(test)]
mod tests;
