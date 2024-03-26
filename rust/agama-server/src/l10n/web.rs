//! This module implements the web API for the localization module.

use super::{keyboard::Keymap, locale::LocaleEntry, timezone::TimezoneEntry, L10n};
use crate::{
    error::Error,
    l10n::helpers,
    web::{Event, EventsSender},
};
use agama_locale_data::{InvalidKeymap, LocaleId};
use axum::{
    extract::State,
    routing::{get, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::{
    process::Command,
    sync::{Arc, RwLock},
};

#[derive(thiserror::Error, Debug)]
pub enum LocaleError {
    #[error("Unknown locale code: {0}")]
    UnknownLocale(String),
    #[error("Unknown timezone: {0}")]
    UnknownTimezone(String),
    #[error("Invalid keymap: {0}")]
    InvalidKeymap(#[from] InvalidKeymap),
    #[error("Could not apply the changes")]
    Commit(#[from] std::io::Error),
}

#[derive(Clone)]
struct LocaleState {
    locale: Arc<RwLock<L10n>>,
    events: EventsSender,
}

/// Sets up and returns the axum service for the localization module.
///
/// * `events`: channel to send the events to the main service.
pub fn l10n_service(events: EventsSender) -> Router {
    let id = LocaleId::default();
    let locale = L10n::new_with_locale(&id).unwrap();
    let state = LocaleState {
        locale: Arc::new(RwLock::new(locale)),
        events,
    };

    Router::new()
        .route("/keymaps", get(keymaps))
        .route("/locales", get(locales))
        .route("/timezones", get(timezones))
        .route("/config", put(set_config).get(get_config))
        .with_state(state)
}

#[utoipa::path(get, path = "/l10n/locales", responses(
  (status = 200, description = "List of known locales", body = Vec<LocaleEntry>)
))]
async fn locales(State(state): State<LocaleState>) -> Json<Vec<LocaleEntry>> {
    let data = state.locale.read().unwrap();
    let locales = data.locales_db.entries().to_vec();
    Json(locales)
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, utoipa::ToSchema)]
pub struct LocaleConfig {
    /// Locales to install in the target system
    locales: Option<Vec<String>>,
    /// Keymap for the target system
    keymap: Option<String>,
    /// Timezone for the target system
    timezone: Option<String>,
    /// User-interface locale. It is actually not related to the `locales` property.
    ui_locale: Option<String>,
    /// User-interface locale. It is relevant only on local installations.
    ui_keymap: Option<String>,
}

#[utoipa::path(get, path = "/l10n/timezones", responses(
    (status = 200, description = "List of known timezones")
))]
async fn timezones(State(state): State<LocaleState>) -> Json<Vec<TimezoneEntry>> {
    let data = state.locale.read().unwrap();
    let timezones = data.timezones_db.entries().to_vec();
    Json(timezones)
}

#[utoipa::path(get, path = "/l10n/keymaps", responses(
    (status = 200, description = "List of known keymaps", body = Vec<Keymap>)
))]
async fn keymaps(State(state): State<LocaleState>) -> Json<Vec<Keymap>> {
    let data = state.locale.read().unwrap();
    let keymaps = data.keymaps_db.entries().to_vec();
    Json(keymaps)
}

// TODO: update all or nothing
// TODO: send only the attributes that have changed
#[utoipa::path(put, path = "/l10n/config", responses(
    (status = 200, description = "Set the locale configuration", body = LocaleConfig)
))]
async fn set_config(
    State(state): State<LocaleState>,
    Json(value): Json<LocaleConfig>,
) -> Result<Json<()>, Error> {
    let mut data = state.locale.write().unwrap();
    let mut changes = LocaleConfig::default();

    if let Some(locales) = &value.locales {
        for loc in locales {
            if !data.locales_db.exists(loc.as_str()) {
                return Err(LocaleError::UnknownLocale(loc.to_string()))?;
            }
        }
        data.locales = locales.clone();
        changes.locales = Some(data.locales.clone());
    }

    if let Some(timezone) = &value.timezone {
        if !data.timezones_db.exists(timezone) {
            return Err(LocaleError::UnknownTimezone(timezone.to_string()))?;
        }
        data.timezone = timezone.to_owned();
        changes.timezone = Some(data.timezone.clone());
    }

    if let Some(keymap_id) = &value.keymap {
        data.keymap = keymap_id.parse().map_err(LocaleError::InvalidKeymap)?;
        changes.keymap = Some(keymap_id.clone());
    }

    if let Some(ui_locale) = &value.ui_locale {
        let locale: LocaleId = ui_locale
            .as_str()
            .try_into()
            .map_err(|_e| LocaleError::UnknownLocale(ui_locale.to_string()))?;

        helpers::set_service_locale(&locale);
        data.translate(&locale)?;
        changes.ui_locale = Some(locale.to_string());
        _ = state.events.send(Event::LocaleChanged {
            locale: locale.to_string(),
        });
    }

    if let Some(ui_keymap) = &value.ui_keymap {
        // data.ui_keymap = ui_keymap.parse().into::<Result<KeymapId, LocaleError>>()?;
        data.ui_keymap = ui_keymap.parse().map_err(LocaleError::InvalidKeymap)?;
        Command::new("/usr/bin/localectl")
            .args(["set-x11-keymap", &ui_keymap])
            .output()
            .map_err(LocaleError::Commit)?;
        Command::new("/usr/bin/setxkbmap")
            .arg(ui_keymap)
            .env("DISPLAY", ":0")
            .output()
            .map_err(LocaleError::Commit)?;
    }

    _ = state.events.send(Event::L10nConfigChanged(changes));

    Ok(Json(()))
}

#[utoipa::path(get, path = "/l10n/config", responses(
    (status = 200, description = "Localization configuration", body = LocaleConfig)
))]
async fn get_config(State(state): State<LocaleState>) -> Json<LocaleConfig> {
    let data = state.locale.read().unwrap();
    Json(LocaleConfig {
        locales: Some(data.locales.clone()),
        keymap: Some(data.keymap()),
        timezone: Some(data.timezone().to_string()),
        ui_locale: Some(data.ui_locale().to_string()),
        ui_keymap: Some(data.ui_keymap.to_string()),
    })
}

#[cfg(test)]
mod tests {
    use crate::l10n::{web::LocaleState, L10n};
    use agama_locale_data::{KeymapId, LocaleId};
    use std::sync::{Arc, RwLock};
    use tokio::{sync::broadcast::channel, test};

    fn build_state() -> LocaleState {
        let (tx, _) = channel(16);
        let default_code = LocaleId::default();
        let locale = L10n::new_with_locale(&default_code).unwrap();
        LocaleState {
            locale: Arc::new(RwLock::new(locale)),
            events: tx,
        }
    }

    #[test]
    async fn test_locales() {
        let state = build_state();
        let response = super::locales(axum::extract::State(state)).await;
        let default = LocaleId::default();
        let found = response.iter().find(|l| l.id == default);
        assert!(found.is_some());
    }

    #[test]
    async fn test_keymaps() {
        let state = build_state();
        let response = super::keymaps(axum::extract::State(state)).await;
        let english: KeymapId = "us".parse().unwrap();
        let found = response.iter().find(|k| k.id == english);
        assert!(found.is_some());
    }

    #[test]
    async fn test_timezones() {
        let state = build_state();
        let response = super::timezones(axum::extract::State(state)).await;
        let found = response.iter().find(|t| t.code == "Atlantic/Canary");
        assert!(found.is_some());
    }
}
