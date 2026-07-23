import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../auth.css";
import { useAuth } from "../../../context/AuthContext";
import { HMZC_LOGO_DATA_URI } from "../../inspections/assets/logo";

/**
 * Requested directly: "I want only the admin to create the account."
 * Self-service sign-up is now blocked server-side for everyone except
 * the very first account ever created on a fresh install (see
 * register_user's is_first_user check) — there's no admin yet to create
 * one otherwise, so that one case still has to bootstrap itself. Every
 * account after that comes from the "Create User" action on the Users
 * page (AdminUsers.tsx), not this form — which is why the role selector
 * that used to be here is gone: the bootstrap account is always forced
 * to Administrator regardless of what's picked, so offering a choice
 * was misleading.
 */
export default function SignUp() {
  const { register, error } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selfServiceDisabled, setSelfServiceDisabled] = useState(false);

  async function handleSubmit(e: any) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const created = await register({ email, password, full_name: fullName });
      if (created.is_active) {
        navigate("/inspections");
      }
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setSelfServiceDisabled(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (selfServiceDisabled) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <img src={HMZC_LOGO_DATA_URI} alt="HMZC LTD" />
          <div className="auth-title">Accounts Are Admin-Created</div>
          <div className="auth-subtitle">HMZC Certification Platform</div>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: "#243040" }}>
            This platform is already set up — new accounts are created by an administrator,
            not through self-service sign-up. Ask your administrator to create an account for
            you; you'll receive an email with a temporary password to sign in with.
          </p>
          <Link to="/signin" className="auth-btn" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <img src={HMZC_LOGO_DATA_URI} alt="HMZC LTD" />
        <div className="auth-title">First-Time Setup</div>
        <div className="auth-subtitle">HMZC Certification Platform</div>
        <p style={{ fontSize: 11.5, color: "#6B7480", marginTop: -6, marginBottom: 12 }}>
          This only works once, on a brand-new install with no accounts yet — it creates the
          founding administrator. If this platform is already in use, contact your admin instead.
        </p>
        {error && <div className="auth-error">{error}</div>}
        <div className="auth-field">
          <label>Full Name</label>
          <input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Joseph Dabi-Arkoh" />
        </div>
        <div className="auth-field">
          <label>Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@hmzcshipping.com" />
        </div>
        <div className="auth-field">
          <label>Password</label>
          <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="auth-btn" type="submit" disabled={submitting}>{submitting ? "Creating account..." : "Create Founding Admin Account"}</button>
        <div className="auth-switch">
          Already have an account? <Link to="/signin">Sign in</Link>
        </div>
      </form>
    </div>
  );
}
