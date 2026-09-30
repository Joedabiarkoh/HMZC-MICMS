import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";

// Requested directly, from a security review's additional-layers list:
// "idle/session timeout shorter than the JWT's raw expiry" — the token
// itself (see backend's ACCESS_TOKEN_EXPIRE_MINUTES, 60 min today) stays
// valid the whole time it's sitting in localStorage regardless of
// whether anyone's actually at the keyboard. This is a genuinely
// different, complementary control: sign someone out after they've
// stopped USING the app for a while, independent of the token's own
// natural expiry — the same reasoning core/account_lockout.py's own
// comment gives for why it's a different control from the per-IP rate
// limiter.
const IDLE_TIMEOUT_MINUTES = 20;
const WARNING_SECONDS = 60;
const CHECK_INTERVAL_MS = 5000;

const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart"] as const;

/**
 * Mounted once inside AppShell (see its own comment) — only ever
 * rendered while RequireAuth has already confirmed someone is signed
 * in, so this doesn't need its own "is anyone logged in" check.
 *
 * Deliberately doesn't reset the idle timer on ambient activity WHILE
 * the warning is showing — only the explicit "Stay Signed In" click
 * does. Otherwise a stray mouse twitch while someone's actually stepped
 * away would silently keep dismissing the one prompt meant to catch
 * exactly that case.
 */
export default function IdleTimeoutGuard() {
  const { logout } = useAuth();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const lastActivityRef = useRef(Date.now());
  const warningActiveRef = useRef(false);

  useEffect(() => {
    function markActivity() {
      if (warningActiveRef.current) return;
      lastActivityRef.current = Date.now();
    }
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, markActivity, { passive: true }));

    const interval = setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current;
      const timeoutMs = IDLE_TIMEOUT_MINUTES * 60 * 1000;
      const warningStartMs = timeoutMs - WARNING_SECONDS * 1000;

      if (idleMs >= timeoutMs) {
        signOutForInactivity();
        return;
      }
      if (idleMs >= warningStartMs) {
        warningActiveRef.current = true;
        setSecondsLeft(Math.ceil((timeoutMs - idleMs) / 1000));
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, markActivity));
      clearInterval(interval);
    };
  }, []);

  // A separate, faster-ticking interval only while the warning is up —
  // the 5s check above is plenty for noticing idleness in the first
  // place, but a countdown that only updated every 5s would look broken.
  useEffect(() => {
    if (secondsLeft === null) return;
    if (secondsLeft <= 0) {
      signOutForInactivity();
      return;
    }
    const tick = setTimeout(() => setSecondsLeft((s) => (s !== null ? s - 1 : null)), 1000);
    return () => clearTimeout(tick);
  }, [secondsLeft]);

  function signOutForInactivity() {
    // Same mechanism as api/axios.ts's own 401 interceptor (full page
    // navigation, not React state — sessionStorage is what survives
    // that reload for SignIn.tsx to read), with its own distinct reason
    // value so SignIn.tsx shows "signed out for inactivity" rather than
    // the unrelated "your session expired" message.
    localStorage.removeItem("hmzc_token");
    localStorage.removeItem("hmzc_user_cache");
    sessionStorage.setItem("hmzc_session_expired", "idle");
    window.location.href = "/signin";
  }

  function staySignedIn() {
    lastActivityRef.current = Date.now();
    warningActiveRef.current = false;
    setSecondsLeft(null);
  }

  if (secondsLeft === null) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="idle-timeout-title"
      style={{ position: "fixed", inset: 0, background: "rgba(15,25,35,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2100 }}
    >
      <div style={{ background: "#fff", borderRadius: 10, maxWidth: 380, width: "90%", padding: 22, boxShadow: "0 10px 40px rgba(0,0,0,.3)" }}>
        <div id="idle-timeout-title" style={{ fontWeight: 700, fontSize: 15, color: "#1F3B5C", marginBottom: 8 }}>
          Still there?
        </div>
        <p style={{ fontSize: 13, color: "#243040", lineHeight: 1.5, marginBottom: 18 }}>
          You've been inactive for a while. For security, you'll be signed out in{" "}
          <strong>{secondsLeft}s</strong> unless you stay signed in.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={() => { logout(); window.location.href = "/signin"; }}
            style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #C9D1D8", background: "#fff", color: "#243040", fontSize: 13, cursor: "pointer" }}
          >
            Sign Out Now
          </button>
          <button
            autoFocus
            onClick={staySignedIn}
            style={{ padding: "8px 16px", borderRadius: 6, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", color: "#fff", background: "#4C7A3A" }}
          >
            Stay Signed In
          </button>
        </div>
      </div>
    </div>
  );
}
