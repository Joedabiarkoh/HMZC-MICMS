import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../auth.css";
import { useAuth } from "../../../context/AuthContext";
import { HMZC_LOGO_DATA_URI } from "../../inspections/assets/logo";

export default function SignIn() {
  const { login, error } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Set by api/axios.ts's 401 interceptor before it force-navigates
  // here — without this, a session timing out mid-task just dumps
  // someone on a blank sign-in form with no explanation of why they're
  // suddenly here, which reads as the app having lost their work for
  // no reason rather than a normal, expected security behavior.
  useEffect(() => {
    if (sessionStorage.getItem("hmzc_session_expired")) {
      setSessionExpired(true);
      sessionStorage.removeItem("hmzc_session_expired");
    }
  }, []);

  async function handleSubmit(e: any) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/inspections");
    } catch {
      // error already captured in context
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <img src={HMZC_LOGO_DATA_URI} alt="HMZC LTD" />
        <div className="auth-title">HMZC Certification Platform</div>
        <div className="auth-subtitle">Sign in to continue</div>
        {sessionExpired && (
          <div className="auth-error" style={{ background: "#FBF0E2", border: "1px solid #B4690E", color: "#7A4A08" }}>
            Your session expired. Anything you'd saved is still there — sign in again to continue.
          </div>
        )}
        {error && <div className="auth-error">{error}</div>}
        <div className="auth-field">
          <label>Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@hmzcshipping.com" />
        </div>
        <div className="auth-field">
          <label>Password</label>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="auth-btn" type="submit" disabled={submitting}>{submitting ? "Signing in..." : "Sign In"}</button>
        <div className="auth-switch">
          Don't have an account? Ask your administrator to create one for you.
          <br />
          <Link to="/signup" style={{ fontSize: 10 }}>Setting this up for the first time?</Link>
        </div>
      </form>
    </div>
  );
}
