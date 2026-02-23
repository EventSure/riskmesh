pub const DELAY_THRESHOLD_MIN: u16 = 120;
pub const ORACLE_MAX_STALENESS_SLOTS: u64 = 150; // approx 60-90s depending on cluster
pub const MAX_PARTICIPANTS: usize = 16;
pub const MAX_POLICYHOLDERS: usize = 128;

pub const MAX_ROUTE_LEN: usize = 16;
pub const MAX_FLIGHT_NO_LEN: usize = 16;
pub const MAX_EXTERNAL_REF_LEN: usize = 32;

pub const POLICY_SPACE: usize = 260;
pub const UNDERWRITING_SPACE: usize = 1292;
pub const RISK_POOL_SPACE: usize = 122;
pub const CLAIM_SPACE: usize = 106;
pub const REGISTRY_SPACE: usize = 13000;
