use solana_sdk::pubkey::Pubkey;

/// ["master_policy", leader, master_id_le8]
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
