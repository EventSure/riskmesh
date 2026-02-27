pub const DELAY_THRESHOLD_MIN: u16 = 120;
pub const ORACLE_MAX_STALENESS_SLOTS: u64 = 150; // approx 60-90s depending on cluster
pub const MAX_PARTICIPANTS: usize = 16;
pub const MAX_POLICYHOLDERS: usize = 128;

pub const MAX_ROUTE_LEN: usize = 16;
pub const MAX_FLIGHT_NO_LEN: usize = 16;
pub const MAX_EXTERNAL_REF_LEN: usize = 32;
pub const MAX_MASTER_PARTICIPANTS: usize = 8;
pub const MAX_SUBSCRIBER_REF_LEN: usize = 64;

pub const POLICY_SPACE: usize = 260;
pub const UNDERWRITING_SPACE: usize = 1292;
pub const RISK_POOL_SPACE: usize = 122;
pub const CLAIM_SPACE: usize = 106;
// create_policy에서 Policy(260)+UW(1292)+Pool(122)+Registry를 한 트랜잭션에 init.
// Solana CPI 내 누적 데이터 증가 한도 10240 bytes → Registry는 8566 이하여야 함.
pub const REGISTRY_SPACE: usize = 8192;

// Generous buffer to simplify migration; can be tightened after schema finalization.
pub const MASTER_POLICY_SPACE: usize = 4096;
pub const FLIGHT_POLICY_SPACE: usize = 1024;
