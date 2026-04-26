use anchor_lang::prelude::*;

use crate::errors::OpenParamError;
use crate::state::*;

use super::create_master_agreement::normalize_master_agreement_name;

#[derive(Accounts)]
pub struct UpdateMasterAgreementName<'info> {
    pub signer: Signer<'info>,
    #[account(mut)]
    pub master_agreement: Account<'info, MasterAgreement>,
}

pub(crate) fn assert_can_rename_master_agreement(
    leader: Pubkey,
    operator: Pubkey,
    signer: Pubkey,
) -> std::result::Result<(), OpenParamError> {
    if signer != leader && signer != operator {
        return Err(OpenParamError::Unauthorized);
    }

    Ok(())
}

pub fn handler(ctx: Context<UpdateMasterAgreementName>, name: String) -> Result<()> {
    let normalized_name = normalize_master_agreement_name(&name)?;
    let master = &mut ctx.accounts.master_agreement;

    assert_can_rename_master_agreement(master.leader, master.operator, ctx.accounts.signer.key())?;
    master.name = normalized_name;

    Ok(())
}
