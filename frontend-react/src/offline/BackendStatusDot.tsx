import { useEffect, useState } from "react";
import api from "../api/axios";

const CHECK_INTERVAL_MS = 30_000;

/**
 * Answers a genuinely different question than OfflineBanner.tsx: that
 * component reflects the browser's own online/offline detection (are we
 * connected to a network at all); this actually calls GET /api/health
 * to confirm the backend itself is reachable and responding. A device
 * can be on WiFi (navigator.onLine === true) while the API is
 * unreachable — wrong VITE_API_BASE_URL, backend down, misconfigured
 * CORS rejecting the request — and OfflineBanner would stay silent
 * about that. This is the literal "frontend startup check" from the
 * integration notes, made persistent (checked periodically, not just
 * once on load) and visible in the UI rather than a console.log only
 * the developer would ever see.
 */
export default function BackendStatusDot() {
  const [reachable, setReachable] = useState<boolean | null>(null); // null = haven't checked yet

  useEffect(() => {
    let cancelled = false;
    function check() {
      api
        .get("/health")
        .then(() => { if (!cancelled) setReachable(true); })
        .catch(() => { if (!cancelled) setReachable(false); });
    }
    check();
    const interval = window.setInterval(check, CHECK_INTERVAL_MS);
    window.addEventListener("online", check);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("online", check);
    };
  }, []);

  if (reachable !== false) return null; // don't clutter the header when things are fine or still checking

  return (
    <span
      title="The app can't reach the HMZC server right now — check your connection or try again shortly. Anything you save is still kept on this device."
      style={{
        fontSize: 10.5,
        color: "#F3A9A0",
        border: "1px solid #B3382C",
        borderRadius: 20,
        padding: "3px 10px",
      }}
    >
      ● Server unreachable
    </span>
  );
}
