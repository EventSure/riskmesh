use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone)]
pub struct FirebaseConfig {
    pub api_key: String,
    pub auth_domain: String,
    pub project_id: String,
    pub storage_bucket: String,
    pub messaging_sender_id: String,
    pub app_id: String,
    pub firestore_database: String,
    pub test_collection: String,
    pub id_token: Option<String>,
}

impl FirebaseConfig {
    pub fn from_env() -> Result<Self> {
        load_dotenv();

        Ok(Self {
            api_key: required_env("FIREBASE_API_KEY")?,
            auth_domain: required_env("FIREBASE_AUTH_DOMAIN")?,
            project_id: required_env("FIREBASE_PROJECT_ID")?,
            storage_bucket: required_env("FIREBASE_STORAGE_BUCKET")?,
            messaging_sender_id: required_env("FIREBASE_MESSAGING_SENDER_ID")?,
            app_id: required_env("FIREBASE_APP_ID")?,
            firestore_database: optional_env("FIREBASE_DATABASE", "(default)"),
            test_collection: optional_env("FIREBASE_TEST_COLLECTION", "riskmesh_test"),
            id_token: optional_nonempty_env("FIREBASE_ID_TOKEN"),
        })
    }

    fn firestore_documents_base_url(&self) -> String {
        format!(
            "https://firestore.googleapis.com/v1/projects/{}/databases/{}/documents",
            self.project_id, self.firestore_database
        )
    }

    fn auth_sign_up_url(&self) -> String {
        format!(
            "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={}",
            self.api_key
        )
    }
}

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

    pub async fn sign_in_anonymously(&self) -> Result<FirebaseAuthSession> {
        let response = self
            .http
            .post(self.config.auth_sign_up_url())
            .json(&json!({
                "returnSecureToken": true,
            }))
            .send()
            .await
            .context("Firebase 익명 로그인 요청 실패")?;

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            let hint = if body.contains("CONFIGURATION_NOT_FOUND") {
                " Firebase Auth anonymous sign-in이 비활성화된 상태일 수 있습니다. Firebase Console에서 Anonymous provider를 켜거나 FIREBASE_ID_TOKEN을 설정해 주세요."
            } else {
                ""
            };
            bail!(
                "Firebase 익명 로그인 실패: status={} body={}{}",
                status,
                body,
                hint
            );
        }

        response
            .json::<FirebaseAuthSession>()
            .await
            .context("Firebase 익명 로그인 응답 파싱 실패")
    }

    pub async fn create_document(
        &self,
        id_token: &str,
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
            .bearer_auth(id_token)
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

    pub async fn insert_test_document(&self) -> Result<SeedResult> {
        let unix_ms = current_unix_ms()?;
        let document_id = format!("riskmesh-seed-{unix_ms}");
        let auth = self.resolve_auth().await?;
        let fields = sample_firestore_fields(&self.config, unix_ms, &auth.local_id);
        let document = self
            .create_document(
                &auth.id_token,
                &self.config.test_collection,
                &document_id,
                fields,
            )
            .await?;

        Ok(SeedResult {
            collection_id: self.config.test_collection.clone(),
            document_id,
            auth_local_id: auth.local_id,
            document,
        })
    }

    async fn resolve_auth(&self) -> Result<FirebaseWriteAuth> {
        if let Some(id_token) = &self.config.id_token {
            return Ok(FirebaseWriteAuth {
                id_token: id_token.clone(),
                local_id: "manual-id-token".to_string(),
            });
        }

        let auth = self.sign_in_anonymously().await?;
        Ok(FirebaseWriteAuth {
            id_token: auth.id_token,
            local_id: auth.local_id,
        })
    }
}

#[derive(Debug, Deserialize)]
pub struct FirebaseAuthSession {
    #[serde(rename = "idToken")]
    pub id_token: String,
    #[serde(rename = "localId")]
    pub local_id: String,
    #[serde(rename = "refreshToken")]
    pub _refresh_token: String,
    #[serde(rename = "expiresIn")]
    pub _expires_in: String,
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

#[derive(Debug, Serialize)]
pub struct SeedResult {
    pub collection_id: String,
    pub document_id: String,
    pub auth_local_id: String,
    pub document: FirestoreDocument,
}

struct FirebaseWriteAuth {
    id_token: String,
    local_id: String,
}

fn sample_firestore_fields(config: &FirebaseConfig, unix_ms: u128, auth_local_id: &str) -> Value {
    json!({
        "source": { "stringValue": "riskmesh-backend" },
        "kind": { "stringValue": "firebase-seed" },
        "status": { "stringValue": "created" },
        "project_id": { "stringValue": config.project_id },
        "auth_domain": { "stringValue": config.auth_domain },
        "storage_bucket": { "stringValue": config.storage_bucket },
        "messaging_sender_id": { "stringValue": config.messaging_sender_id },
        "app_id": { "stringValue": config.app_id },
        "anonymous_uid": { "stringValue": auth_local_id },
        "created_at_unix_ms": { "integerValue": unix_ms.to_string() },
        "notes": { "stringValue": "Inserted by backend/src/bin/firebase_seed.rs" }
    })
}

fn current_unix_ms() -> Result<u128> {
    Ok(SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .context("시스템 시간이 UNIX_EPOCH보다 이전입니다")?
        .as_millis())
}

fn required_env(key: &str) -> Result<String> {
    std::env::var(key).with_context(|| format!("환경변수 {key} 필요"))
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
