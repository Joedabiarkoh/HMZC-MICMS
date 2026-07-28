import { useEffect, useState } from "react";
import "../auth.css";
import { getCompanyInfo, getExpiryReminderSettings, updateCompanyInfo, updateExpiryReminderSettings } from "../services/auth.api";
import { CompanyInfo, ExpiryReminderSettings } from "../types/auth.types";

/**
 * Certificate expiry reminders (backend-fastapi's core/expiry_reminders.py)
 * used to only be configurable by editing the server's
 * EXPIRY_REMINDER_EMAILS env var and restarting the backend container —
 * fine for whoever set it up originally, but a problem the moment the
 * person actually responsible for certificate renewals changes role or
 * leaves, since updating it needed server access nobody in that role
 * necessarily has. This page is the in-app replacement: an administrator
 * can add or remove recipients here at any time, no restart needed. The
 * env var still works as a one-time fallback (see
 * api/routes/settings.py) for a deployment that set it and has never
 * saved a change here.
 *
 * Grew a second section (Company Information) once HMZC's PEPPOL ID
 * needed an admin-editable home too — kept on this same admin-only
 * page rather than a new one, since both are "settings only an admin
 * changes, rarely." The page title/nav label changed from "Notification
 * Settings" to "Settings" to reflect that it's no longer notification-only.
 */
