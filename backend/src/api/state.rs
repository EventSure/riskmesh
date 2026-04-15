use std::sync::Arc;

use crate::config::Config;
use crate::events::EventBus;

use super::repository::InsuranceRepository;

#[derive(Clone)]
pub(super) struct AppState {
    pub config: Arc<Config>,
    pub repository: Arc<dyn InsuranceRepository>,
    pub event_bus: Arc<EventBus>,
}
