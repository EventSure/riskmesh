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
    pub master_policy: Account<'info, MasterPolicy>,
    #[account(
        init,
        payer = creator,
        space = FLIGHT_POLICY_SPACE,
        seeds = [b"flight_policy", master_policy.key().as_ref(), &params.child_policy_id.to_le_bytes()],
        bump
    )]
    pub flight_policy: Account<'info, FlightPolicy>,
    #[account(mut)]
    pub payer_token: Account<'info, TokenAccount>,
    #[account(mut)]
    pub leader_deposit_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreateFlightPolicyFromMaster>, params: CreateFlightPolicyParams) -> Result<()> {
    let master = &ctx.accounts.master_policy;
    // 마스터 활성 상태/호출 권한/입력 길이를 먼저 검증한다.
    require!(master.status == MasterPolicyStatus::Active as u8, OpenParamError::MasterNotActive);
    require!(ctx.accounts.creator.key() == master.leader || ctx.accounts.creator.key() == master.operator, OpenParamError::Unauthorized);
    require!(params.subscriber_ref.len() <= MAX_SUBSCRIBER_REF_LEN, OpenParamError::InputTooLong);
    require!(params.flight_no.len() <= MAX_FLIGHT_NO_LEN, OpenParamError::InputTooLong);
    require!(params.route.len() <= MAX_ROUTE_LEN, OpenParamError::InputTooLong);

    require!(ctx.accounts.leader_deposit_token.key() == master.leader_deposit_wallet, OpenParamError::InvalidInput);
    require!(ctx.accounts.payer_token.owner == ctx.accounts.creator.key(), OpenParamError::Unauthorized);
    require!(ctx.accounts.payer_token.mint == master.currency_mint, OpenParamError::InvalidInput);
    require!(ctx.accounts.leader_deposit_token.mint == master.currency_mint, OpenParamError::InvalidInput);

    // 가입 프리미엄은 생성자 지갑에서 leader_deposit 지갑으로 선납된다.
    let transfer_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.payer_token.to_account_info(),
            to: ctx.accounts.leader_deposit_token.to_account_info(),
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
