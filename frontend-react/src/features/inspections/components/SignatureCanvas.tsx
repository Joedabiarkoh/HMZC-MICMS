import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { deleteMySignature, saveMySignature } from "../../auth/services/auth.api";

// Signatures scan/photograph small — 3MB comfortably covers a real photo
// of a signed page while still catching an accidental full-resolution
// camera shot before it gets written to disk unresized (see
// externalize_signature in the backend, which stores the bytes as-is).
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

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
  // Holds the listener-teardown for whichever <canvas> node is currently
  // attached — needed because the canvas is conditionally rendered (it's
  // swapped out for an <img> once signed, see the JSX below), so a new,
  // blank DOM node is created every time the value goes back to "" (Clear
  // or Re-sign). A one-time useEffect(..., []) here would only ever wire
  // up listeners on the very first canvas node and silently do nothing on
  // every node after that — exactly the "Re-sign draws nothing" bug this
  // callback ref fixes, by re-attaching on every mount instead of once.
  const cleanupRef = useRef<(() => void) | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const drawing = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [savingDefault, setSavingDefault] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const { user, updateUser } = useAuth();

  // Requested directly: "make the signature uploaded resizable by the
  // user." An uploaded photo/scan has whatever size and whitespace it
  // came with — unlike a drawn signature, which is always the same
  // 360x110 canvas at a stroke width already tuned to survive
  // CertificatePreview's downscale (see attachCanvas's own comment) —
  // so a small or oddly-cropped upload can print illegibly small.
  // Rather than threading a separate "scale" field through every place
  // a signature is stored/rendered/exported (InspectionCertificate,
  // LooseGear's own signature fields, docx export, ...), the resize
  // happens once, here, before the image is ever committed: the raw
  // upload is held in pendingUpload and scaled live via the slider,
  // then "Use This Size" bakes it onto a canvas the same size the draw
  // path already produces and hands onChange a plain PNG data URI —
  // everything downstream keeps rendering "just an image" exactly as
  // it does today, no schema or rendering changes needed anywhere else.
  const [pendingUpload, setPendingUpload] = useState<HTMLImageElement | null>(null);
  const [uploadScale, setUploadScale] = useState(1);
  const uploadPreviewRef = useRef<HTMLCanvasElement | null>(null);

  function drawUploadPreview(img: HTMLImageElement, scale: number) {
    const canvas = uploadPreviewRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // "Fit to frame" baseline (like object-fit: contain) at scale 1,
    // so the slider's 50%-200% range means "half/double the natural
    // fit size" regardless of the source image's own resolution.
    const fitScale = Math.min(canvas.width / img.width, canvas.height / img.height);
    const w = img.width * fitScale * scale;
    const h = img.height * fitScale * scale;
    ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
  }

  function confirmUploadSize() {
    const canvas = uploadPreviewRef.current;
    if (!canvas) return;
    try {
      onChange(canvas.toDataURL("image/png"));
    } catch {
      // Tainted-canvas SecurityError — a cross-origin saved-default
      // image the server didn't send CORS headers for. Not fixable
      // from here; surfaced instead of a silent crash.
      setUploadError("Couldn't resize this signature (a cross-origin loading restriction) — try re-signing or re-uploading it instead.");
      return;
    }
    setPendingUpload(null);
    setUploadScale(1);
  }

  function cancelUpload() {
    setPendingUpload(null);
    setUploadScale(1);
    setUploadError("");
    // Root-caused from a debug pass: if the user had drawn something
    // (hasDrawn -> true, but never hit "Save Signature" to commit it)
    // before switching to "Upload Image Instead", canceling the
    // upload drops back to a *fresh, blank* <canvas> (value is still
    // "") while hasDrawn stayed true from the earlier draw — leaving
    // "Save Signature" enabled against an empty canvas, so clicking it
    // committed a blank/transparent PNG that still satisfies the
    // "signature is required" finalize check (a non-empty string).
    // clear()/resign() already reset this; cancelUpload was the one
    // path that didn't.
    setHasDrawn(false);
  }

  useEffect(() => {
    if (pendingUpload) drawUploadPreview(pendingUpload, uploadScale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingUpload, uploadScale]);

  const attachCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    canvasRef.current = canvas;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Requested directly: "the signature also appear too small, make
    // it a bit bolder." This canvas draws at 360x110 (below) but
    // SignBox in CertificatePreview.tsx only ever displays it at
    // 44px tall — roughly a 2.5x downscale — so the previous 2.2px
    // stroke rendered under 1px wide by the time it reached print,
    // barely visible. 3.4px survives that downscale as a genuinely
    // bold stroke instead.
    ctx.lineWidth = 3.4;
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
    cleanupRef.current = () => {
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

  function resign() {
    setHasDrawn(false);
    onChange("");
  }

  // Reopens whatever's already committed (drawn or uploaded) into the
  // same resize step an upload goes through — lets someone come back
  // and adjust the size after the fact, not just at upload time.
  function resizeExisting() {
    if (!value) return;
    setUploadError("");
    const img = new Image();
    // value can be a same-origin data: URI (just drawn/uploaded) or a
    // server URL (a saved default signature — frontend and backend are
    // separate origins in production, see photo_storage.py's own
    // comment on PUBLIC_BASE_URL) — crossOrigin lets the browser draw a
    // same-origin-CORS-enabled server image to canvas without tainting
    // it; confirmUploadSize's own try/catch is the fallback if that
    // isn't set up right rather than a silent crash.
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setUploadScale(1);
      setPendingUpload(img);
    };
    img.onerror = () => setUploadError("Couldn't reopen this signature for resizing — please re-sign or re-upload it.");
    img.src = value;
  }

  function save() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(canvas.toDataURL("image/png"));
  }

  // Requested directly: not everyone has a touch/mouse-drawable screen
  // handy — this is the alternative to drawing, for a signature that
  // already exists as an image (a photo of a signed page, a scanned
  // signature, etc.).
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so choosing the same file again still fires a change event
    if (!file) return;
    setUploadError("");
    if (!file.type.startsWith("image/")) {
      setUploadError("Please choose an image file (PNG, JPG, etc.).");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError("That image is too large — please choose one under 3MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      const img = new Image();
      img.onload = () => {
        setUploadScale(1);
        setPendingUpload(img);
      };
      img.onerror = () => setUploadError("Couldn't read that file — please try again.");
      img.src = reader.result;
    };
    reader.onerror = () => setUploadError("Couldn't read that file — please try again.");
    reader.readAsDataURL(file);
  }

  async function saveAsDefault() {
    if (!value) return;
    setSavingDefault(true);
    try {
      const updated = await saveMySignature(value);
      updateUser(updated);
      // Without this, `value` stays the raw drawing while
      // user.saved_signature_url becomes the server URL it was just
      // uploaded to — isUsingSavedDefault below would never see them as
      // equal, so "Save as my default signature" would keep showing
      // (and re-uploading the same image) even though it's already saved.
      if (updated.saved_signature_url) onChange(updated.saved_signature_url);
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
      {pendingUpload ? (
        <div>
          <canvas
            ref={uploadPreviewRef}
            width={360}
            height={110}
            style={{ border: "1px solid #C9D1D8", borderRadius: 6, width: "100%", background: "#FAFBFC" }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 11, color: "var(--insp-muted)" }}>Size</span>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.05}
              value={uploadScale}
              onChange={(e) => setUploadScale(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 11, color: "var(--insp-muted)", width: 40, textAlign: "right" }}>{Math.round(uploadScale * 100)}%</span>
          </div>
          <div className="insp-btn-row" style={{ padding: 0, marginTop: 4 }}>
            <button type="button" className="insp-btn insp-btn-primary" onClick={confirmUploadSize}>Use This Size</button>
            <button type="button" className="insp-btn insp-btn-outline" onClick={cancelUpload}>Cancel</button>
          </div>
          {uploadError && <p className="insp-help-note" style={{ color: "var(--insp-red)" }}>{uploadError}</p>}
        </div>
      ) : value ? (
        <div>
          <img src={value} alt={label} style={{ height: 44, border: "1px solid #C9D1D8", borderRadius: 5, background: "#fff", padding: 2 }} />
          <div className="insp-btn-row" style={{ padding: 0, marginTop: 4 }}>
            <button type="button" className="insp-btn insp-btn-outline" onClick={resign}>Re-sign</button>
            <button type="button" className="insp-btn insp-btn-outline" onClick={resizeExisting}>Resize</button>
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
          {uploadError && <p className="insp-help-note" style={{ color: "var(--insp-red)" }}>{uploadError}</p>}
        </div>
      ) : (
        <>
          <canvas
            ref={attachCanvas}
            width={360}
            height={110}
            style={{ border: "1px solid #C9D1D8", borderRadius: 6, width: "100%", background: "#FAFBFC", touchAction: "none" }}
          />
          <div className="insp-btn-row" style={{ padding: 0, marginTop: 4 }}>
            <button type="button" className="insp-btn insp-btn-primary" onClick={save} disabled={!hasDrawn}>Save Signature</button>
            <button type="button" className="insp-btn insp-btn-outline" onClick={clear}>Clear</button>
            <button type="button" className="insp-btn insp-btn-outline" onClick={() => fileInputRef.current?.click()}>Upload Image Instead</button>
            {allowSavedDefault && hasSavedDefault && (
              <button type="button" className="insp-btn insp-btn-outline" onClick={() => onChange(user!.saved_signature_url!)}>
                Use my saved signature
              </button>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
          {uploadError && <p className="insp-help-note" style={{ color: "var(--insp-red)" }}>{uploadError}</p>}
        </>
      )}
    </div>
  );
}
