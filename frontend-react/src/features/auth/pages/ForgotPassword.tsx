import { useState } from "react";
import { Link } from "react-router-dom";
import "../auth.css";
import { HMZC_LOGO_DATA_URI } from "../../inspections/assets/logo";
import { forgotPassword } from "../services/auth.api";

/**
 * Requested directly, from the UX audit: "for a field team that will
 * absolutely forget passwords, [no self-service reset] isn't optional
 * polish, it's a support-ticket generator waiting to happen." Public —
 * reachable from SignIn.tsx without being signed in, since that's the
 * whole point.
 *
 * Always shows the same confirmation regardless of whether the email
 * matched a real account (matching the backend's own generic response —
 * see forgot_password in auth.py) — this page has no way to tell you
 * "no account with that email" without that same message being a tool
 * for guessing who's registered here.
 */
export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: any) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await forgotPassword(email);
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Something went wrong — check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <img src={HMZC_LOGO_DATA_URI} alt="HMZC LTD" />
          <div className="auth-title">Check Your Email</div>
          <div className="auth-subtitle">HMZC Certification Platform</div>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: "#243040" }}>
            If <strong>{email}</strong> is registered here, a temporary password is on its way to that inbox now.
            Sign in with it, then you'll be asked to choose your own password right away.
          </p>
          <p style={{ fontSize: 11.5, color: "#6B7480" }}>
            Nothing arriving after a few minutes? Check spam, or ask your administrator to reset it for you directly.
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
        <div className="auth-title">Reset Your Password</div>
        <div className="auth-subtitle">Enter your account email and we'll send you a temporary password.</div>
        {error && <div className="auth-error">{error}</div>}
        <div className="auth-field">
          <label htmlFor="forgot-email">Email</label>
          <input id="forgot-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@hmzcshipping.com" />
        </div>
        <button className="auth-btn" type="submit" disabled={submitting}>{submitting ? "Sending..." : "Send Reset Email"}</button>
        <div className="auth-switch">
          <Link to="/signin">Back to Sign In</Link>
        </div>
      </form>
    </div>
  );
}
