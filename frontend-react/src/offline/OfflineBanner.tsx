import { useEffect, useState } from "react";

/**
 * Standalone — doesn't depend on the certificate sync queue at all, just
 * the browser's own online/offline state. Shown globally (see AppShell)
 * rather than per-module, since losing connectivity affects every
 * module, not just Inspections.
 */
export default function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    function goOffline() { setOffline(true); }
    function goOnline() { setOffline(false); }
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="no-print"
      style={{
        background: "#B4690E",
        color: "#fff",
        textAlign: "center",
        fontSize: 12,
        fontWeight: 600,
        padding: "6px 12px",
      }}
    >
      You're offline — your work is being saved on this device and will sync automatically when the connection returns.
    </div>
  );
}
