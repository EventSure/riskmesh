use anchor_lang::prelude::*;

use crate::errors::OpenParamError;
use crate::state::*;

#[derive(Accounts)]
pub struct ConfirmMaster<'info> {
    pub actor: Signer<'info>,
    #[account(mut)]
    pub master_agreement: Account<'info, MasterAgreement>,
}

pub(crate) enum ConfirmEffect {
    LeaderConfirmed,
    ParticipantConfirmed { idx: usize },
    ReinsurerConfirmed,
}

pub(crate) fn apply_confirm(
    master_status: u8,
    role: u8,
    actor: Pubkey,
    leader: Pubkey,
    participants: &[MasterParticipant],
    reinsurer: Option<Pubkey>,
    leader_pool_wallet: Pubkey,
) -> std::result::Result<ConfirmEffect, OpenParamError> {
    if master_status != MasterAgreementStatus::PendingConfirm as u8 {
        return Err(OpenParamError::InvalidState);
    }

    if role == ConfirmRole::Participant as u8 {
        if actor == leader {
            if leader_pool_wallet == Pubkey::default() {
                return Err(OpenParamError::InvalidInput);
            }
            Ok(ConfirmEffect::LeaderConfirmed)
        } else {
            let idx = participants
                .iter()
                .position(|p| p.insurer == actor)
                .ok_or(OpenParamError::Unauthorized)?;

            let p = &participants[idx];
            if p.pool_wallet == Pubkey::default() {
                return Err(OpenParamError::InvalidInput);
            }
            if p.deposit_wallet == Pubkey::default() {
                return Err(OpenParamError::InvalidInput);
            }
            Ok(ConfirmEffect::ParticipantConfirmed { idx })
        }
    } else if role == ConfirmRole::Reinsurer as u8 {
        let expected = reinsurer.ok_or(OpenParamError::InvalidRole)?;
        if actor != expected {
            return Err(OpenParamError::Unauthorized);
        }
        Ok(ConfirmEffect::ReinsurerConfirmed)
    } else {
        Err(OpenParamError::InvalidRole)
    }
}

pub fn handler(ctx: Context<ConfirmMaster>, role: u8) -> Result<()> {
    let master = &mut ctx.accounts.master_agreement;
    let (status, leader, reinsurer, leader_pool_wallet) = (
        master.status,
        master.leader,
        master.reinsurer,
        master.leader_pool_wallet,
    );
    match apply_confirm(status, role, ctx.accounts.actor.key(), leader, &master.participants, reinsurer, leader_pool_wallet)? {
        ConfirmEffect::ParticipantConfirmed { idx } => {
            master.participants[idx].confirmed = true;
        }
        ConfirmEffect::ReinsurerConfirmed => {
            master.reinsurer_confirmed = true;
        }
        ConfirmEffect::LeaderConfirmed => {}
    }
    Ok(())
}
