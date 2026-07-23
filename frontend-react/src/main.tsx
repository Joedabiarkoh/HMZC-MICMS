import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/theme.css";

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
