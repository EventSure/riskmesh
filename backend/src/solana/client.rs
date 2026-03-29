use anyhow::{Context, Result};
use solana_client::{
    rpc_client::RpcClient,
    rpc_config::{RpcAccountInfoConfig, RpcProgramAccountsConfig},
    rpc_filter::{Memcmp, MemcmpEncodedBytes, RpcFilterType},
};
use solana_sdk::{
    account::Account,
    commitment_config::CommitmentConfig,
    instruction::Instruction,
    message::{v0, VersionedMessage},
    pubkey::Pubkey,
    signature::Keypair,
    signer::Signer,
    transaction::VersionedTransaction,
};

pub struct SolanaClient {
    pub rpc: RpcClient,
}

impl SolanaClient {
    pub fn new(rpc_url: &str) -> Self {
        Self {
            rpc: RpcClient::new_with_commitment(
                rpc_url.to_string(),
                CommitmentConfig::confirmed(),
            ),
        }
    }

    pub fn get_account(&self, pubkey: &Pubkey) -> Result<Account> {
        self.rpc
            .get_account(pubkey)
            .with_context(|| format!("계정 조회 실패: {pubkey}"))
    }

    /// 현재 RPC 노드가 보고 있는 슬롯 번호를 조회한다.
    ///
    /// Track B에서는 이 값을 `oracle_round`로 사용해 Claim PDA seed를 만들므로,
    /// "지금 어떤 시점의 온체인 상태를 기준으로 claim을 만들었는가"를 구분하는 역할을 한다.
    pub fn get_slot(&self) -> Result<u64> {
        self.rpc
            .get_slot()
            .context("슬롯 조회 실패")
    }

    /// 레거시 트랜잭션 전송 (Track A용)
    pub fn send_transaction(
        &self,
        instructions: &[Instruction],
        signer: &Keypair,
    ) -> Result<String> {
        let recent_blockhash = self.rpc.get_latest_blockhash()?;
        let tx = solana_sdk::transaction::Transaction::new_signed_with_payer(
            instructions,
            Some(&signer.pubkey()),
            &[signer],
            recent_blockhash,
        );
        let sig = self
            .rpc
            .send_and_confirm_transaction(&tx)
            .context("트랜잭션 전송 실패")?;
        Ok(sig.to_string())
    }

    /// v0 트랜잭션 전송 (Track B: LUT 포함)
    pub fn send_v0_transaction(
        &self,
        instructions: Vec<Instruction>,
        luts: &[solana_sdk::address_lookup_table::AddressLookupTableAccount],
        signer: &Keypair,
    ) -> Result<String> {
        let recent_blockhash = self.rpc.get_latest_blockhash()?;
        let msg = v0::Message::try_compile(
            &signer.pubkey(),
            &instructions,
            luts,
            recent_blockhash,
        )
        .context("v0 메시지 컴파일 실패")?;
        let tx = VersionedTransaction::try_new(VersionedMessage::V0(msg), &[signer])
            .context("트랜잭션 서명 실패")?;
        let sig = self
            .rpc
            .send_and_confirm_transaction(&tx)
            .context("v0 트랜잭션 전송 실패")?;
        Ok(sig.to_string())
    }

    /// getProgramAccounts: discriminator + 단일 바이트 필터로 계정 목록 조회
    pub fn get_program_accounts_filtered(
        &self,
        program_id: &Pubkey,
        discriminator: [u8; 8],
        field_offset: usize,
        field_value: &[u8],
    ) -> Result<Vec<(Pubkey, Account)>> {
        let filters = vec![
            RpcFilterType::Memcmp(Memcmp::new(
                0,
                MemcmpEncodedBytes::Bytes(discriminator.to_vec()),
            )),
            RpcFilterType::Memcmp(Memcmp::new(
                field_offset,
                MemcmpEncodedBytes::Bytes(field_value.to_vec()),
            )),
        ];
        let config = RpcProgramAccountsConfig {
            filters: Some(filters),
            account_config: RpcAccountInfoConfig {
                encoding: Some(solana_account_decoder::UiAccountEncoding::Base64),
                commitment: Some(CommitmentConfig::confirmed()),
                ..Default::default()
            },
            ..Default::default()
        };
        self.rpc
            .get_program_accounts_with_config(program_id, config)
            .context("getProgramAccounts 실패")
    }
}
    
