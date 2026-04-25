use solana_sdk::pubkey::Pubkey;

/// master agreement PDA. TODO: seed literal is shared with the smart contract, so "master_agreement" stays for compatibility.
pub fn master_agreement_pda(
    program_id: &Pubkey,
    leader: &Pubkey,
    master_id: u64,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"master_agreement", leader.as_ref(), &master_id.to_le_bytes()],
        program_id,
    )
}

/// Track A: ["flight_policy", master_agreement, child_policy_id_le8]
pub fn flight_policy_pda(
    program_id: &Pubkey,
    master_agreement: &Pubkey,
    child_policy_id: u64,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            b"flight_policy",
            // TODO: PDA seed literal/order is shared with the smart contract; rename with contract update.
            master_agreement.as_ref(),
            &child_policy_id.to_le_bytes(),
        ],
        program_id,
    )
}
