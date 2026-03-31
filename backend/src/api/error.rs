use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};

pub(super) struct ApiError(pub anyhow::Error);

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "error": self.0.to_string(),
            })),
        )
            .into_response()
    }
}
