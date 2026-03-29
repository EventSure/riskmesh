use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod math;
pub mod state;

use instructions::*;
use state::*;

declare_id!("ETEEEssGKAAQEGwz3ggDcy9vzPAPtBjtb2KocdyLBMjh");

#[program]
pub mod open_parametric {
    use super::*;

    // ─── Master/Flight — Track A (수동 resolver) & Track B (Switchboard 공용) ───

    pub fn create_master_policy(
        ctx: Context<CreateMasterPolicy>,
        params: CreateMasterPolicyParams,
    ) -> Result<()> {
        instructions::create_master_policy::handler(ctx, params)
    }

    pub fn register_participant_wallets(ctx: Context<RegisterParticipantWallets>) -> Result<()> {
        instructions::register_participant_wallets::handler(ctx)
    }

    pub fn confirm_master(ctx: Context<ConfirmMaster>, role: u8) -> Result<()> {
        instructions::confirm_master::handler(ctx, role)
    }

    pub fn activate_master(ctx: Context<ActivateMaster>) -> Result<()> {
        instructions::activate_master::handler(ctx)
    }

    pub fn create_flight_policy_from_master(
        ctx: Context<CreateFlightPolicyFromMaster>,
        params: CreateFlightPolicyParams,
    ) -> Result<()> {
        instructions::create_flight_policy_from_master::handler(ctx, params)
    }

    // ─── Track A — AviationStack 수동 resolver ───────────────────────────────

    pub fn resolve_flight_delay(
        ctx: Context<ResolveFlightDelay>,
        delay_minutes: u16,
        cancelled: bool,
    ) -> Result<()> {
        instructions::resolve_flight_delay::handler(ctx, delay_minutes, cancelled)
    }

    // ─── Track B — Switchboard On-Demand oracle 자동화 ───────────────────────

    /// 3-instruction 트랜잭션 필요: [Ed25519, verified_update, 이 instruction]
    pub fn check_oracle_and_resolve_flight(
        ctx: Context<CheckOracleAndResolveFlight>,
    ) -> Result<()> {
        instructions::check_oracle_and_resolve_flight::handler(ctx)
    }

    // ─── Settlement (Track A + B 공용) ───────────────────────────────────────

    pub fn settle_flight_claim<'a>(
        ctx: Context<'_, '_, 'a, 'a, SettleFlightClaim<'a>>,
    ) -> Result<()> {
        instructions::settle_flight_claim::handler(ctx)
    }

    pub fn settle_flight_no_claim<'a>(
        ctx: Context<'_, '_, 'a, 'a, SettleFlightNoClaim<'a>>,
    ) -> Result<()> {
        instructions::settle_flight_no_claim::handler(ctx)
    }
}
