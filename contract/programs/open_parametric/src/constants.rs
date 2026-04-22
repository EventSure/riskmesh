pub const DELAY_THRESHOLD_MIN: u16 = 120;
pub const ORACLE_MAX_STALENESS_SLOTS: u64 = 150; // approx 60-90s depending on cluster

pub const MAX_ROUTE_LEN: usize = 16;
pub const MAX_FLIGHT_NO_LEN: usize = 16;
pub const MAX_MASTER_PARTICIPANTS: usize = 5; // 참여사 + 재보험사 합산 최대
pub const MAX_SUBSCRIBER_REF_LEN: usize = 64;

// oracle_feed(32 bytes) 추가됐지만 4096 버퍼로 충분.
pub const MASTER_POLICY_SPACE: usize = 4096;
pub const FLIGHT_POLICY_SPACE: usize = 1024;
