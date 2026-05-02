use crate::constants::MASTER_AGREEMENT_NAME_MAX_LEN;
use crate::errors::OpenParamError;

pub(crate) fn normalize_master_agreement_name(
    name: &str,
) -> std::result::Result<String, OpenParamError> {
    let normalized = name.trim();
    if normalized.is_empty() || normalized.chars().count() > MASTER_AGREEMENT_NAME_MAX_LEN {
        return Err(OpenParamError::InvalidInput);
    }
    Ok(normalized.to_string())
}
