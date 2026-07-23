import { useState } from "react";

// Every destructive action in this app (deactivate a user, reset a
// password, delete an invoice/quotation/certificate) used the browser's
// native window.confirm() — flagged directly in a readiness review as
// worth replacing, since it's easy to reflexively click through without
// reading (and can't be styled, so it doesn't even look like it belongs
// to this app). This is a small, deliberately generic replacement: one
// component, used the same way everywhere, rather than a bespoke modal
// per action.

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

interface ConfirmDialogState extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

let showDialog: ((opts: ConfirmDialogState) => void) | null = null;

/**
 * Drop-in replacement for `window.confirm(message)`: `await confirmAction({...})`
 * resolves to true/false the same way, but renders this app's own styled
 * dialog instead of the browser's. Requires <ConfirmDialogHost /> to be
 * mounted once, near the root (see AppShell.tsx) — this function just
 * hands the request to whichever host is currently mounted.
 */
export function confirmAction(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!showDialog) {
      // No host mounted for some reason — fail safe to the browser's
      // own confirm rather than silently never resolving.
      resolve(window.confirm(`${opts.title}\n\n${opts.message}`));
      return;
    }
    showDialog({ ...opts, resolve });
  });
}

export default function ConfirmDialogHost() {
  const [state, setState] = useState<ConfirmDialogState | null>(null);

  showDialog = (opts) => setState(opts);

  if (!state) return null;

  function respond(confirmed: boolean) {
    state!.resolve(confirmed);
    setState(null);
  }

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      style={{
        position: "fixed", inset: 0, background: "rgba(15,25,35,.5)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000,
      }}
    >
      <div style={{ background: "#fff", borderRadius: 10, maxWidth: 400, width: "90%", padding: 22, boxShadow: "0 10px 40px rgba(0,0,0,.3)" }}>
        <div id="confirm-dialog-title" style={{ fontWeight: 700, fontSize: 15, color: "#1F3B5C", marginBottom: 8 }}>
          {state.title}
        </div>
        <p style={{ fontSize: 13, color: "#243040", lineHeight: 1.5, marginBottom: 18 }}>{state.message}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={() => respond(false)}
            style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #C9D1D8", background: "#fff", color: "#243040", fontSize: 13, cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            autoFocus
            onClick={() => respond(true)}
            style={{
              padding: "8px 16px", borderRadius: 6, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", color: "#fff",
              background: state.danger ? "#B3382C" : "#4C7A3A",
            }}
          >
            {state.confirmLabel || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
