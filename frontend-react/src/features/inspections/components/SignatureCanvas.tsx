import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { deleteMySignature, saveMySignature } from "../../auth/services/auth.api";

interface Props {
  label: string;
  value: string; // data URI, or "" if not yet signed
  onChange: (dataUri: string) => void;
  // Only the signer's own field should offer "save as my default" /
  // "use my saved signature" — a witness or client signature box has no
  // business reusing the logged-in technician's personal signature.
  allowSavedDefault?: boolean;
}

/**
 * Draw-to-sign field, same behaviour as the signature pad in the previous
 * standalone tool: draw with mouse or touch, "Save" commits it as a PNG
 * data URI (what CertificatePreview's SignBox renders), "Clear" wipes the
 * pad. Always visible inline rather than in a modal, since React makes
 * per-field state easy to keep local.
 *
 * Requested directly: "let allow for each account user be able to load
 * their signature and use it on all certificate they will issue so they
 * will not need to sign one after the other." useInspections.ts already
 * auto-fills a fresh certificate's signature field from the logged-in
 * user's saved default (see freshCertificate() there) — the controls
 * here are for the two things that still need a person in the loop:
 * saving a newly-drawn signature as that default, and pulling it back in
 * manually if it was cleared/re-signed on this one certificate.
 */
export default function SignatureCanvas({ label, value, onChange, allowSavedDefault }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [savingDefault, setSavingDefault] = useState(false);
  const { user, updateUser } = useAuth();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1F3B5C";

    function pos(e: MouseEvent | TouchEvent) {
      const rect = canvas!.getBoundingClientRect();
      const scaleX = canvas!.width / rect.width;
      const scaleY = canvas!.height / rect.height;
      const point = "touches" in e ? e.touches[0] : (e as MouseEvent);
      return { x: (point.clientX - rect.left) * scaleX, y: (point.clientY - rect.top) * scaleY };
    }
    function start(e: MouseEvent | TouchEvent) {
      drawing.current = true;
      const p = pos(e);
      ctx!.beginPath();
      ctx!.moveTo(p.x, p.y);
      e.preventDefault();
    }
    function move(e: MouseEvent | TouchEvent) {
      if (!drawing.current) return;
      const p = pos(e);
      ctx!.lineTo(p.x, p.y);
      ctx!.stroke();
      setHasDrawn(true);
      e.preventDefault();
    }
    function end() {
      drawing.current = false;
    }

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", end);
    return () => {
      canvas.removeEventListener("mousedown", start);
      canvas.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", end);
      canvas.removeEventListener("touchstart", start);
      canvas.removeEventListener("touchmove", move);
      canvas.removeEventListener("touchend", end);
    };
  }, []);

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onChange("");
  }

  function save() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(canvas.toDataURL("image/png"));
  }

  async function saveAsDefault() {
    if (!value) return;
    setSavingDefault(true);
    try {
      const updated = await saveMySignature(value);
      updateUser(updated);
    } finally {
      setSavingDefault(false);
    }
  }

  async function removeDefault() {
    setSavingDefault(true);
    try {
      const updated = await deleteMySignature();
      updateUser(updated);
    } finally {
      setSavingDefault(false);
    }
  }

  const hasSavedDefault = !!user?.saved_signature_url;
  const isUsingSavedDefault = hasSavedDefault && value === user!.saved_signature_url;

  return (
    <div className="insp-field">
      <label>{label}</label>
      {value ? (
        <div>
          <img src={value} alt={label} style={{ height: 44, border: "1px solid #C9D1D8", borderRadius: 5, background: "#fff", padding: 2 }} />
          <div className="insp-btn-row" style={{ padding: 0, marginTop: 4 }}>
            <button type="button" className="insp-btn insp-btn-outline" onClick={() => onChange("")}>Re-sign</button>
            {allowSavedDefault && !isUsingSavedDefault && (
              <button type="button" className="insp-btn insp-btn-outline" onClick={saveAsDefault} disabled={savingDefault}>
                {savingDefault ? "Saving…" : "Save as my default signature"}
              </button>
            )}
            {allowSavedDefault && hasSavedDefault && (
              <button type="button" className="insp-btn insp-btn-outline" onClick={removeDefault} disabled={savingDefault}>
                Forget my default signature
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <canvas
            ref={canvasRef}
            width={360}
            height={110}
            style={{ border: "1px solid #C9D1D8", borderRadius: 6, width: "100%", background: "#FAFBFC", touchAction: "none" }}
          />
          <div className="insp-btn-row" style={{ padding: 0, marginTop: 4 }}>
            <button type="button" className="insp-btn insp-btn-primary" onClick={save} disabled={!hasDrawn}>Save Signature</button>
            <button type="button" className="insp-btn insp-btn-outline" onClick={clear}>Clear</button>
            {allowSavedDefault && hasSavedDefault && (
              <button type="button" className="insp-btn insp-btn-outline" onClick={() => onChange(user!.saved_signature_url!)}>
                Use my saved signature
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
