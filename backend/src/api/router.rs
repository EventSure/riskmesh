use axum::{
    routing::{get, post},
    Router,
};

use super::{handlers::*, state::AppState};

pub(super) fn build_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        // TODO: route paths are consumed outside backend; rename with frontend contract update.
        .route("/api/master-policies", get(get_master_agreements))
        .route("/api/master-policies/accounts", get(get_master_agreement_accounts))
        .route("/api/master-policies/:master_policy_pubkey", get(get_master_agreement))
        .route("/api/events", get(get_events))
        .route("/api/flight-policies", get(get_flight_policies))
        .route("/api/flight-policies/:flight_policy_pubkey", get(get_flight_policy))
        .route("/api/master-policies/tree", get(get_master_agreements_tree))
        .route("/api/db/test", post(post_db_test))
        .route(
            "/api/master-policies/:master_policy_pubkey/flight-policies",
            get(get_flight_policies_by_master_agreement).post(post_flight_policy),
        )
        .with_state(state)
}
