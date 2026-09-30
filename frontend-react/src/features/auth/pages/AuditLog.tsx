import { useEffect, useState } from "react";
import "../auth.css";
import { listAuditLog } from "../services/auth.api";
import { AuditLogEntry } from "../types/auth.types";

// Every action string record_audit() actually calls with today (see
// api/routes/auth.py, certificates.py, settings.py) — this list had
// fallen behind as new audited actions were added (password_reset_self_service,
// permissions_changed, deleted, profile_update, created_by_admin,
// settings.*, and every account-lockout/2FA action below) and would
// otherwise just print the raw action string for anything not listed.
const ACTION_LABELS: Record<string, string> = {
  login: "Signed in",
  "certificate.save": "Saved a certificate",
  "user.created_by_admin": "Created an account",
  "user.role_change": "Changed a role",
  "user.profile_update": "Updated a profile",
  "user.approved": "Approved an account",
  "user.deactivated": "Deactivated an account",
  "user.deleted": "Deleted an account",
  "user.unlocked": "Unlocked an account",
  "user.permissions_changed": "Changed access permissions",
  "user.password_reset_by_admin": "Reset a password (admin)",
  "user.password_reset_self_service": "Reset their own password (forgot password)",
  "user.password_changed": "Changed their own password",
  "user.logout_everywhere": "Signed out of all devices",
  "user.2fa_enabled": "Enabled two-factor authentication",
  "user.2fa_disabled": "Disabled their own two-factor authentication",
  "user.2fa_disabled_by_admin": "Disabled two-factor authentication (admin)",
  "settings.expiry_reminder_emails_changed": "Changed expiry reminder recipients",
  "settings.company_info_changed": "Changed company information",
};

/**
 * The read side of app/core/audit.py's record_audit — the backend has
 * written these events since the audit log was added, but nothing
 * could display them (see the README's former "Next step"). Scoped the
 * same way the backend scoped what gets logged: login, certificate
 * saves, and account/role/password changes — not every click.
 */
// The backend caps a single request at 500 (see list_audit_log) —
// requesting exactly that many is how "Load more" below knows there's
// nothing further back to fetch.
const BACKEND_MAX_LIMIT = 500;

export default function AuditLog() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [limit, setLimit] = useState(200);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  useEffect(() => {
    setErr("");
    listAuditLog(limit)
      .then(setEntries)
      .catch((e) => setErr(e?.response?.data?.detail || "Could not load the audit log."))
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });
  }, [limit]);

  function loadMore() {
    setLoadingMore(true);
    setLimit((prev) => Math.min(prev + 200, BACKEND_MAX_LIMIT));
  }

  const actions = Array.from(new Set(entries.map((e) => e.action))).sort();

  const filtered = entries.filter((e) => {
    if (actionFilter && e.action !== actionFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (e.user?.email || "").toLowerCase().includes(q) ||
      (e.user?.full_name || "").toLowerCase().includes(q) ||
      (e.resource_id || "").toLowerCase().includes(q) ||
      (e.detail || "").toLowerCase().includes(q) ||
      (e.ip_address || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="users-page">
      <h1>Audit Log ({entries.length})</h1>
      <p style={{ fontSize: 11.5, color: "#6B7480", marginTop: -6, marginBottom: 14 }}>
        Logins, certificate saves, and account/role/password changes — not every action, by design.
        See the README for what's scoped in and why.
      </p>

      {err && <div className="auth-error">{err}</div>}

      {!loading && !err && (
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Search by user, resource, detail, or IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "8px 10px", border: "1px solid #C9D1D8", borderRadius: 6, fontSize: 13, minWidth: 260 }}
          />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            style={{ padding: "8px 10px", border: "1px solid #C9D1D8", borderRadius: 6, fontSize: 13 }}
          >
            <option value="">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>
            ))}
          </select>
        </div>
      )}

      {loading && <p>Loading...</p>}

      {!loading && !err && (
        <table className="users-table">
          <thead>
            <tr><th>When</th><th>Who</th><th>Action</th><th>Resource</th><th>Detail</th><th>IP</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: 20, color: "#6B7480" }}>No matching entries.</td></tr>
            )}
            {filtered.map((e) => (
              <tr key={e.id}>
                <td>{new Date(e.created_at).toLocaleString()}</td>
                <td>{e.user ? (e.user.full_name || e.user.email) : "—"}</td>
                <td>{ACTION_LABELS[e.action] || e.action}</td>
                <td>{e.resource_type ? `${e.resource_type} ${e.resource_id || ""}`.trim() : "—"}</td>
                <td>{e.detail || "—"}</td>
                <td style={{ fontFamily: "monospace", fontSize: 11 }}>{e.ip_address || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* entries.length < limit means the backend had fewer rows than
          we asked for — genuinely nothing further back exists, so
          there's nothing "more" to load. limit === BACKEND_MAX_LIMIT
          means we've already hit the backend's own cap. */}
      {!loading && !err && entries.length >= limit && limit < BACKEND_MAX_LIMIT && (
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <button className="auth-btn" style={{ width: "auto", padding: "7px 16px" }} onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading..." : "Load Older Entries"}
          </button>
        </div>
      )}
    </div>
  );
}
