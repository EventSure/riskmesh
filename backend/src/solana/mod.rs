pub mod client;
pub mod pda;

/// Anchor 계정 discriminator: sha256("account:<AccountName>")[..8]
/// 런타임에 계산하지 않고 상수로 미리 정의한다.
pub mod discriminators {
    /// sha256("account:Policy")[..8]
    pub const POLICY: [u8; 8] = [222, 135, 7, 163, 235, 177, 33, 68];
    /// sha256("account:FlightPolicy")[..8]
    pub const FLIGHT_POLICY: [u8; 8] = [53, 42, 54, 221, 74, 119, 109, 25];
}

/// Track B Policy.state 오프셋 (8 discriminator + Policy 필드 순서로 계산)
/// Policy { policy_id:8, leader:32, route:4+str, flight_no:4+str, departure_date:8,
///          delay_threshold_min:2, payout_amount:8, currency_mint:32, oracle_feed:32,
///          state:1, ... }
/// 가변 길이 필드(route, flight_no)가 앞에 있어 오프셋이 가변적.
/// → discriminator 필터로 후보를 좁힌 후 클라이언트에서 역직렬화로 state 확인.
pub const POLICY_STATE_ACTIVE: u8 = 3;

/// Track A FlightPolicy.status
pub const FLIGHT_POLICY_STATUS_ISSUED: u8 = 0;
pub const FLIGHT_POLICY_STATUS_AWAITING_ORACLE: u8 = 1;
pub const FLIGHT_POLICY_STATUS_CLAIMABLE: u8 = 2;
pub const FLIGHT_POLICY_STATUS_NO_CLAIM: u8 = 4;

/// Track B Policy.state (Claimable)
pub const POLICY_STATE_CLAIMABLE: u8 = 4;
