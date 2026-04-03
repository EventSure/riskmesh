use anyhow::{Context, Result};
use serde::{de::DeserializeOwned, Serialize};
use serde_json::{json, Map, Value};
use std::{
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

use crate::{
    config::Config,
    firebase::{FirebaseClient, FirestoreDocument},
    oracle::program_accounts::{FlightPolicyInfo, MasterPolicyInfo},
};

#[derive(Clone)]
pub(crate) struct FirebaseRepository {
    client: FirebaseClient,
}

impl FirebaseRepository {
    pub(crate) fn new(client: FirebaseClient) -> Self {
        Self { client }
    }

    pub(crate) fn from_env() -> Result<Self> {
        Ok(Self::new(FirebaseClient::from_env()?))
    }

    pub(crate) async fn insert_test_document(&self) -> Result<SeedResult> {
        let unix_ms = current_unix_ms()?;
        let document_id = next_document_id(unix_ms);
        let auth = self.client.resolve_auth().await?;
        let fields = sample_firestore_fields(self.client.config(), unix_ms, &auth.principal);
        let document = self
            .client
            .create_document(
                &auth.access_token,
                &self.client.config().test_collection,
                &document_id,
                fields,
            )
            .await?;

        Ok(SeedResult {
            collection_id: self.client.config().test_collection.clone(),
            document_id,
            auth_local_id: auth.principal,
            document,
        })
    }

    pub(crate) async fn sync_policy_snapshots(
        &self,
        config: &Config,
        master_policies: &[MasterPolicyInfo],
        flight_policies: &[FlightPolicyInfo],
    ) -> Result<SyncSummary> {
        let auth = self.client.resolve_auth().await?;
        let synced_at = current_unix_seconds()?;

        for master_policy in master_policies {
            let fields = build_master_policy_document(config, synced_at, master_policy)?;
            let document_path = format!(
                "{}/{}",
                self.client.config().master_policies_collection,
                master_policy.pubkey
            );
            self.client
                .upsert_document(&auth.access_token, &document_path, fields)
                .await
                .with_context(|| format!("MasterPolicy 문서 저장 실패: {}", master_policy.pubkey))?;
        }

        for flight_policy in flight_policies {
            let fields = build_flight_policy_document(config, synced_at, flight_policy)?;
            let document_path = format!(
                "{}/{}",
                self.client.config().flight_policies_collection,
                flight_policy.pubkey
            );
            self.client
                .upsert_document(&auth.access_token, &document_path, fields)
                .await
                .with_context(|| format!("FlightPolicy 문서 저장 실패: {}", flight_policy.pubkey))?;
        }

        let metadata_fields = build_sync_metadata_document(config, synced_at, master_policies, flight_policies);
        let metadata_path = format!(
            "{}/current",
            self.client.config().sync_metadata_collection
        );
        self.client
            .upsert_document(&auth.access_token, &metadata_path, metadata_fields)
            .await
            .context("동기화 메타데이터 저장 실패")?;

        Ok(SyncSummary {
            synced_at,
            master_policy_count: master_policies.len(),
            flight_policy_count: flight_policies.len(),
        })
    }

    pub(crate) async fn list_master_policies(&self) -> Result<Vec<MasterPolicyInfo>> {
        self.list_payload_documents::<MasterPolicyInfo>(&self.client.config().master_policies_collection)
            .await
            .context("Firebase MasterPolicy 목록 조회 실패")
    }

    pub(crate) async fn get_master_policy(&self, pubkey: &str) -> Result<Option<MasterPolicyInfo>> {
        self.get_payload_document::<MasterPolicyInfo>(
            &self.client.config().master_policies_collection,
            pubkey,
        )
        .await
        .with_context(|| format!("Firebase MasterPolicy 조회 실패: {pubkey}"))
    }

    pub(crate) async fn list_flight_policies(&self) -> Result<Vec<FlightPolicyInfo>> {
        self.list_payload_documents::<FlightPolicyInfo>(&self.client.config().flight_policies_collection)
            .await
            .context("Firebase FlightPolicy 목록 조회 실패")
    }

    pub(crate) async fn get_flight_policy(&self, pubkey: &str) -> Result<Option<FlightPolicyInfo>> {
        self.get_payload_document::<FlightPolicyInfo>(
            &self.client.config().flight_policies_collection,
            pubkey,
        )
        .await
        .with_context(|| format!("Firebase FlightPolicy 조회 실패: {pubkey}"))
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
            .map(document_payload::<T>)
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

        document.map(document_payload::<T>).transpose()
    }
}

#[derive(Debug, Serialize)]
pub(crate) struct SeedResult {
    pub collection_id: String,
    pub document_id: String,
    pub auth_local_id: String,
    pub document: FirestoreDocument,
}

#[derive(Debug, Serialize)]
pub(crate) struct SyncSummary {
    pub synced_at: u64,
    pub master_policy_count: usize,
    pub flight_policy_count: usize,
}

fn sample_firestore_fields(
    config: &crate::firebase::FirebaseConfig,
    unix_ms: u128,
    principal: &str,
) -> Value {
    json!({
        "source": { "stringValue": "riskmesh-backend" },
        "kind": { "stringValue": "firebase-seed" },
        "status": { "stringValue": "created" },
        "project_id": { "stringValue": config.project_id },
        "service_account": { "stringValue": principal },
        "created_at_unix_ms": { "integerValue": unix_ms.to_string() },
        "notes": { "stringValue": "Inserted by api/repository.rs" }
    })
}

fn build_master_policy_document(
    config: &Config,
    synced_at: u64,
    master_policy: &MasterPolicyInfo,
) -> Result<Value> {
    let payload = serde_json::to_value(master_policy).context("MasterPolicy JSON 직렬화 실패")?;

    Ok(json!({
        "kind": { "stringValue": "master_policy" },
        "pubkey": { "stringValue": master_policy.pubkey.clone() },
        "leader": { "stringValue": master_policy.leader.clone() },
        "operator": { "stringValue": master_policy.operator.clone() },
        "status": { "integerValue": master_policy.status.to_string() },
        "status_label": { "stringValue": master_policy.status_label },
        "program_id": { "stringValue": config.program_id.to_string() },
        "rpc_url": { "stringValue": config.rpc_url.clone() },
        "synced_at": { "integerValue": synced_at.to_string() },
        "payload": firestore_value_from_json(&payload),
    }))
}

fn build_flight_policy_document(
    config: &Config,
    synced_at: u64,
    flight_policy: &FlightPolicyInfo,
) -> Result<Value> {
    let payload = serde_json::to_value(flight_policy).context("FlightPolicy JSON 직렬화 실패")?;

    Ok(json!({
        "kind": { "stringValue": "flight_policy" },
        "pubkey": { "stringValue": flight_policy.pubkey.clone() },
        "master": { "stringValue": flight_policy.master.clone() },
        "status": { "integerValue": flight_policy.status.to_string() },
        "status_label": { "stringValue": flight_policy.status_label },
        "program_id": { "stringValue": config.program_id.to_string() },
        "rpc_url": { "stringValue": config.rpc_url.clone() },
        "synced_at": { "integerValue": synced_at.to_string() },
        "payload": firestore_value_from_json(&payload),
    }))
}

fn build_sync_metadata_document(
    config: &Config,
    synced_at: u64,
    master_policies: &[MasterPolicyInfo],
    flight_policies: &[FlightPolicyInfo],
) -> Value {
    json!({
        "kind": { "stringValue": "policy_sync_metadata" },
        "program_id": { "stringValue": config.program_id.to_string() },
        "rpc_url": { "stringValue": config.rpc_url.clone() },
        "synced_at": { "integerValue": synced_at.to_string() },
        "master_policy_count": { "integerValue": master_policies.len().to_string() },
        "flight_policy_count": { "integerValue": flight_policies.len().to_string() },
    })
}

fn document_payload<T>(document: FirestoreDocument) -> Result<T>
where
    T: DeserializeOwned,
{
    let fields = document
        .fields
        .as_object()
        .context("Firestore fields는 object 여야 합니다")?;
    let payload = fields
        .get("payload")
        .context("Firestore 문서에 payload 필드가 없습니다")?;
    let payload = json_from_firestore_value(payload).context("Firestore payload 파싱 실패")?;

    serde_json::from_value(payload).context("Firestore payload 역직렬화 실패")
}

fn firestore_value_from_json(value: &Value) -> Value {
    match value {
        Value::Null => json!({ "nullValue": null }),
        Value::Bool(value) => json!({ "booleanValue": value }),
        Value::Number(value) => {
            if let Some(int) = value.as_i64() {
                json!({ "integerValue": int.to_string() })
            } else if let Some(uint) = value.as_u64() {
                json!({ "integerValue": uint.to_string() })
            } else if let Some(float) = value.as_f64() {
                json!({ "doubleValue": float })
            } else {
                json!({ "stringValue": value.to_string() })
            }
        }
        Value::String(value) => json!({ "stringValue": value }),
        Value::Array(values) => json!({
            "arrayValue": {
                "values": values.iter().map(firestore_value_from_json).collect::<Vec<_>>()
            }
        }),
        Value::Object(map) => {
            let mut fields = Map::new();
            for (key, value) in map {
                fields.insert(key.clone(), firestore_value_from_json(value));
            }
            json!({ "mapValue": { "fields": fields } })
        }
    }
}

fn json_from_firestore_value(value: &Value) -> Result<Value> {
    let map = value
        .as_object()
        .context("Firestore value는 object 여야 합니다")?;

    if map.contains_key("nullValue") {
        return Ok(Value::Null);
    }
    if let Some(value) = map.get("booleanValue").and_then(Value::as_bool) {
        return Ok(Value::Bool(value));
    }
    if let Some(value) = map.get("stringValue").and_then(Value::as_str) {
        return Ok(Value::String(value.to_string()));
    }
    if let Some(value) = map.get("integerValue") {
        if let Some(raw) = value.as_str() {
            if let Ok(parsed) = raw.parse::<i64>() {
                return Ok(json!(parsed));
            }
            if let Ok(parsed) = raw.parse::<u64>() {
                return Ok(json!(parsed));
            }
        }
    }
    if let Some(value) = map.get("doubleValue").and_then(Value::as_f64) {
        return Ok(json!(value));
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
        for (key, value) in fields {
            result.insert(key, json_from_firestore_value(&value)?);
        }
        return Ok(Value::Object(result));
    }

    anyhow::bail!("지원하지 않는 Firestore value 형식")
}

fn current_unix_ms() -> Result<u128> {
    Ok(SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .context("시스템 시간이 UNIX_EPOCH보다 이전입니다")?
        .as_millis())
}

fn current_unix_seconds() -> Result<u64> {
    Ok(SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .context("시스템 시간이 UNIX_EPOCH보다 이전입니다")?
        .as_secs())
}

fn next_document_id(unix_ms: u128) -> String {
    static SEQ: AtomicU64 = AtomicU64::new(0);
    let seq = SEQ.fetch_add(1, Ordering::Relaxed);
    format!("riskmesh-seed-{unix_ms}-{seq}")
}
