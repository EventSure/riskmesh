use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::OpenParamError;
use crate::math::{collateral_deficit, collateral_requirements, TierPayouts};
use crate::state::*;

#[derive(Accounts)]
pub struct ConfirmMaster<'info> {
    pub actor: Signer<'info>,
    #[account(mut)]
    pub master_agreement: Account<'info, MasterAgreement>,
    #[account(mut)]
    pub actor_source_token: Account<'info, TokenAccount>,
    #[account(mut)]
    pub actor_pool_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub(crate) enum ConfirmEffect {
    Leader,
    Participant { idx: usize },
    Reinsurer,
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
            Ok(ConfirmEffect::Leader)
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
            Ok(ConfirmEffect::Participant { idx })
        }
    } else if role == ConfirmRole::Reinsurer as u8 {
        let expected = reinsurer.ok_or(OpenParamError::InvalidRole)?;
        if actor != expected {
            return Err(OpenParamError::Unauthorized);
        }
        Ok(ConfirmEffect::Reinsurer)
    } else {
        Err(OpenParamError::InvalidRole)
    }
}

fn tier_payouts(master: &MasterAgreement) -> TierPayouts {
    TierPayouts {
        delay_2h: master.payout_delay_2h,
        delay_3h: master.payout_delay_3h,
        delay_4to5h: master.payout_delay_4to5h,
        delay_6h_or_cancelled: master.payout_delay_6h_or_cancelled,
    }
}

fn expected_pool_and_required(
    master: &MasterAgreement,
    effect: &ConfirmEffect,
) -> std::result::Result<(Pubkey, u64), OpenParamError> {
    let participant_shares: Vec<u16> = master.participants.iter().map(|p| p.share_bps).collect();
    let req = collateral_requirements(
        tier_payouts(master),
        master.collateral_claim_count,
        master.reinsurer_effective_bps,
        master.leader_share_bps,
        &participant_shares,
    )?;

    match effect {
        ConfirmEffect::Leader => Ok((master.leader_pool_wallet, req.leader_required)),
        ConfirmEffect::Participant { idx } => {
            Ok((master.participants[*idx].pool_wallet, req.participant_required[*idx]))
        }
        ConfirmEffect::Reinsurer => {
            let pool = master
                .reinsurer_pool_wallet
                .ok_or(OpenParamError::InvalidRole)?;
            Ok((pool, req.reinsurer_required))
        }
    }
}

pub fn handler(ctx: Context<ConfirmMaster>, role: u8) -> Result<()> {
    let master_key = ctx.accounts.master_agreement.key();
    let effect = {
        let master = &ctx.accounts.master_agreement;
        let effect = apply_confirm(
            master.status,
            role,
            ctx.accounts.actor.key(),
            master.leader,
            &master.participants,
            master.reinsurer,
            master.leader_pool_wallet,
        )?;
        let (expected_pool, required) = expected_pool_and_required(master, &effect)?;

        require!(
            ctx.accounts.actor_pool_token.key() == expected_pool,
            OpenParamError::InvalidSettlementTarget
        );
        require!(
            ctx.accounts.actor_pool_token.mint == master.currency_mint,
            OpenParamError::InvalidInput
        );
        require!(
            ctx.accounts.actor_pool_token.owner == master_key,
            OpenParamError::InvalidSettlementTarget
        );
        require!(
            ctx.accounts.actor_source_token.mint == master.currency_mint,
            OpenParamError::InvalidInput
        );
        require!(
            ctx.accounts.actor_source_token.owner == ctx.accounts.actor.key(),
            OpenParamError::Unauthorized
        );

        let deficit = collateral_deficit(required, ctx.accounts.actor_pool_token.amount);
        if deficit > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.actor_source_token.to_account_info(),
                        to: ctx.accounts.actor_pool_token.to_account_info(),
                        authority: ctx.accounts.actor.to_account_info(),
                    },
                ),
                deficit,
            )?;
        }

        effect
    };

    let master = &mut ctx.accounts.master_agreement;
    match effect {
        ConfirmEffect::Participant { idx } => {
            master.participants[idx].confirmed = true;
        }
        ConfirmEffect::Reinsurer => {
            master.reinsurer_confirmed = true;
        }
        ConfirmEffect::Leader => {}
    }
    Ok(())
}