#[cfg(test)]
mod tests {
    use super::SolanaClient;
    use solana_sdk::{pubkey::Pubkey, system_program};
    use std::{str::FromStr, sync::Once};

    static LOAD_TEST_ENV: Once = Once::new();

    fn load_test_env() {
        LOAD_TEST_ENV.call_once(|| {
            dotenv::dotenv().ok();
            dotenv::from_filename("../.env").ok();
        });
    }

    fn test_rpc_url() -> String {
        load_test_env();
        std::env::var("RPC_URL").unwrap_or_else(|_| "https://api.devnet.solana.com".to_string())
    }

    fn leader_pubkey_from_env() -> Pubkey {
        load_test_env();
        let value = std::env::var("LEADER_PUBKEY")
            .expect("LEADER_PUBKEY 환경변수가 필요합니다");
        Pubkey::from_str(&value)
            .unwrap_or_else(|err| panic!("LEADER_PUBKEY 파싱 실패: {value} ({err})"))
    }

    #[test]
    #[ignore = "LEADER_PUBKEY 환경변수가 필요합니다. `cargo test -- --ignored`로 실행하세요."]
    fn test_account_pubkey_prints_configured_pubkey() {
        let account_pubkey = leader_pubkey_from_env();
        println!(
            "[test_account_pubkey_prints_configured_pubkey] pubkey={}",
            account_pubkey
        );

        assert_ne!(
            account_pubkey,
            Pubkey::default(),
            "configured pubkey should not be default"
        );
    }

    #[test]
    #[ignore = "실제 Solana RPC 호출이 필요합니다. `cargo test -- --ignored`로 실행하세요."]
    fn get_slot_works_against_rpc() {
        let client = SolanaClient::new(&test_rpc_url());

        let slot = client.get_slot().expect("slot should be fetched from RPC");
        println!("[get_slot_works_against_rpc] slot={slot}");

        assert!(slot > 0, "slot should be a positive number");
    }

    #[test]
    #[ignore = "실제 Solana RPC 호출이 필요합니다. `cargo test -- --ignored`로 실행하세요."]
    fn get_account_reads_leader_pubkey_from_env() {
        let client = SolanaClient::new(&test_rpc_url());
        let account_pubkey = leader_pubkey_from_env();

        let account = client
            .get_account(&account_pubkey)
            .expect("configured account should exist");
        println!(
            "[get_account_reads_leader_pubkey_from_env] pubkey={} lamports={} owner={} data_len={}",
            account_pubkey,
            account.lamports,
            account.owner,
            account.data.len()
        );

        assert_ne!(account.owner, Pubkey::default(), "account owner should be set");
        assert!(
            account.lamports > 0 || !account.data.is_empty(),
            "account should have lamports or data"
        );
    }

    #[test]
    #[ignore = "실제 Solana RPC 호출이 필요합니다. `cargo test -- --ignored`로 실행하세요."]
    fn get_program_accounts_filtered_returns_vec() {
        let client = SolanaClient::new(&test_rpc_url());
        let impossible_discriminator = [255_u8; 8];
        let no_match_value = [123_u8];

        let accounts = client
            .get_program_accounts_filtered(
                &system_program::id(),
                impossible_discriminator,
                8,
                &no_match_value,
            )
            .expect("RPC request itself should succeed");
        println!(
            "[get_program_accounts_filtered_returns_vec] matched_accounts={}",
            accounts.len()
        );
        if let Some((pubkey, account)) = accounts.first() {
            println!(
                "[get_program_accounts_filtered_returns_vec] first_pubkey={} lamports={} data_len={}",
                pubkey,
                account.lamports,
                account.data.len()
            );
        }

        assert!(
            accounts.is_empty()
                || accounts
                    .iter()
                    .all(|(pubkey, _account)| *pubkey != Pubkey::default()),
            "returned accounts should be well-formed"
        );
    }
}
