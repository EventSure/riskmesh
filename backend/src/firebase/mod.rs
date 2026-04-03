use anyhow::{bail, Context, Result};
use jsonwebtoken::{Algorithm, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    fs,
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Debug, Clone)]
pub struct FirebaseConfig {
    pub project_id: String,
    pub firestore_database: String,
    pub test_collection: String,
    pub master_policies_collection: String,
    pub flight_policies_collection: String,
    pub sync_metadata_collection: String,
    service_account: GoogleServiceAccount,
}

impl FirebaseConfig {
    pub fn from_env() -> Result<Self> {
        load_dotenv();

        let service_account = load_service_account()?;

        Ok(Self {
            project_id: optional_nonempty_env("FIREBASE_PROJECT_ID")
                .unwrap_or_else(|| service_account.project_id.clone()),
            firestore_database: optional_env("FIREBASE_DATABASE", "(default)"),
            test_collection: optional_env("FIREBASE_TEST_COLLECTION", "riskmesh_test"),
            master_policies_collection: optional_env(
                "FIREBASE_MASTER_POLICIES_COLLECTION",
                "master_policies",
            ),
            flight_policies_collection: optional_env(
                "FIREBASE_FLIGHT_POLICIES_COLLECTION",
                "flight_policies",
            ),
            sync_metadata_collection: optional_env(
                "FIREBASE_SYNC_METADATA_COLLECTION",
                "sync_metadata",
            ),
            service_account,
        })
    }

    fn firestore_documents_base_url(&self) -> String {
        format!(
            "https://firestore.googleapis.com/v1/projects/{}/databases/{}/documents",
            self.project_id, self.firestore_database
        )
    }

    fn service_account(&self) -> &GoogleServiceAccount {
        &self.service_account
    }
}

#[derive(Clone)]
pub struct FirebaseClient {
    http: reqwest::Client,
    config: FirebaseConfig,
}

impl FirebaseClient {
    pub fn new(config: FirebaseConfig) -> Self {
        Self {
            http: reqwest::Client::new(),
            config,
        }
    }

    pub fn from_env() -> Result<Self> {
        Ok(Self::new(FirebaseConfig::from_env()?))
    }

    pub fn config(&self) -> &FirebaseConfig {
        &self.config
    }

    pub(crate) async fn resolve_auth(&self) -> Result<FirebaseWriteAuth> {
        Ok(FirebaseWriteAuth {
            access_token: self.fetch_access_token().await?,
            principal: self.config.service_account().client_email.clone(),
        })
    }

    pub(crate) async fn create_document(
        &self,
        access_token: &str,
        collection_id: &str,
        document_id: &str,
        fields: Value,
    ) -> Result<FirestoreDocument> {
        let url = format!(
            "{}/{}?documentId={}",
            self.config.firestore_documents_base_url(),
            collection_id,
            document_id
        );

        let response = self
            .http
            .post(url)
            .bearer_auth(access_token)
            .json(&json!({ "fields": fields }))
            .send()
            .await
            .context("Firestore 문서 생성 요청 실패")?;

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            bail!(
                "Firestore 문서 생성 실패: status={} body={}",
                status,
                body
            );
        }

