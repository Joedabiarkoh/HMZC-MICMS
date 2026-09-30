// Requested directly: 2FA asking for a code on every single sign-in
// was "very difficult for some users" on Admin/Finance — see backend's
// core/trusted_devices.py for the full security reasoning behind
// "remember this device for 30 days." This is the frontend half: a
// small per-account map (not a single value) since more than one
// person can reasonably sign in from the same shared browser and each
// should keep their own trust state independent of the other's.
//
// Stored in localStorage, same place the main session token already
// lives (see AuthContext.tsx's own comment on that trade-off) — this
// value is deliberately narrow either way: on its own it can only ever
// skip the 2FA STEP for whichever single account it was issued to, on
// this exact browser: it's never a substitute for the password, and
// the backend only honors it when it belongs to the account being
// signed into (see core/trusted_devices.find_trusted_device).
const DEVICE_TOKENS_KEY = "hmzc_device_tokens";

function readAll(): Record<string, string> {
  try {
    const raw = localStorage.getItem(DEVICE_TOKENS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, string>) {
  localStorage.setItem(DEVICE_TOKENS_KEY, JSON.stringify(all));
}

export function getDeviceToken(email: string): string | null {
  return readAll()[email.toLowerCase()] || null;
}

export function setDeviceToken(email: string, token: string): void {
  const all = readAll();
  all[email.toLowerCase()] = token;
  writeAll(all);
}

/** Called wherever the server-side equivalent (core/trusted_devices.
 * clear_trusted_devices) runs — disabling 2FA, changing password,
 * etc. Not required for security (an invalid/cleared token is simply
 * rejected server-side either way), just tidy: no point holding onto
 * a token the server has already forgotten. */
export function clearDeviceToken(email: string): void {
  const all = readAll();
  delete all[email.toLowerCase()];
  writeAll(all);
}
