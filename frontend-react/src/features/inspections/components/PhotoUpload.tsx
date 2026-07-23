import { useState } from "react";
import { compressImages } from "../utils/compressImage";

interface Props {
  photos: string[];
  onAdd: (dataUris: string[]) => void;
  onRemove: (index: number) => void;
  minRequired?: number;
}

/**
 * Photo evidence uploader — same behaviour as the previous standalone
 * tool: attach photos of the equipment/nameplate/defects, stored as
 * base64 data URIs on the certificate (see InspectionCertificate.photos).
 * `capture="environment"` opens the camera directly on phones/tablets.
 * Each photo is resized/re-encoded via compressImage.ts before being
 * added — see that file for why.
 *
 * `minRequired`, if set, is enforced (not just displayed) — see
 * missingPhotoRequirements() in InspectionWorkspace.tsx, which blocks
 * Finalize until every section's minimum is met.
 */
export default function PhotoUpload({ photos, onAdd, onRemove, minRequired = 0 }: Props) {
  const [compressing, setCompressing] = useState(false);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setCompressing(true);
    compressImages(files)
      .then((dataUris) => onAdd(dataUris.filter(Boolean)))
      .finally(() => setCompressing(false));
  }

  const met = photos.length >= minRequired;

  return (
    <fieldset className="insp-fieldset">
      <legend className="insp-legend">
        Photo Evidence {minRequired > 0 && (
          <span style={{ color: met ? "var(--insp-green)" : "var(--insp-red)", textTransform: "none", fontWeight: 700 }}>
            ({photos.length}/{minRequired} required{met ? " ✓" : ""})
          </span>
        )}
      </legend>
      <div style={{ marginBottom: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
        {photos.length === 0 && <span style={{ fontSize: 11, color: "var(--insp-muted)" }}>No photos attached yet.</span>}
        {photos.map((p, i) => (
          <div key={i} style={{ position: "relative" }}>
            <img src={p} alt={`Evidence ${i + 1}`} style={{ width: 70, height: 70, objectFit: "cover", borderRadius: 5, border: "1px solid #C9D1D8" }} />
            <button
              type="button"
              onClick={() => onRemove(i)}
              style={{ position: "absolute", top: -6, right: -6, background: "var(--insp-red)", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 11, cursor: "pointer", lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <input type="file" accept="image/*" capture="environment" multiple onChange={(e) => handleFiles(e.target.files)} disabled={compressing} />
      {compressing && <p className="insp-help-note" style={{ color: "var(--insp-amber)" }}>Compressing photo(s)...</p>}
      <p className="insp-help-note">Attach photos of the equipment, nameplate, and any defects found. On a phone/tablet this opens the camera directly.</p>
    </fieldset>
  );
}
