import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App";
import "./styles/theme.css";

// Optional — same "unset = skip silently" pattern as the backend's
// SENTRY_DSN (see core/config.py). Vite bakes VITE_-prefixed env vars
// in at build time, so this only takes effect on a build/deploy done
// after the variable is set — a running dev server or an already-built
// bundle won't pick it up retroactively.
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Registers the service worker added for installability (see
// public/sw.js) — service workers require a secure context, which
// localhost counts as, so this works in dev too, not just once deployed
// behind HTTPS.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Non-fatal — the app works fine without it, just without
      // installability/offline-shell-loading.
    });
  });
}
