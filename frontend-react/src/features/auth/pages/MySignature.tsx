import { useEffect, useState } from "react";
import "../auth.css";
import { useAuth } from "../../../context/AuthContext";
import { HMZC_LOGO_DATA_URI } from "../../inspections/assets/logo";
import SignatureCanvas from "../../inspections/components/SignatureCanvas";

// A dedicated account-level place to set up a default signature, separate
// from drawing one inline on a certificate — requested directly after the
// inline "Save as my default signature" button (only visible once you've
// already started drawing on a certificate's Technician/Engineer field)
// turned out too easy to miss. This page reuses SignatureCanvas exactly
// as-is: `value` here plays the role a certificate's own signature field
// normally would, so "Save Signature" commits the drawing locally and
// "Save as my default signature" (shown once allowSavedDefault sees the
// drawn value differs from what's already saved) is what actually persists
// it via PUT /auth/me/signature.
export default function MySignature() {
  const { user } = useAuth();
  const [value, setValue] = useState(user?.saved_signature_url || "");

  // Covers the case where this page is opened before AuthContext's user
  // has finished loading (value would otherwise initialize to "" and stay
  // that way) — only fills in from the saved default if the field hasn't
  // been touched yet, so it never clobbers a signature someone is
  // actively (re-)drawing.
  useEffect(() => {
    if (user?.saved_signature_url) setValue((v) => v || user.saved_signature_url!);
  }, [user?.saved_signature_url]);

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 460 }}>
        <img src={HMZC_LOGO_DATA_URI} alt="HMZC LTD" />
        <div className="auth-title">My Signature</div>
        <div className="auth-subtitle">HMZC Certification Platform</div>
        <p style={{ fontSize: 12, lineHeight: 1.6, color: "#425466", marginBottom: 12 }}>
          Draw your signature once and save it here — it will fill in automatically on the
          Technician/Engineer signature field of every new certificate you issue, so you won't
          need to sign one after the other.
        </p>
        <SignatureCanvas label="Your Signature" value={value} onChange={setValue} allowSavedDefault />
      </div>
    </div>
  );
}