export default function NotificationSettings() {
  const [settings, setSettings] = useState<ExpiryReminderSettings | null>(null);
  const [emails, setEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);

  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [peppolId, setPeppolId] = useState("");
  const [companyLoading, setCompanyLoading] = useState(true);
  const [companySaving, setCompanySaving] = useState(false);
  const [companyErr, setCompanyErr] = useState("");
  const [companySaved, setCompanySaved] = useState(false);

  function load() {
    setLoading(true);
    getExpiryReminderSettings()
      .then((data) => {
        setSettings(data);
        setEmails(data.emails);
      })
      .catch((e) => setErr(e?.response?.data?.detail || "Could not load notification settings."))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function loadCompanyInfo() {
    setCompanyLoading(true);
    getCompanyInfo()
      .then((data) => {
        setCompanyInfo(data);
        setPeppolId(data.peppol_id || "");
      })
      .catch((e) => setCompanyErr(e?.response?.data?.detail || "Could not load company information."))
      .finally(() => setCompanyLoading(false));
  }
  useEffect(loadCompanyInfo, []);

  async function saveCompanyInfo() {
    setCompanySaving(true);
    setCompanyErr("");
    setCompanySaved(false);
    try {
      const updated = await updateCompanyInfo(peppolId.trim());
      setCompanyInfo(updated);
      setPeppolId(updated.peppol_id || "");
      setCompanySaved(true);
    } catch (e: any) {
      setCompanyErr(e?.response?.data?.detail || "Could not save company information.");
    } finally {
      setCompanySaving(false);
    }
  }

  function addEmail(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newEmail.trim();
    if (!trimmed) return;
    if (emails.includes(trimmed)) {
      setNewEmail("");
      return;
    }
    setEmails((prev) => [...prev, trimmed]);
    setNewEmail("");
    setSaved(false);
  }

  function removeEmail(email: string) {
    setEmails((prev) => prev.filter((e) => e !== email));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setErr("");
    setSaved(false);
    try {
      const updated = await updateExpiryReminderSettings(emails);
      setSettings(updated);
      setEmails(updated.emails);
      setSaved(true);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Could not save notification settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="users-page">
      <h1>Settings</h1>

      <h2 style={{ fontSize: 14, color: "#1F3B5C", marginTop: 20, marginBottom: 4 }}>Certificate Expiry Reminders</h2>
      <p style={{ fontSize: 11.5, color: "#6B7480", marginTop: 0, marginBottom: 18 }}>
        Recipients for the certificate expiry reminder email — sent when a finalized certificate is
        approaching its one-year expiry. Update this whenever the person responsible for renewals
        changes role or leaves; no server access needed, unlike editing EXPIRY_REMINDER_EMAILS used to be.
      </p>

      {loading && <p>Loading...</p>}
      {err && <div className="auth-error">{err}</div>}

      {!loading && (
        <>
          <div style={{ background: "#F4F6F7", border: "1px solid #DCE1E5", borderRadius: 8, padding: 16, marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 11, color: "#6B7480", marginBottom: 6, fontWeight: 600 }}>
              Reminder Recipients
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: emails.length ? 12 : 0 }}>
              {emails.map((email) => (
                <span key={email} className="perm-pill" style={{ fontSize: 12, padding: "4px 8px" }}>
                  {email}{" "}
                  <button
                    type="button"
                    onClick={() => removeEmail(email)}
                    aria-label={`Remove ${email}`}
                    style={{ border: "none", background: "none", color: "#B3382C", cursor: "pointer", fontWeight: 700, marginLeft: 4, padding: 0 }}
                  >
                    ×
                  </button>
                </span>
              ))}
              {emails.length === 0 && (
                <span style={{ fontSize: 12, color: "#6B7480" }}>No recipients configured — reminders are currently off.</span>
              )}
            </div>
            <form onSubmit={addEmail} style={{ display: "flex", gap: 8 }}>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="e.g. admin@yourcompany.com"
                style={{ flex: 1, padding: "7px 9px", border: "1px solid #C9D1D8", borderRadius: 5, fontSize: 13 }}
              />
              <button className="auth-btn" type="submit" style={{ width: "auto", padding: "7px 16px" }}>
                Add
              </button>
            </form>
          </div>

          {settings?.updated_at && (
            <p style={{ fontSize: 11, color: "#6B7480", marginTop: -6, marginBottom: 14 }}>
              Last changed {new Date(settings.updated_at).toLocaleString()}
              {settings.updated_by ? ` by ${settings.updated_by.full_name || settings.updated_by.email}` : ""}.
            </p>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="auth-btn" style={{ width: "auto", padding: "8px 18px" }} onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
            {saved && <span style={{ fontSize: 12, color: "#4C7A3A", fontWeight: 600 }}>Saved.</span>}
          </div>
        </>
      )}

      <h2 style={{ fontSize: 14, color: "#1F3B5C", marginTop: 28, marginBottom: 4 }}>Company Information</h2>
      <p style={{ fontSize: 11.5, color: "#6B7480", marginTop: 0, marginBottom: 18 }}>
        HMZC's own PEPPOL (Pan-European Public Procurement OnLine) participant ID — printed on every
        invoice and quotation so a customer's own accounts system can look HMZC up on the network.
        Display only: this doesn't transmit e-invoices through PEPPOL itself.
      </p>

      {companyLoading && <p>Loading...</p>}
      {companyErr && <div className="auth-error">{companyErr}</div>}

      {!companyLoading && (
        <div style={{ background: "#F4F6F7", border: "1px solid #DCE1E5", borderRadius: 8, padding: 16, marginBottom: 14 }}>
          <label htmlFor="peppol-id" style={{ display: "block", fontSize: 11, color: "#6B7480", marginBottom: 6, fontWeight: 600 }}>
            PEPPOL ID
          </label>
          <input
            id="peppol-id"
            value={peppolId}
            onChange={(e) => setPeppolId(e.target.value)}
            placeholder="e.g. 0192:987654321"
            style={{ width: "100%", padding: "7px 9px", border: "1px solid #C9D1D8", borderRadius: 5, fontSize: 13, marginBottom: 12 }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="auth-btn" style={{ width: "auto", padding: "8px 18px" }} onClick={saveCompanyInfo} disabled={companySaving}>
              {companySaving ? "Saving..." : "Save Changes"}
            </button>
            {companySaved && <span style={{ fontSize: 12, color: "#4C7A3A", fontWeight: 600 }}>Saved.</span>}
          </div>
        </div>
      )}
    </div>
  );
}
