use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::constants::*;
use crate::errors::OpenParamError;
use crate::state::*;

#[derive(Accounts)]
#[instruction(params: CreateFlightPolicyParams)]
pub struct CreateFlightPolicyFromMaster<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(mut)]
    pub master_agreement: Account<'info, MasterAgreement>,
    #[account(
        init,
        payer = creator,
        space = FLIGHT_POLICY_SPACE,
        seeds = [b"flight_policy", master_agreement.key().as_ref(), &params.child_policy_id.to_le_bytes()],
        bump
    )]
    pub flight_policy: Account<'info, FlightPolicy>,
    #[account(mut)]
    pub payer_token: Account<'info, TokenAccount>,
    #[account(mut)]
    pub leader_pool_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn validate_flight_policy_params(
    master_status: u8,
    creator: Pubkey,
    leader: Pubkey,
    operator: Pubkey,
    subscriber_ref_len: usize,
    flight_no_len: usize,
    route_len: usize,
    leader_pool_key: Pubkey,
    stored_leader_pool: Pubkey,
    pool_owner: Pubkey,
    master_key: Pubkey,
    payer_owner: Pubkey,
    payer_mint: Pubkey,
    pool_mint: Pubkey,
    currency_mint: Pubkey,
) -> std::result::Result<(), OpenParamError> {
    if master_status != MasterAgreementStatus::Active as u8 {
        return Err(OpenParamError::MasterNotActive);
    }
    if creator != leader && creator != operator {
        return Err(OpenParamError::Unauthorized);
    }
    if subscriber_ref_len > MAX_SUBSCRIBER_REF_LEN {
        return Err(OpenParamError::InputTooLong);
    }
    if flight_no_len > MAX_FLIGHT_NO_LEN {
        return Err(OpenParamError::InputTooLong);
    }
    if route_len > MAX_ROUTE_LEN {
        return Err(OpenParamError::InputTooLong);
    }
    if leader_pool_key != stored_leader_pool {
        return Err(OpenParamError::InvalidInput);
    }
    if pool_owner != master_key {
        return Err(OpenParamError::InvalidSettlementTarget);
    }
    if payer_owner != creator {
        return Err(OpenParamError::Unauthorized);
    }
    if payer_mint != currency_mint {
        return Err(OpenParamError::InvalidInput);
    }
    if pool_mint != currency_mint {
        return Err(OpenParamError::InvalidInput);
    }
    Ok(())
}

pub fn handler(
    ctx: Context<CreateFlightPolicyFromMaster>,
    params: CreateFlightPolicyParams,
) -> Result<()> {
    let master = &ctx.accounts.master_agreement;
    validate_flight_policy_params(
        master.status,
        ctx.accounts.creator.key(),
        master.leader,
        master.operator,
        params.subscriber_ref.len(),
        params.flight_no.len(),
        params.route.len(),
        ctx.accounts.leader_pool_token.key(),
        master.leader_pool_wallet,
        ctx.accounts.leader_pool_token.owner,
        master.key(),
        ctx.accounts.payer_token.owner,
        ctx.accounts.payer_token.mint,
        ctx.accounts.leader_pool_token.mint,
        master.currency_mint,
    )?;

    // 가입 프리미엄은 생성자 지갑에서 리더 풀(PDA 소유)로 선납된다.
    let transfer_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.payer_token.to_account_info(),
            to: ctx.accounts.leader_pool_token.to_account_info(),
            authority: ctx.accounts.creator.to_account_info(),
        },
    );
    token::transfer(transfer_ctx, master.premium_per_policy)?;

    // Child(Flight) 정책 스냅샷을 생성 시점 값으로 초기화한다.
    let now = Clock::get()?.unix_timestamp;
    let flight = &mut ctx.accounts.flight_policy;
    flight.child_policy_id = params.child_policy_id;
    flight.master = master.key();
    flight.creator = ctx.accounts.creator.key();
    flight.subscriber_ref = params.subscriber_ref;
    flight.flight_no = params.flight_no;
    flight.route = params.route;
    flight.departure_ts = params.departure_ts;
    flight.premium_paid = master.premium_per_policy;
    flight.delay_minutes = 0;
    flight.cancelled = false;
    flight.payout_amount = 0;
    flight.status = FlightPolicyStatus::AwaitingOracle as u8;
    flight.premium_distributed = false;
    flight.created_at = now;
    flight.updated_at = now;
    flight.bump = ctx.bumps.flight_policy;

    Ok(())
}
