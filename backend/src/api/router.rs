use axum::{
    body::Body,
    http::Request,
    middleware::{self, Next},
    response::Response,
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
        .layer(middleware::from_fn(log_error_responses))
        .with_state(state)
}

async fn log_error_responses(request: Request<Body>, next: Next) -> Response {
    let method = request.method().clone();
    let uri = request.uri().clone();
    let response = next.run(request).await;
    let status = response.status();

    if status.is_server_error() {
        tracing::error!(%method, %uri, %status, "API 에러 응답");
    } else if status.is_client_error() {
        tracing::warn!(%method, %uri, %status, "API 에러 응답");
    }

    response
}
