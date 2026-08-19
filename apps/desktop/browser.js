import { exec } from 'child_process';

/**
 * Opens a URL in the user's default web browser with zero console or PowerShell flash.
 * @param {string} url 
 */
export function openBrowser(url) {
  if (process.platform === 'win32') {
    exec(`start "" "${url}"`, { windowsHide: true, shell: 'cmd.exe' }, () => {});
  } else if (process.platform === 'darwin') {
    exec(`open "${url}"`, () => {});
  } else {
    exec(`xdg-open "${url}"`, () => {});
  }
}
