// ──────────────────────────────────────────────────────────
// Phase 2-C — macOS Keychain wrapper for secret values
// ──────────────────────────────────────────────────────────
//
// Stores user-supplied secrets (API keys, GitHub PATs, …) in the
// login keychain under a single service name so they persist across
// app restarts without ever touching settings.json.
//
// All entries live under service "0canvas" + the caller-chosen
// account string — for example, set("anthropic-api-key", "sk-…")
// lands at (service=0canvas, account=anthropic-api-key).
//
// The frontend never sees raw keychain APIs; it goes through the
// three Tauri commands below. Non-macOS platforms get a stub that
// returns an error — we're Mac-only at v0.1 anyway.
// ──────────────────────────────────────────────────────────

use serde::Serialize;

const SERVICE: &str = "0canvas";

#[derive(Debug, Serialize)]
pub struct SecretError {
    message: String,
}

impl SecretError {
    fn new(msg: impl Into<String>) -> Self {
        Self { message: msg.into() }
    }
}

impl std::fmt::Display for SecretError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.message)
    }
}

#[cfg(target_os = "macos")]
mod macos {
    use super::*;
    use security_framework::passwords::{
        delete_generic_password, get_generic_password, set_generic_password,
    };

    pub fn set(account: &str, value: &str) -> Result<(), SecretError> {
        set_generic_password(SERVICE, account, value.as_bytes())
            .map_err(|e| SecretError::new(format!("keychain set failed: {e}")))
    }

    pub fn get(account: &str) -> Result<Option<String>, SecretError> {
        match get_generic_password(SERVICE, account) {
            Ok(bytes) => String::from_utf8(bytes)
                .map(Some)
                .map_err(|e| SecretError::new(format!("keychain value not utf8: {e}"))),
            Err(e) => {
                // errSecItemNotFound is the expected miss; surface all
                // others so we don't silently paper over permissions or
                // corruption issues.
                if e.code() == -25300 {
                    Ok(None)
                } else {
                    Err(SecretError::new(format!("keychain get failed: {e}")))
                }
            }
        }
    }

    pub fn delete(account: &str) -> Result<(), SecretError> {
        match delete_generic_password(SERVICE, account) {
            Ok(()) => Ok(()),
            Err(e) if e.code() == -25300 => Ok(()), // already absent
            Err(e) => Err(SecretError::new(format!("keychain delete failed: {e}"))),
        }
    }
}

#[cfg(not(target_os = "macos"))]
mod macos {
    use super::*;
    pub fn set(_: &str, _: &str) -> Result<(), SecretError> {
        Err(SecretError::new("keychain only available on macOS"))
    }
    pub fn get(_: &str) -> Result<Option<String>, SecretError> {
        Err(SecretError::new("keychain only available on macOS"))
    }
    pub fn delete(_: &str) -> Result<(), SecretError> {
        Err(SecretError::new("keychain only available on macOS"))
    }
}

#[tauri::command]
pub fn keychain_set(account: String, value: String) -> Result<(), SecretError> {
    macos::set(&account, &value)
}

#[tauri::command]
pub fn keychain_get(account: String) -> Result<Option<String>, SecretError> {
    macos::get(&account)
}

#[tauri::command]
pub fn keychain_delete(account: String) -> Result<(), SecretError> {
    macos::delete(&account)
}