        response
            .json::<FirestoreDocument>()
            .await
            .context("Firestore 문서 생성 응답 파싱 실패")
    }

    pub(crate) async fn upsert_document(
        &self,
        access_token: &str,
        document_path: &str,
        fields: Value,
    ) -> Result<FirestoreDocument> {
        let url = format!(
            "{}/{}",
            self.config.firestore_documents_base_url(),
            document_path
        );

        let response = self
            .http
            .patch(url)
            .bearer_auth(access_token)
            .json(&json!({ "fields": fields }))
            .send()
            .await
            .context("Firestore 문서 upsert 요청 실패")?;

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            bail!(
                "Firestore 문서 upsert 실패: status={} body={}",
                status,
                body
            );
        }

        response
            .json::<FirestoreDocument>()
            .await
            .context("Firestore 문서 upsert 응답 파싱 실패")
    }

    pub(crate) async fn get_document(
        &self,
        access_token: &str,
        document_path: &str,
    ) -> Result<Option<FirestoreDocument>> {
        let url = format!(
            "{}/{}",
            self.config.firestore_documents_base_url(),
            document_path
        );

        let response = self
            .http
            .get(url)
            .bearer_auth(access_token)
            .send()
            .await
            .context("Firestore 문서 조회 요청 실패")?;

        if response.status() == reqwest::StatusCode::NOT_FOUND {
            return Ok(None);
        }

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            bail!(
                "Firestore 문서 조회 실패: status={} body={}",
                status,
                body
            );
        }

        response
            .json::<FirestoreDocument>()
            .await
            .map(Some)
            .context("Firestore 문서 조회 응답 파싱 실패")
    }

    pub(crate) async fn list_documents(
        &self,
        access_token: &str,
        collection_id: &str,
    ) -> Result<Vec<FirestoreDocument>> {
        let mut documents = Vec::new();
        let mut page_token: Option<String> = None;

        loop {
            let mut url = format!(
                "{}/{}?pageSize=500",
                self.config.firestore_documents_base_url(),
                collection_id
            );
            if let Some(token) = &page_token {
                url.push_str("&pageToken=");
                url.push_str(token);
            }

            let response = self
                .http
                .get(&url)
                .bearer_auth(access_token)
                .send()
                .await
                .context("Firestore 목록 조회 요청 실패")?;

            let status = response.status();
            if !status.is_success() {
                let body = response.text().await.unwrap_or_default();
                bail!(
                    "Firestore 목록 조회 실패: status={} body={}",
                    status,
                    body
                );
            }

            let payload = response
                .json::<FirestoreListDocumentsResponse>()
                .await
                .context("Firestore 목록 조회 응답 파싱 실패")?;

            documents.extend(payload.documents);

            match payload.next_page_token {
                Some(token) if !token.is_empty() => page_token = Some(token),
                _ => break,
            }
        }

        Ok(documents)
    }

    async fn fetch_access_token(&self) -> Result<String> {
        let now = current_unix_seconds()?;
        let claims = ServiceAccountClaims {
            iss: self.config.service_account().client_email.clone(),
            scope: "https://www.googleapis.com/auth/datastore".to_string(),
            aud: self.config.service_account().token_uri.clone(),
            iat: now,
            exp: now + 3600,
        };

        let header = Header::new(Algorithm::RS256);
        let assertion = jsonwebtoken::encode(
            &header,
            &claims,
            &EncodingKey::from_rsa_pem(self.config.service_account().private_key.as_bytes())
                .context("service account private_key PEM 파싱 실패")?,
        )
        .context("service account JWT 생성 실패")?;

        let response = self
            .http
            .post(&self.config.service_account().token_uri)
            .form(&[
                ("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer"),
                ("assertion", assertion.as_str()),
            ])
            .send()
            .await
            .context("Google OAuth access token 요청 실패")?;

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            bail!(
                "Google OAuth access token 발급 실패: status={} body={}",
                status,
                body,
            );
        }

        let token = response
            .json::<GoogleAccessTokenResponse>()
            .await
            .context("Google OAuth access token 응답 파싱 실패")?;

        Ok(token.access_token)
    }
}

#[derive(Debug, Clone, Deserialize)]
struct GoogleServiceAccount {
    pub project_id: String,
    pub private_key: String,
    pub client_email: String,
    #[serde(default = "default_token_uri")]
    pub token_uri: String,
}

#[derive(Debug, Serialize)]
struct ServiceAccountClaims {
    iss: String,
    scope: String,
    aud: String,
    iat: u64,
    exp: u64,
}

#[derive(Debug, Deserialize)]
struct GoogleAccessTokenResponse {
    access_token: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct FirestoreDocument {
    pub name: String,
    #[serde(default)]
    pub fields: Value,
    #[serde(rename = "createTime")]
    pub create_time: Option<String>,
    #[serde(rename = "updateTime")]
    pub update_time: Option<String>,
}

#[derive(Debug, Deserialize)]
struct FirestoreListDocumentsResponse {
    #[serde(default)]
    documents: Vec<FirestoreDocument>,
    #[serde(rename = "nextPageToken")]
    next_page_token: Option<String>,
}

pub(crate) struct FirebaseWriteAuth {
    pub(crate) access_token: String,
    pub(crate) principal: String,
}

fn optional_env(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.to_string())
}

fn optional_nonempty_env(key: &str) -> Option<String> {
    std::env::var(key).ok().filter(|value| !value.trim().is_empty())
}

fn load_dotenv() {
    dotenv::dotenv().ok();
    dotenv::from_filename("backend/.env").ok();
}

fn load_service_account() -> Result<GoogleServiceAccount> {
    if let Some(json) = optional_nonempty_env("FIREBASE_SERVICE_ACCOUNT_JSON") {
        return serde_json::from_str(&json)
            .context("FIREBASE_SERVICE_ACCOUNT_JSON 파싱 실패");
    }

    if let Some(path) = optional_nonempty_env("FIREBASE_SERVICE_ACCOUNT_PATH") {
        let raw = fs::read_to_string(&path)
            .with_context(|| format!("service account 파일 읽기 실패: {path}"))?;
        return serde_json::from_str(&raw)
            .with_context(|| format!("service account JSON 파싱 실패: {path}"));
    }

    bail!(
        "FIREBASE_SERVICE_ACCOUNT_JSON 또는 FIREBASE_SERVICE_ACCOUNT_PATH 환경변수 필요"
    )
}

fn current_unix_seconds() -> Result<u64> {
    Ok(SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .context("시스템 시간이 UNIX_EPOCH보다 이전입니다")?
        .as_secs())
}

fn default_token_uri() -> String {
    "https://oauth2.googleapis.com/token".to_string()
}
