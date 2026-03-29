use anyhow::{Context, Result};
use serde::Serialize;
use serde_json::{json, Value};
use std::{
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

use crate::firebase::{FirebaseClient, FirestoreDocument};

pub(super) struct FirebaseRepository {
    client: FirebaseClient,
}

impl FirebaseRepository {
    pub(super) fn new(client: FirebaseClient) -> Self {
        Self { client }
    }

    pub(super) fn from_env() -> Result<Self> {
        Ok(Self::new(FirebaseClient::from_env()?))
    }

    pub(super) async fn insert_test_document(&self) -> Result<SeedResult> {
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
}

#[derive(Debug, Serialize)]
pub(super) struct SeedResult {
    pub collection_id: String,
    pub document_id: String,
    pub auth_local_id: String,
    pub document: FirestoreDocument,
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

fn current_unix_ms() -> Result<u128> {
    Ok(SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .context("시스템 시간이 UNIX_EPOCH보다 이전입니다")?
        .as_millis())
}

fn next_document_id(unix_ms: u128) -> String {
    static SEQ: AtomicU64 = AtomicU64::new(0);
    let seq = SEQ.fetch_add(1, Ordering::Relaxed);
    format!("riskmesh-seed-{unix_ms}-{seq}")
}
