import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../auth.css";
import { useAuth } from "../../../context/AuthContext";
import { HMZC_LOGO_DATA_URI } from "../../inspections/assets/logo";
import { confirmTwoFactor, disableTwoFactor, setupTwoFactor } from "../services/auth.api";

/**
 * Self-service TOTP enrollment/management — reached voluntarily from
 * the Account nav for any role, or forced (see RequireAuth.tsx's
 * requires_2fa_setup redirect) for an Admin/Finance account that
 * hasn't set it up yet. The same page handles both: a forced visit
 * just can't be dismissed until setup actually completes, since
 * there's nowhere else RequireAuth will let them go.
 */
export default function TwoFactorSetup() {
  const { user, updateUser, error: authError } = useAuth();
  const navigate = useNavigate();
  const forced = !!user?.requires_2fa_setup;

  const [secret, setSecret] = useState("");
  const [qrDataUri, setQrDataUri] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [confirmEmailSent, setConfirmEmailSent] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  async function startSetup() {
    setErr("");
    setSubmitting(true);
    try {
      const result = await setupTwoFactor();
      setSecret(result.secret);
      setQrDataUri(result.qr_code_data_uri);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Could not start setup. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirm(e: any) {
    e.preventDefault();
    setErr("");
    setSubmitting(true);
    try {
      const result = await confirmTwoFactor(code);
      updateUser(result.user);
      setRecoveryCodes(result.recovery_codes);
      setConfirmEmailSent(result.email_sent);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "That code didn't match. Check your authenticator app and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDisable(e: any) {
    e.preventDefault();
    setErr("");
    setSubmitting(true);
    try {
      const updated = await disableTwoFactor(disablePassword);
      updateUser(updated);
      setDisablePassword("");
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Could not disable two-factor authentication.");
    } finally {
      setSubmitting(false);
    }
  }

  // The one screen a forced visit can't skip past — recovery codes are
  // shown exactly once, same reasoning as an admin-issued temporary
  // password (see PasswordResetResult's own comment on the backend).
  if (recoveryCodes) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: "left" }}>
          <img src={HMZC_LOGO_DATA_URI} alt="HMZC LTD" style={{ display: "block", margin: "0 auto 10px" }} />
          <div className="auth-title" style={{ textAlign: "center" }}>Save Your Recovery Codes</div>
          <p style={{ fontSize: 12, lineHeight: 1.6, color: "#7A4A08", background: "#FBF0E2", border: "1px solid #B4690E", borderRadius: 6, padding: "8px 10px", marginBottom: 12 }}>
            Two-factor authentication is now enabled. Each code below works once, if you ever
            lose access to your authenticator app — write them down or save them somewhere
            safe now. They won't be shown again.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontFamily: "monospace", fontSize: 13, fontWeight: 700, background: "#F4F6F7", border: "1px solid #DCE1E5", borderRadius: 6, padding: 12, marginBottom: 14 }}>
            {recoveryCodes.map((c) => <div key={c}>{c}</div>)}
          </div>
          <p style={{ fontSize: 11.5, color: confirmEmailSent ? "#4C7A3A" : "#6B7480", fontWeight: 600, margin: "0 0 14px" }}>
            {confirmEmailSent
              ? "A confirmation was also emailed to you, in case this wasn't you."
              : "(A confirmation email couldn't be sent — SMTP isn't configured on the server.)"}
          </p>
          <button className="auth-btn" onClick={() => navigate("/inspections")}>
            I've saved these — Continue
          </button>
        </div>
      </div>
    );
  }

  if (user?.two_factor_enabled) {
    return (
      <div className="auth-page">
        <form className="auth-card" onSubmit={handleDisable}>
          <img src={HMZC_LOGO_DATA_URI} alt="HMZC LTD" />
          <div className="auth-title">Two-Factor Authentication</div>
          <p style={{ fontSize: 12, color: "#4C7A3A", fontWeight: 600, marginBottom: 12 }}>Enabled on this account.</p>
          {(err || authError) && <div className="auth-error">{err || authError}</div>}
          <div className="auth-field">
            <label htmlFor="tfa-disable-password">Current Password</label>
            <input id="tfa-disable-password" type="password" required value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} />
          </div>
          <button className="auth-btn" type="submit" disabled={submitting} style={{ background: "#fff", color: "#B3382C", border: "1px solid #B3382C" }}>
            {submitting ? "Disabling..." : "Disable Two-Factor Authentication"}
          </button>
        </form>
      </div>
    );
  }

  if (!secret) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <img src={HMZC_LOGO_DATA_URI} alt="HMZC LTD" style={{ display: "block", margin: "0 auto 10px" }} />
          <div className="auth-title">Two-Factor Authentication</div>
          {forced && (
            <p style={{ fontSize: 12, lineHeight: 1.6, color: "#7A4A08", background: "#FBF0E2", border: "1px solid #B4690E", borderRadius: 6, padding: "8px 10px", marginBottom: 12 }}>
              Your role requires two-factor authentication to be set up before you can continue.
            </p>
          )}
          {!forced && (
            <p style={{ fontSize: 12, color: "#6B7480", marginBottom: 12 }}>
              Add a second step to sign-in using an authenticator app (Google Authenticator, Authy, 1Password, etc.).
            </p>
          )}
          {(err || authError) && <div className="auth-error">{err || authError}</div>}
          <button className="auth-btn" onClick={startSetup} disabled={submitting}>
            {submitting ? "Starting..." : "Set Up Two-Factor Authentication"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleConfirm}>
        <img src={HMZC_LOGO_DATA_URI} alt="HMZC LTD" style={{ display: "block", margin: "0 auto 10px" }} />
        <div className="auth-title">Scan This Code</div>
        <p style={{ fontSize: 12, color: "#6B7480", marginBottom: 12 }}>
          Scan with your authenticator app, then enter the 6-digit code it shows below.
        </p>
        <img src={qrDataUri} alt="Two-factor setup QR code" style={{ display: "block", margin: "0 auto 12px", width: 200, height: 200 }} />
        <p style={{ fontSize: 10.5, color: "#6B7480", marginBottom: 12, wordBreak: "break-all" }}>
          Can't scan it? Enter this code manually: <strong style={{ fontFamily: "monospace" }}>{secret}</strong>
        </p>
        {(err || authError) && <div className="auth-error">{err || authError}</div>}
        <div className="auth-field">
          <label htmlFor="tfa-confirm-code">Authentication Code</label>
          <input id="tfa-confirm-code" inputMode="numeric" autoFocus required value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
        </div>
        <button className="auth-btn" type="submit" disabled={submitting}>{submitting ? "Verifying..." : "Confirm & Enable"}</button>
      </form>
    </div>
  );
}
