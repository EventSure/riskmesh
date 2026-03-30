use anyhow::Result;

#[path = "../firebase/mod.rs"]
mod firebase;
#[path = "../api/repository.rs"]
mod repository;

#[tokio::main]
async fn main() -> Result<()> {
    let repository = repository::FirebaseRepository::from_env()?;
    let seed = repository.insert_test_document().await?;

    println!(
        "Firebase seed inserted into collection '{}' with document '{}'",
        seed.collection_id, seed.document_id
    );
    println!("Document path: {}", seed.document.name);
    println!("{}", serde_json::to_string_pretty(&seed)?);

    Ok(())
}
