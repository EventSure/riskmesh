use anyhow::{Context, Result};
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signature::{read_keypair_file, Keypair},
    signer::Signer,
    system_program,
};
use std::str::FromStr;

use crate::{
    config::Config,
    oracle::track_a::anchor_instruction_discriminator,
    solana::{client::SolanaClient, pda::flight_policy_pda},
};

use super::types::CreateFlightPolicyParamsWire;

pub(super) struct ProgramClient<'a> {
    client: &'a SolanaClient,
    config: &'a Config,
}

impl<'a> ProgramClient<'a> {
    pub(super) fn new(client: &'a SolanaClient, config: &'a Config) -> Self {
        Self { client, config }
    }

    pub(super) fn load_leader_signer(&self) -> Result<Keypair> {
        let keypair_path = shellexpand::tilde(&self.config.leader_keypair_path).to_string();
        let leader = read_keypair_file(&keypair_path)
            .map_err(|e| anyhow::anyhow!("키페어 파일 읽기 실패 ({keypair_path}): {e}"))?;

        if leader.pubkey() != self.config.leader_pubkey {
            anyhow::bail!("LEADER_KEYPAIR_PATH의 공개키가 LEADER_PUBKEY와 일치하지 않습니다");
        }

        Ok(leader)
    }

    pub(super) fn derive_flight_policy_pubkey(
        &self,
        master_policy_pubkey: &Pubkey,
        child_policy_id: u64,
    ) -> Pubkey {
        let (flight_policy_pubkey, _bump) = flight_policy_pda(
            &self.config.program_id,
            master_policy_pubkey,
            child_policy_id,
        );
        flight_policy_pubkey
    }

    pub(super) fn create_flight_policy(
        &self,
        leader: &Keypair,
        master_policy_pubkey: &Pubkey,
        flight_policy_pubkey: &Pubkey,
        payer_token_pubkey: &Pubkey,
        leader_deposit_token: &Pubkey,
        params: CreateFlightPolicyParamsWire,
    ) -> Result<String> {
        let ix = build_create_flight_policy_ix(
            &self.config.program_id,
            &leader.pubkey(),
            master_policy_pubkey,
            flight_policy_pubkey,
            payer_token_pubkey,
            leader_deposit_token,
            params,
        )?;

        self.client
            .send_transaction(&[ix], leader)
            .context("create_flight_policy_from_master 트랜잭션 실패")
    }
}

fn build_create_flight_policy_ix(
    program_id: &Pubkey,
    creator: &Pubkey,
    master_policy: &Pubkey,
    flight_policy: &Pubkey,
    payer_token: &Pubkey,
    leader_deposit_token: &Pubkey,
    params: CreateFlightPolicyParamsWire,
) -> Result<Instruction> {
    let mut data = anchor_instruction_discriminator("create_flight_policy_from_master").to_vec();
    data.extend_from_slice(
        &borsh::to_vec(&params).context("create_flight_policy params 직렬화 실패")?,
    );

    Ok(Instruction {
        program_id: *program_id,
        accounts: vec![
            AccountMeta::new(*creator, true),
            AccountMeta::new(*master_policy, false),
            AccountMeta::new(*flight_policy, false),
            AccountMeta::new(*payer_token, false),
            AccountMeta::new(*leader_deposit_token, false),
            AccountMeta::new_readonly(spl_token_program_id(), false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data,
    })
}

fn spl_token_program_id() -> Pubkey {
    Pubkey::from_str("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA").expect("valid pubkey")
}
