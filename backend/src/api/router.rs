use axum::{
    routing::get,
    Router,
};

use super::{handlers::*, state::AppState};

pub(super) fn build_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/api/master-policies", get(get_master_policies))
        .route("/api/flight-policies", get(get_flight_policies))
        .route("/api/master-policies/tree", get(get_master_policies_tree))
        .route(
            "/api/master-policies/:master_policy_pubkey/flight-policies",
            get(get_flight_policies_by_master).post(post_flight_policy),
        )
        .with_state(state)
}
