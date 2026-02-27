use anchor_lang::prelude::*;

use crate::errors::OpenParamError;
use crate::state::*;

#[derive(Accounts)]
pub struct ActivateMaster<'info> {
    pub operator: Signer<'info>,
    #[account(mut)]
    pub master_policy: Account<'info, MasterPolicy>,
}

pub fn handler(ctx: Context<ActivateMaster>) -> Result<()> {
    let master = &mut ctx.accounts.master_policy;
    require!(master.status == MasterPolicyStatus::PendingConfirm as u8, OpenParamError::InvalidState);
    require!(ctx.accounts.operator.key() == master.operator, OpenParamError::Unauthorized);
    require!(master.reinsurer_confirmed, OpenParamError::MasterNotConfirmed);

    let all_confirmed = all_participants_confirmed(&master.participants);
    require!(all_confirmed, OpenParamError::MasterNotConfirmed);

    master.status = MasterPolicyStatus::Active as u8;
    Ok(())
}

pub(crate) fn all_participants_confirmed(participants: &[MasterParticipant]) -> bool {
    participants.iter().all(|p| {
        p.confirmed && p.pool_wallet != Pubkey::default() && p.deposit_wallet != Pubkey::default()
    })
}
