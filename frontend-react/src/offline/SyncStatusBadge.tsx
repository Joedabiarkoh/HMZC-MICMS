import { useEffect, useState } from "react";
import { pendingCount, flushQueue } from "./syncQueue";

/**
 * A persistent "how much work hasn't reached the server yet" indicator,
 * shown in the nav shell rather than buried in a per-page banner (the
 * per-page banners in InspectionWorkspace/CertificateLog still exist for
 * detail — this is the always-visible summary). Polls rather than
 * subscribing to a shared store, since the queue lives in IndexedDB, not
 * React state — simplest correct approach without introducing a global
 * state manager for one counter.
 */
export default function SyncStatusBadge() {
  const [count, setCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    function refresh() {
      pendingCount().then((n) => { if (!cancelled) setCount(n); });
    }
    refresh();
    const interval = window.setInterval(refresh, 10_000);
    window.addEventListener("online", refresh);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("online", refresh);
    };
  }, []);

  async function retryNow() {
    setSyncing(true);
    try {
      const { remaining } = await flushQueue();
      setCount(remaining);
    } finally {
      setSyncing(false);
    }
  }

  if (count === 0 && !syncing) {
    return <span style={{ fontSize: 10.5, color: "#8FA6B8" }} title="Everything is synced">● Synced</span>;
  }

  return (
    <button
      onClick={retryNow}
      disabled={syncing}
      title="Click to retry syncing now"
      style={{
        background: "none",
        border: "1px solid #B4690E",
        color: "#F3C98A",
        borderRadius: 20,
        padding: "3px 10px",
        fontSize: 10.5,
        cursor: syncing ? "default" : "pointer",
      }}
    >
      {syncing ? "Syncing…" : `${count} pending sync — Retry`}
    </button>
  );
}
