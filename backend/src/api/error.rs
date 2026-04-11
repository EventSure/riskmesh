use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};

pub(super) struct ApiError(pub anyhow::Error);

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let error = self.0;
        let message = error.to_string();
        let status = if is_not_found_error(&message) {
            StatusCode::NOT_FOUND
        } else {
            StatusCode::INTERNAL_SERVER_ERROR
        };

        let error_chain = format!("{error:#}");
        if status.is_server_error() {
            tracing::error!(status = %status, error = %error_chain, "API 요청 처리 실패");
        } else if status.is_client_error() {
            tracing::warn!(status = %status, error = %error_chain, "API 요청 처리 실패");
        }

        let error_message = if status == StatusCode::NOT_FOUND {
            "account not found".to_string()
        } else {
            message
        };

        (
            status,
            Json(serde_json::json!({
                "error": error_message,
            })),
        )
            .into_response()
    }
}

fn is_not_found_error(message: &str) -> bool {
    let lower = message.to_ascii_lowercase();
    lower.contains("accountnotfound")
        || lower.contains("account not found")
        || lower.contains("could not find account")
}
