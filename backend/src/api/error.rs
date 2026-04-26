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
        } else if is_bad_request_error(&message) {
            StatusCode::BAD_REQUEST
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

fn is_bad_request_error(message: &str) -> bool {
    let lower = message.to_ascii_lowercase();
    lower.contains("validation error:")
        || message.contains("주소 파싱 실패")
        || lower.contains("parse failed")
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::to_bytes;

    #[tokio::test]
    async fn api_error_maps_validation_errors_to_bad_request() {
        let response = ApiError(anyhow::anyhow!(
            "validation error: display_name cannot be empty"
        ))
        .into_response();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(
            payload["error"],
            "validation error: display_name cannot be empty"
        );
    }

    #[tokio::test]
    async fn api_error_maps_pubkey_parse_failures_to_bad_request() {
        let response = ApiError(anyhow::anyhow!(
            "master_policy_pubkey 주소 파싱 실패: invalid pubkey"
        ))
        .into_response();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(
            payload["error"],
            "master_policy_pubkey 주소 파싱 실패: invalid pubkey"
        );
    }
}
