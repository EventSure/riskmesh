use std::sync::Arc;

use crate::config::Config;

#[derive(Clone)]
pub(super) struct AppState {
    pub config: Arc<Config>,
}
