use solana_sdk::pubkey::Pubkey;

/// Track B: ["policy", leader, policy_id_le8]
pub fn policy_pda(program_id: &Pubkey, leader: &Pubkey, policy_id: u64) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"policy", leader.as_ref(), &policy_id.to_le_bytes()],
        program_id,
    )
}

/// Track B: ["claim", policy, oracle_round_le8]
pub fn claim_pda(program_id: &Pubkey, policy: &Pubkey, oracle_round: u64) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"claim", policy.as_ref(), &oracle_round.to_le_bytes()],
        program_id,
    )
}

/// Track B: ["underwriting", policy]
pub fn underwriting_pda(program_id: &Pubkey, policy: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"underwriting", policy.as_ref()], program_id)
}

/// Track B: ["pool", policy]
pub fn risk_pool_pda(program_id: &Pubkey, policy: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"pool", policy.as_ref()], program_id)
}

/// Track A: ["master_policy", leader, master_id_le8]
pub fn master_policy_pda(
    program_id: &Pubkey,
    leader: &Pubkey,
    master_id: u64,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"master_policy", leader.as_ref(), &master_id.to_le_bytes()],
        program_id,
    )
}

/// SPL Associated Token Account 주소 유도.
/// ATA = findProgramAddress([wallet, TOKEN_PROGRAM_ID, mint], ASSOCIATED_TOKEN_PROGRAM_ID)
pub fn get_associated_token_address(wallet: &Pubkey, mint: &Pubkey) -> Pubkey {
    let spl_token_id = solana_sdk::pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
    let assoc_program_id = solana_sdk::pubkey!("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bMW");
    Pubkey::find_program_address(
        &[wallet.as_ref(), spl_token_id.as_ref(), mint.as_ref()],
        &assoc_program_id,
    )
    .0
}

/// Track A: ["flight_policy", master_policy, child_policy_id_le8]
pub fn flight_policy_pda(
    program_id: &Pubkey,
    master_policy: &Pubkey,
    child_policy_id: u64,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            b"flight_policy",
            master_policy.as_ref(),
            &child_policy_id.to_le_bytes(),
        ],
        program_id,
    )
}
