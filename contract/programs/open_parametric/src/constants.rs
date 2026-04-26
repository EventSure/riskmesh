pub const DELAY_THRESHOLD_MIN: u16 = 120;
pub const ORACLE_MAX_STALENESS_SLOTS: u64 = 150; // approx 60-90s depending on cluster

pub const MAX_ROUTE_LEN: usize = 16;
pub const MAX_FLIGHT_NO_LEN: usize = 16;
pub const MAX_MASTER_PARTICIPANTS: usize = 5;
pub const MASTER_AGREEMENT_NAME_MAX_LEN: usize = 40;
pub const MAX_SUBSCRIBER_REF_LEN: usize = 64;

pub const MASTER_POLICY_SPACE: usize = 8 + 1024 + 4 + MASTER_AGREEMENT_NAME_MAX_LEN * 4;
pub const FLIGHT_POLICY_SPACE: usize = 1024;
