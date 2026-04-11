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
        })
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

// ── InsuranceRepository 구현 ──────────────────────────────────────────────

use async_trait::async_trait;
use serde::de::DeserializeOwned;

use crate::{
    api::repository::{InsuranceRepository, SyncSummary},
    config::Config,
    oracle::program_accounts::{FlightPolicyInfo, MasterAgreementInfo},
};

/// Firebase Firestore 기반 InsuranceRepository 구현.
#[derive(Clone)]
pub struct FirebaseRepository {
    client: FirebaseClient,
}

impl FirebaseRepository {
    pub fn new(client: FirebaseClient) -> Self {
        Self { client }
    }

    pub fn from_env() -> Result<Self> {
        Ok(Self::new(FirebaseClient::from_env()?))
    }

    async fn list_payload_documents<T>(&self, collection_id: &str) -> Result<Vec<T>>
    where
        T: DeserializeOwned,
    {
        let auth = self.client.resolve_auth().await?;
        let documents = self
            .client
            .list_documents(&auth.access_token, collection_id)
            .await?;

        documents
            .into_iter()
            .map(extract_payload::<T>)
            .collect()
    }

    async fn get_payload_document<T>(&self, collection_id: &str, document_id: &str) -> Result<Option<T>>
    where
        T: DeserializeOwned,
    {
        let auth = self.client.resolve_auth().await?;
        let document_path = format!("{collection_id}/{document_id}");
        let document = self
            .client
            .get_document(&auth.access_token, &document_path)
            .await?;

        document.map(extract_payload::<T>).transpose()
    }
}

#[async_trait]
impl InsuranceRepository for FirebaseRepository {
    async fn sync_snapshots(
        &self,
        config: &Config,
        master_agreements: &[MasterAgreementInfo],
        flight_policies: &[FlightPolicyInfo],
    ) -> Result<SyncSummary> {
        let auth = self.client.resolve_auth().await?;
        let synced_at = current_unix_seconds()?;

        for agreement in master_agreements {
            let fields = build_master_agreement_fields(config, synced_at, agreement)?;
            let path = format!(
                "{}/{}",
                self.client.config().master_policies_collection,
                agreement.pubkey
            );
            self.client
                .upsert_document(&auth.access_token, &path, fields)
                .await
                .with_context(|| format!("MasterAgreement 문서 저장 실패: {}", agreement.pubkey))?;
        }

        for fp in flight_policies {
            let fields = build_flight_policy_fields(config, synced_at, fp)?;
            let path = format!("{}/{}", self.client.config().flight_policies_collection, fp.pubkey);
            self.client
                .upsert_document(&auth.access_token, &path, fields)
                .await
                .with_context(|| format!("FlightPolicy 문서 저장 실패: {}", fp.pubkey))?;
        }

        let metadata_fields =
            build_sync_metadata_fields(config, synced_at, master_agreements, flight_policies);
        let metadata_path = format!("{}/current", self.client.config().sync_metadata_collection);
        self.client
            .upsert_document(&auth.access_token, &metadata_path, metadata_fields)
            .await
            .context("동기화 메타데이터 저장 실패")?;

        Ok(SyncSummary {
            synced_at,
            master_agreement_count: master_agreements.len(),
            flight_policy_count: flight_policies.len(),
        })
    }

    async fn list_master_agreements(&self) -> Result<Vec<MasterAgreementInfo>> {
        self.list_payload_documents(&self.client.config().master_policies_collection)
            .await
            .context("Firebase MasterAgreement 목록 조회 실패")
    }

    async fn get_master_agreement(&self, pubkey: &str) -> Result<Option<MasterAgreementInfo>> {
        self.get_payload_document(&self.client.config().master_policies_collection, pubkey)
            .await
            .with_context(|| format!("Firebase MasterAgreement 조회 실패: {pubkey}"))
    }

    async fn list_flight_policies(&self) -> Result<Vec<FlightPolicyInfo>> {
        self.list_payload_documents(&self.client.config().flight_policies_collection)
            .await
            .context("Firebase FlightPolicy 목록 조회 실패")
    }

    async fn get_flight_policy(&self, pubkey: &str) -> Result<Option<FlightPolicyInfo>> {
        self.get_payload_document(&self.client.config().flight_policies_collection, pubkey)
            .await
            .with_context(|| format!("Firebase FlightPolicy 조회 실패: {pubkey}"))
    }
}

// ── Firestore value 변환 헬퍼 ─────────────────────────────────────────────

use serde_json::Map;

fn extract_payload<T: DeserializeOwned>(document: FirestoreDocument) -> Result<T> {
    let fields = document
        .fields
        .as_object()
        .context("Firestore fields는 object여야 합니다")?;
    let payload = fields
        .get("payload")
        .context("Firestore 문서에 payload 필드가 없습니다")?;
    let payload = json_from_firestore_value(payload).context("Firestore payload 파싱 실패")?;
    serde_json::from_value(payload).context("Firestore payload 역직렬화 실패")
}

