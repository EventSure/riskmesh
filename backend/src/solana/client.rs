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
