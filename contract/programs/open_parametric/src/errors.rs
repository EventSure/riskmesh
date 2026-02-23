use anchor_lang::prelude::*;

#[error_code]
pub enum OpenParamError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid state for this instruction")]
    InvalidState,
    #[msg("Invalid ratio sum")]
    InvalidRatio,
    #[msg("Already exists")]
    AlreadyExists,
    #[msg("Not found")]
    NotFound,
    #[msg("Insufficient escrow")]
    InsufficientEscrow,
    #[msg("Pool has insufficient balance")]
    PoolInsufficient,
    #[msg("Oracle value is stale")]
    OracleStale,
    #[msg("Oracle value format is invalid")]
    OracleFormat,
    #[msg("Invalid time window")]
    InvalidTimeWindow,
    #[msg("Invalid input")]
    InvalidInput,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Invalid delay threshold")]
    InvalidDelayThreshold,
    #[msg("Input too long")]
    InputTooLong,
}
