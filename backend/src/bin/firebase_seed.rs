use anyhow::Result;

#[path = "../firebase.rs"]
mod firebase;

#[tokio::main]
async fn main() -> Result<()> {
    let client = firebase::FirebaseClient::from_env()?;
    let seed = client.insert_test_document().await?;

    println!(
        "Firebase seed inserted into collection '{}' with document '{}'",
        seed.collection_id, seed.document_id
    );
    println!("Document path: {}", seed.document.name);
    println!(
        "Project: {}",
        client.config().project_id
    );
    println!("{}", serde_json::to_string_pretty(&seed)?);

    Ok(())
}
