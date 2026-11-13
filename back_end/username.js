const RESERVED_USERNAMES = new Set([
  'admin', 'help', 'microteach', 'moderator', 'root', 'security', 'support', 'system'
]);

function normalizeUsername(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function usernameError(username) {
  if (!/^[a-z0-9_][a-z0-9._]{1,28}[a-z0-9_]$/.test(username) || username.includes('..')) {
    return 'Username must be 3–30 characters using letters, numbers, underscores, or single periods. It cannot start or end with a period.';
  }
  if (RESERVED_USERNAMES.has(username)) return 'This username is unavailable.';
  return null;
}

module.exports = { normalizeUsername, usernameError };
