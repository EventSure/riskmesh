use anchor_lang::prelude::*;

use crate::errors::OpenParamError;
use crate::state::*;

#[derive(Accounts)]
pub struct ConfirmMaster<'info> {
    pub actor: Signer<'info>,
    #[account(mut)]
    pub master_policy: Account<'info, MasterPolicy>,
}

pub fn handler(ctx: Context<ConfirmMaster>, role: u8) -> Result<()> {
    let master = &mut ctx.accounts.master_policy;
    require!(master.status == MasterPolicyStatus::PendingConfirm as u8, OpenParamError::InvalidState);

    if role == ConfirmRole::Participant as u8 {
        let idx = master
            .participants
            .iter()
            .position(|p| p.insurer == ctx.accounts.actor.key())
            .ok_or(OpenParamError::Unauthorized)?;

        let p = &mut master.participants[idx];
        require!(p.pool_wallet != Pubkey::default(), OpenParamError::InvalidInput);
        require!(p.deposit_wallet != Pubkey::default(), OpenParamError::InvalidInput);
        p.confirmed = true;
    } else if role == ConfirmRole::Reinsurer as u8 {
        require!(ctx.accounts.actor.key() == master.reinsurer, OpenParamError::Unauthorized);
        master.reinsurer_confirmed = true;
    } else {
        return Err(OpenParamError::InvalidRole.into());
    }

    Ok(())
}