fn build_master_agreement_fields(
    config: &Config,
    synced_at: u64,
    agreement: &MasterAgreementInfo,
) -> Result<Value> {
    let payload = serde_json::to_value(agreement).context("MasterAgreement JSON 직렬화 실패")?;
    Ok(json!({
        // TODO: Firestore field values are consumed outside backend; rename with frontend/data migration work.
        "kind": { "stringValue": "master_policy" },
        "pubkey": { "stringValue": agreement.pubkey },
        "leader": { "stringValue": agreement.leader },
        "operator": { "stringValue": agreement.operator },
        "status": { "integerValue": agreement.status.to_string() },
        "status_label": { "stringValue": agreement.status_label },
        "program_id": { "stringValue": config.program_id.to_string() },
        "rpc_url": { "stringValue": config.rpc_url },
        "synced_at": { "integerValue": synced_at.to_string() },
        "payload": firestore_value_from_json(&payload),
    }))
}

fn build_flight_policy_fields(config: &Config, synced_at: u64, fp: &FlightPolicyInfo) -> Result<Value> {
    let payload = serde_json::to_value(fp).context("FlightPolicy JSON 직렬화 실패")?;
    Ok(json!({
        "kind": { "stringValue": "flight_policy" },
        "pubkey": { "stringValue": fp.pubkey },
        "master": { "stringValue": fp.master },
        "status": { "integerValue": fp.status.to_string() },
        "status_label": { "stringValue": fp.status_label },
        "program_id": { "stringValue": config.program_id.to_string() },
        "rpc_url": { "stringValue": config.rpc_url },
        "synced_at": { "integerValue": synced_at.to_string() },
        "payload": firestore_value_from_json(&payload),
    }))
}

fn build_sync_metadata_fields(
    config: &Config,
    synced_at: u64,
    master_agreements: &[MasterAgreementInfo],
    flight_policies: &[FlightPolicyInfo],
) -> Value {
    json!({
        "kind": { "stringValue": "policy_sync_metadata" },
        "program_id": { "stringValue": config.program_id.to_string() },
        "rpc_url": { "stringValue": config.rpc_url },
        "synced_at": { "integerValue": synced_at.to_string() },
        // TODO: Firestore field names are consumed outside backend; rename with frontend/data migration work.
        "master_policy_count": { "integerValue": master_agreements.len().to_string() },
        "flight_policy_count": { "integerValue": flight_policies.len().to_string() },
    })
}

fn firestore_value_from_json(value: &Value) -> Value {
    match value {
        Value::Null => json!({ "nullValue": null }),
        Value::Bool(v) => json!({ "booleanValue": v }),
        Value::Number(v) => {
            if let Some(int) = v.as_i64() {
                json!({ "integerValue": int.to_string() })
            } else if let Some(uint) = v.as_u64() {
                json!({ "integerValue": uint.to_string() })
            } else if let Some(float) = v.as_f64() {
                json!({ "doubleValue": float })
            } else {
                json!({ "stringValue": v.to_string() })
            }
        }
        Value::String(v) => json!({ "stringValue": v }),
        Value::Array(values) => json!({
            "arrayValue": {
                "values": values.iter().map(firestore_value_from_json).collect::<Vec<_>>()
            }
        }),
        Value::Object(map) => {
            let mut fields = Map::new();
            for (key, val) in map {
                fields.insert(key.clone(), firestore_value_from_json(val));
            }
            json!({ "mapValue": { "fields": fields } })
        }
    }
}

fn json_from_firestore_value(value: &Value) -> Result<Value> {
    let map = value
        .as_object()
        .context("Firestore value는 object여야 합니다")?;

    if map.contains_key("nullValue") {
        return Ok(Value::Null);
    }
    if let Some(v) = map.get("booleanValue").and_then(Value::as_bool) {
        return Ok(Value::Bool(v));
    }
    if let Some(v) = map.get("stringValue").and_then(Value::as_str) {
        return Ok(Value::String(v.to_string()));
    }
    if let Some(v) = map.get("integerValue") {
        if let Some(raw) = v.as_str() {
            if let Ok(parsed) = raw.parse::<i64>() {
                return Ok(json!(parsed));
            }
            if let Ok(parsed) = raw.parse::<u64>() {
                return Ok(json!(parsed));
            }
        }
    }
    if let Some(v) = map.get("doubleValue").and_then(Value::as_f64) {
        return Ok(json!(v));
    }
    if let Some(array_value) = map.get("arrayValue").and_then(Value::as_object) {
        let values = array_value
            .get("values")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        return values
            .into_iter()
            .map(|entry| json_from_firestore_value(&entry))
            .collect::<Result<Vec<_>>>()
            .map(Value::Array);
    }
    if let Some(map_value) = map.get("mapValue").and_then(Value::as_object) {
        let fields = map_value
            .get("fields")
            .and_then(Value::as_object)
            .cloned()
            .unwrap_or_default();
        let mut result = Map::new();
        for (key, val) in fields {
            result.insert(key, json_from_firestore_value(&val)?);
        }
        return Ok(Value::Object(result));
    }

    anyhow::bail!("지원하지 않는 Firestore value 형식")
}
