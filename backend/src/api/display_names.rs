use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) struct ParticipantDisplayName {
    pub wallet: String,
    pub display_name: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) struct ReinsurerDisplayName {
    pub wallet: String,
    pub display_name: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) struct MasterAgreementDisplayNames {
    pub master_policy_pubkey: String,
    pub participants: Vec<ParticipantDisplayName>,
    pub reinsurer: Option<ReinsurerDisplayName>,
}
