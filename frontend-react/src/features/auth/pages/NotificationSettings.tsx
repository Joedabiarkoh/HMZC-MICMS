import { useEffect, useState } from "react";
import "../auth.css";
import { getCompanyInfo, getExpiryReminderSettings, updateCompanyInfo, updateExpiryReminderSettings } from "../services/auth.api";
import { ExpiryReminderSettings } from "../types/auth.types";

const BLANK_COMPANY_FORM = {
  peppol_id: "",
  bank_name: "",
  bank_address: "",
  bank_town: "",
  bank_postcode: "",
  bank_country: "",
  bank_beneficiary: "",
  bank_account_number: "",
  bank_sort_code: "",
  bank_swift_code: "",
  bank_iban: "",
  terms_conditions: "",
  company_legal_name: "",
  company_nif: "",
  company_phones: "",
  po_terms_conditions: "",
  kwanza_bank_details: "",
};

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
 * Grew a second section (Company Information) once HMZC's PEPPOL ID and
 * supplier bank account details needed an admin-editable home too —
 * kept on this same admin-only page rather than a new one, since all
 * three are "settings only an admin changes, rarely." The page
 * title/nav label changed from "Notification Settings" to "Settings"
 * to reflect that it's no longer notification-only.
 */
export default function NotificationSettings() {
  const [settings, setSettings] = useState<ExpiryReminderSettings | null>(null);
  const [emails, setEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);

  const [companyForm, setCompanyForm] = useState(BLANK_COMPANY_FORM);
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
        setCompanyForm({
          peppol_id: data.peppol_id || "",
          bank_name: data.bank_name || "",
          bank_address: data.bank_address || "",
          bank_town: data.bank_town || "",
          bank_postcode: data.bank_postcode || "",
          bank_country: data.bank_country || "",
          bank_beneficiary: data.bank_beneficiary || "",
          bank_account_number: data.bank_account_number || "",
          bank_sort_code: data.bank_sort_code || "",
          bank_swift_code: data.bank_swift_code || "",
          bank_iban: data.bank_iban || "",
          terms_conditions: data.terms_conditions || "",
          company_legal_name: data.company_legal_name || "",
          company_nif: data.company_nif || "",
          company_phones: data.company_phones || "",
          po_terms_conditions: data.po_terms_conditions || "",
          kwanza_bank_details: data.kwanza_bank_details || "",
        });
      })
      .catch((e) => setCompanyErr(e?.response?.data?.detail || "Could not load company information."))
      .finally(() => setCompanyLoading(false));
  }
  useEffect(loadCompanyInfo, []);

  function updateCompanyField(key: keyof typeof BLANK_COMPANY_FORM, value: string) {
    setCompanyForm((prev) => ({ ...prev, [key]: value }));
    setCompanySaved(false);
  }

  async function saveCompanyInfo() {
    setCompanySaving(true);
    setCompanyErr("");
    setCompanySaved(false);
    try {
      const updated = await updateCompanyInfo(companyForm);
      setCompanyForm({
        peppol_id: updated.peppol_id || "",
        bank_name: updated.bank_name || "",
        bank_address: updated.bank_address || "",
        bank_town: updated.bank_town || "",
        bank_postcode: updated.bank_postcode || "",
        bank_country: updated.bank_country || "",
        bank_beneficiary: updated.bank_beneficiary || "",
        bank_account_number: updated.bank_account_number || "",
        bank_sort_code: updated.bank_sort_code || "",
        bank_swift_code: updated.bank_swift_code || "",
        bank_iban: updated.bank_iban || "",
        terms_conditions: updated.terms_conditions || "",
        company_legal_name: updated.company_legal_name || "",
        company_nif: updated.company_nif || "",
        company_phones: updated.company_phones || "",
        po_terms_conditions: updated.po_terms_conditions || "",
        kwanza_bank_details: updated.kwanza_bank_details || "",
      });
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

  function bankField(key: keyof typeof BLANK_COMPANY_FORM, label: string, placeholder?: string) {
    const id = `company-${key}`;
    return (
      <div className="auth-field" key={key}>
        <label htmlFor={id}>{label}</label>
        <input id={id} value={companyForm[key]} onChange={(e) => updateCompanyField(key, e.target.value)} placeholder={placeholder} />
      </div>
    );
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
        HMZC's own PEPPOL ID and supplier bank account details — printed on invoices (bank details) and
        invoices/quotations (PEPPOL ID) so customers know where to pay and can look HMZC up on the
        PEPPOL network. Display only: no PEPPOL e-invoice transmission or payment processing happens here.
      </p>

      {companyLoading && <p>Loading...</p>}
      {companyErr && <div className="auth-error">{companyErr}</div>}

      {!companyLoading && (
        <div style={{ background: "#F4F6F7", border: "1px solid #DCE1E5", borderRadius: 8, padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1F3B5C", marginBottom: 8 }}>
            Company Identity (letterhead on invoices, quotations and purchase orders)
          </div>
          {bankField("company_legal_name", "Registered Company Name", "e.g. HMZC LDA — Prestação de Serviços Lda")}
          <div className="finance-row2">
            {bankField("company_nif", "NIF (Tax Number)", "e.g. 5001114387")}
            {bankField("company_phones", "Phone Number(s)", "e.g. +244 972 320 300 / 944 442 255")}
          </div>

          <div style={{ marginTop: 16 }}>
          {bankField("peppol_id", "PEPPOL ID", "e.g. 0192:987654321")}
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: "#1F3B5C", marginTop: 16, marginBottom: 8 }}>
            Supplier Bank Account Details
          </div>
          <div className="finance-row2">
            {bankField("bank_name", "Bank Name", "e.g. FNB (First Rand Bank Limited)")}
            {bankField("bank_beneficiary", "Beneficiary", "e.g. HMZC SERVICE PROVIDER (PTY) LTD")}
          </div>
          {bankField("bank_address", "Bank Address")}
          <div className="finance-row2">
            {bankField("bank_town", "Town")}
            {bankField("bank_account_number", "Account Number")}
          </div>
          <div className="finance-row2">
            {bankField("bank_postcode", "Postcode")}
            {bankField("bank_sort_code", "Sort Number")}
          </div>
          <div className="finance-row2">
            {bankField("bank_country", "Country")}
            {bankField("bank_swift_code", "Swift Number")}
          </div>
          {bankField("bank_iban", "IBAN Code")}

          <div style={{ fontSize: 12, fontWeight: 700, color: "#1F3B5C", marginTop: 16, marginBottom: 8 }}>
            Invoice Terms &amp; Conditions
          </div>
          <p style={{ fontSize: 11, color: "#6B7480", marginTop: 0, marginBottom: 6 }}>
            Printed at the end of every invoice. One clause per line, as "Label: clause text" — the label
            before the first colon is bolded on print, so keep new clauses in that same shape.
          </p>
          <div className="auth-field">
            <textarea
              id="company-terms_conditions"
              value={companyForm.terms_conditions}
              onChange={(e) => updateCompanyField("terms_conditions", e.target.value)}
              rows={10}
              style={{ width: "100%", fontFamily: "inherit", fontSize: 12.5, padding: "7px 9px", border: "1px solid #C9D1D8", borderRadius: 5 }}
            />
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: "#1F3B5C", marginTop: 16, marginBottom: 8 }}>
            Kwanza (AOA) Bank Details
          </div>
          <p style={{ fontSize: 11, color: "#6B7480", marginTop: 0, marginBottom: 6 }}>
            Printed on every Kwanza invoice, quotation and purchase order. One line each, "Label: value".
          </p>
          <div className="auth-field">
            <textarea
              id="company-kwanza_bank_details"
              value={companyForm.kwanza_bank_details}
              onChange={(e) => updateCompanyField("kwanza_bank_details", e.target.value)}
              rows={6}
              style={{ width: "100%", fontFamily: "inherit", fontSize: 12.5, padding: "7px 9px", border: "1px solid #C9D1D8", borderRadius: 5 }}
            />
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: "#1F3B5C", marginTop: 16, marginBottom: 8 }}>
            Purchase Order Terms &amp; Conditions
          </div>
          <p style={{ fontSize: 11, color: "#6B7480", marginTop: 0, marginBottom: 6 }}>
            Printed as the last page of every purchase order. Same shape as the invoice terms: one clause per
            line, "Label: clause text".
          </p>
          <div className="auth-field">
            <textarea
              id="company-po_terms_conditions"
              value={companyForm.po_terms_conditions}
              onChange={(e) => updateCompanyField("po_terms_conditions", e.target.value)}
              rows={10}
              style={{ width: "100%", fontFamily: "inherit", fontSize: 12.5, padding: "7px 9px", border: "1px solid #C9D1D8", borderRadius: 5 }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
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
