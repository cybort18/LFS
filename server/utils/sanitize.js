import path from 'path';

/**
 * Sanitizes incoming filename to prevent path traversal, control character injection, or null byte exploits.
 * @param {string} filename 
 * @returns {string} Sanitized safe filename
 */
export function sanitizeFilename(filename) {
  if (typeof filename !== 'string' || !filename.trim()) {
    return 'unnamed_file';
  }

  // Extract base filename (removes directory paths like /etc/passwd or C:\windows)
  let safeName = path.basename(filename);

  // Remove control characters (0x00-0x1F, 0x7F) and illegal OS characters (\ / : * ? " < > |)
  safeName = safeName.replace(/[\x00-\x1F\x7F\\/:\*\?"<>\|]/g, '_');

  // Strip leading dots to prevent hidden files or relative dots (.env, ..)
  safeName = safeName.replace(/^\.+/, '');

  if (!safeName) {
    return 'unnamed_file';
  }

  return safeName;
}
