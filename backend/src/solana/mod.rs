pub mod client;
pub mod pda;

/// Anchor 계정 discriminator: sha256("account:<AccountName>")[..8]
/// 런타임에 계산하지 않고 상수로 미리 정의한다.
pub mod discriminators {
    /// sha256("account:FlightPolicy")[..8]
    pub const FLIGHT_POLICY: [u8; 8] = [53, 42, 54, 221, 74, 119, 109, 25];
}

/// FlightPolicy.status 상수 (Track A + B 공용)
pub const FLIGHT_POLICY_STATUS_ISSUED: u8 = 0;
pub const FLIGHT_POLICY_STATUS_AWAITING_ORACLE: u8 = 1;
