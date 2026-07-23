import { useEffect, useRef, useState } from "react";

interface Props {
  label: string;
  value: string; // data URI, or "" if not yet signed
  onChange: (dataUri: string) => void;
}

/**
 * Draw-to-sign field, same behaviour as the signature pad in the previous
 * standalone tool: draw with mouse or touch, "Save" commits it as a PNG
 * data URI (what CertificatePreview's SignBox renders), "Clear" wipes the
 * pad. Always visible inline rather than in a modal, since React makes
 * per-field state easy to keep local.
 */
export default function SignatureCanvas({ label, value, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

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

  return (
    <div className="insp-field">
      <label>{label}</label>
      {value ? (
        <div>
          <img src={value} alt={label} style={{ height: 44, border: "1px solid #C9D1D8", borderRadius: 5, background: "#fff", padding: 2 }} />
          <div className="insp-btn-row" style={{ padding: 0, marginTop: 4 }}>
            <button type="button" className="insp-btn insp-btn-outline" onClick={() => onChange("")}>Re-sign</button>
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
          </div>
        </>
      )}
    </div>
  );
}
