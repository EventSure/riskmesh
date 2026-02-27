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
    // 마스터 계약 활성화 전 필수 승인(운영자/재보험사/참여사 지갑 등록)을 확인한다.
    require!(
        master.status == MasterPolicyStatus::PendingConfirm as u8,
        OpenParamError::InvalidState
    );
    require!(
        ctx.accounts.operator.key() == master.operator,
        OpenParamError::Unauthorized
    );
    require!(
        master.reinsurer_confirmed,
        OpenParamError::MasterNotConfirmed
    );

    let all_confirmed = all_participants_confirmed(&master.participants);
    require!(all_confirmed, OpenParamError::MasterNotConfirmed);

    master.status = MasterPolicyStatus::Active as u8;
    Ok(())
}

pub(crate) fn all_participants_confirmed(participants: &[MasterParticipant]) -> bool {
    // confirmed 플래그와 정산 지갑 등록 여부를 동시에 확인한다.
    participants.iter().all(|p| {
        p.confirmed && p.pool_wallet != Pubkey::default() && p.deposit_wallet != Pubkey::default()
    })
}
