use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;
use state::*;

// TODO: Replace with actual program id after `anchor keys list`
declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod open_parametric {
    use super::*;

    pub fn create_policy(ctx: Context<CreatePolicy>, params: CreatePolicyParams) -> Result<()> {
        instructions::create_policy::handler(ctx, params)
    }

    pub fn open_underwriting(ctx: Context<OpenUnderwriting>) -> Result<()> {
        instructions::open_underwriting::handler(ctx)
    }

    pub fn accept_share(ctx: Context<AcceptShare>, index: u8, deposit_amount: u64) -> Result<()> {
        instructions::accept_share::handler(ctx, index, deposit_amount)
    }

    pub fn reject_share(ctx: Context<RejectShare>, index: u8) -> Result<()> {
        instructions::reject_share::handler(ctx, index)
    }

    pub fn activate_policy(ctx: Context<ActivatePolicy>) -> Result<()> {
        instructions::activate_policy::handler(ctx)
    }

    pub fn check_oracle_and_create_claim(
        ctx: Context<CheckOracle>,
        oracle_round: u64,
    ) -> Result<()> {
        instructions::check_oracle::handler(ctx, oracle_round)
    }

    pub fn approve_claim(ctx: Context<ApproveClaim>) -> Result<()> {
        instructions::approve_settle_claim::approve_handler(ctx)
    }

    pub fn settle_claim(ctx: Context<SettleClaim>) -> Result<()> {
        instructions::approve_settle_claim::settle_handler(ctx)
    }

    pub fn expire_policy(ctx: Context<ExpirePolicy>) -> Result<()> {
        instructions::expire_refund::expire_handler(ctx)
    }

    pub fn refund_after_expiry(ctx: Context<RefundAfterExpiry>, share_index: u8) -> Result<()> {
        instructions::expire_refund::refund_handler(ctx, share_index)
    }

    pub fn register_policyholder(
        ctx: Context<RegisterPolicyholder>,
        entry: PolicyholderEntryInput,
    ) -> Result<()> {
        instructions::register_policyholder::handler(ctx, entry)
    }
}
