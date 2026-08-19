import { execSync } from 'child_process';
import path from 'path';

const REG_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const APP_NAME = 'LocalFastShares';

/**
 * Checks if LocalFastShares is configured to launch on Windows startup.
 * @returns {boolean}
 */
export function isAutostartEnabled() {
  if (process.platform !== 'win32') return false;
  try {
    const stdout = execSync(`reg query "${REG_KEY}" /v "${APP_NAME}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    });
    return stdout.includes(APP_NAME);
  } catch (e) {
    return false;
  }
}

/**
 * Enables autostart on Windows boot.
 * @param {string} [customExePath] Optional custom executable path
 * @returns {boolean}
 */
export function enableAutostart(customExePath) {
  if (process.platform !== 'win32') return false;
  try {
    const exePath = customExePath || process.execPath;
    execSync(`reg add "${REG_KEY}" /v "${APP_NAME}" /t REG_SZ /d "\"${exePath}\"" /f`, {
      stdio: 'ignore'
    });
    console.log(`[LFS AUTOSTART] Enabled startup entry: ${exePath}`);
    return true;
  } catch (err) {
    console.error('[LFS AUTOSTART] Failed to enable autostart:', err.message);
    return false;
  }
}

/**
 * Disables autostart on Windows boot.
 * @returns {boolean}
 */
export function disableAutostart() {
  if (process.platform !== 'win32') return false;
  try {
    execSync(`reg delete "${REG_KEY}" /v "${APP_NAME}" /f`, {
      stdio: 'ignore'
    });
    console.log('[LFS AUTOSTART] Disabled startup entry.');
    return true;
  } catch (err) {
    console.error('[LFS AUTOSTART] Failed to disable autostart:', err.message);
    return false;
  }
}

/**
 * Toggles autostart status.
 * @param {string} [customExePath]
 * @returns {boolean} New autostart status
 */
export function toggleAutostart(customExePath) {
  const current = isAutostartEnabled();
  if (current) {
    disableAutostart();
    return false;
  } else {
    enableAutostart(customExePath);
    return true;
  }
}
