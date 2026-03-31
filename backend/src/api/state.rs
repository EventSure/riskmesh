use std::sync::Arc;

use crate::config::Config;
use crate::events::EventBus;

use super::repository::FirebaseRepository;

#[derive(Clone)]
pub(super) struct AppState {
    pub config: Arc<Config>,
    pub firebase_repository: Arc<FirebaseRepository>,
    pub event_bus: Arc<EventBus>,
}
