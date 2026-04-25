// 인스트럭션별 실행 로직 모듈
pub mod activate_master;
pub mod check_oracle_and_resolve_flight;
pub mod confirm_master;
pub mod create_flight_policy_from_master;
pub mod create_master_agreement;
pub mod register_participant_wallets;
pub mod resolve_flight_delay;
pub mod settle_flight_claim;
pub mod settle_flight_no_claim;

// 인스트럭션별 단위 테스트 모듈
#[cfg(test)]
mod activate_master_test;
#[cfg(test)]
mod confirm_master_test;
#[cfg(test)]
mod create_flight_policy_test;
#[cfg(test)]
mod create_master_agreement_test;
#[cfg(test)]
mod register_participant_wallets_test;
#[cfg(test)]
mod resolve_flight_delay_test;
#[cfg(test)]
mod settle_flight_claim_test;
#[cfg(test)]
mod settle_flight_no_claim_test;

#[allow(ambiguous_glob_reexports)]
pub use activate_master::*;
#[allow(ambiguous_glob_reexports)]
pub use check_oracle_and_resolve_flight::*;
#[allow(ambiguous_glob_reexports)]
pub use confirm_master::*;
#[allow(ambiguous_glob_reexports)]
pub use create_flight_policy_from_master::*;
#[allow(ambiguous_glob_reexports)]
pub use create_master_agreement::*;
#[allow(ambiguous_glob_reexports)]
pub use register_participant_wallets::*;
#[allow(ambiguous_glob_reexports)]
pub use resolve_flight_delay::*;
#[allow(ambiguous_glob_reexports)]
pub use settle_flight_claim::*;
#[allow(ambiguous_glob_reexports)]
pub use settle_flight_no_claim::*;
