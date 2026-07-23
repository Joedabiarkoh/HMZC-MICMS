import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../auth.css";
import { useAuth } from "../../../context/AuthContext";
import { HMZC_LOGO_DATA_URI } from "../../inspections/assets/logo";

export default function ChangePassword() {
  const { user, changePassword, error } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");

  const forced = !!user?.must_change_password;

  async function handleSubmit(e: any) {
    e.preventDefault();
    setLocalError("");
    if (newPassword !== confirmPassword) {
      setLocalError("New password and confirmation don't match.");
      return;
    }
    if (newPassword.length < 8) {
      setLocalError("New password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    try {
      await changePassword({ current_password: currentPassword, new_password: newPassword });
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
        <div className="auth-title">{forced ? "Set a New Password" : "Change Password"}</div>
        <div className="auth-subtitle">HMZC Certification Platform</div>
        {forced && (
          <p style={{ fontSize: 12, lineHeight: 1.6, color: "#7A4A08", background: "#FBF0E2", border: "1px solid #B4690E", borderRadius: 6, padding: "8px 10px", marginBottom: 12 }}>
            An administrator reset your password. Enter the temporary password they gave you
            below, then choose a new one only you know.
          </p>
        )}
        {(error || localError) && <div className="auth-error">{localError || error}</div>}
        <div className="auth-field">
          <label>{forced ? "Temporary Password" : "Current Password"}</label>
          <input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </div>
        <div className="auth-field">
          <label>New Password</label>
          <input type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>
        <div className="auth-field">
          <label>Confirm New Password</label>
          <input type="password" required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </div>
        <button className="auth-btn" type="submit" disabled={submitting}>{submitting ? "Saving..." : "Set Password"}</button>
      </form>
    </div>
  );
}
