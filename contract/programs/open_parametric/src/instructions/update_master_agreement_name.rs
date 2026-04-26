use anchor_lang::prelude::*;

use crate::errors::OpenParamError;
use crate::state::*;

use super::master_agreement_name::normalize_master_agreement_name;

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

pub(crate) fn apply_master_agreement_name_update(
    master: &mut MasterAgreement,
    signer: Pubkey,
    name: &str,
) -> std::result::Result<(), OpenParamError> {
    assert_can_rename_master_agreement(master.leader, master.operator, signer)?;
    master.name = normalize_master_agreement_name(name)?;

    Ok(())
}

pub fn handler(ctx: Context<UpdateMasterAgreementName>, name: String) -> Result<()> {
    let master = &mut ctx.accounts.master_agreement;
    apply_master_agreement_name_update(master, ctx.accounts.signer.key(), &name)?;
    Ok(())
}
