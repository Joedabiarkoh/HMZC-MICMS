import { useState } from "react";
import { compressImages } from "../utils/compressImage";
import { PhotoEvidence } from "../types/inspection.types";

interface Props {
  photos: PhotoEvidence[];
  onAdd: (photos: PhotoEvidence[]) => void;
  onRemove: (index: number) => void;
  onCaptionChange: (index: number, caption: string) => void;
  minRequired?: number;
  // Requested directly, for Loose Gear specifically: "just one photo."
  // Unset (the default) everywhere else — boat/crane sections and the
  // FFE/Calibration Photo Report still take as many as needed.
  maxPhotos?: number;
}

/**
 * Photo evidence uploader — same behaviour as the previous standalone
 * tool: attach photos of the equipment/nameplate/defects, stored as
 * base64 data URIs on the certificate (see InspectionCertificate.photos).
 * Each photo is resized/re-encoded via compressImage.ts before being
 * added — see that file for why.
 *
 * Requested directly: "the picture section only allow live images,
 * allow it to access photo upload photos already taken." The input
 * used to carry capture="environment", which on mobile browsers skips
 * the normal file picker entirely and jumps straight into the camera
 * — there was never a way to pick an existing photo from the gallery.
 * Removed; a plain accept="image/*" input still offers "Take Photo" on
 * phones/tablets (that's not lost), it just also offers "Choose from
 * Library" alongside it, same as any other file picker.
 *
 * Requested directly: "the uploaded photos should be used as photo
 * report attached to the final page... and should have description."
 * Each photo now carries its own caption (see PhotoEvidence) — entered
 * right under its thumbnail here, printed alongside the photo on the
 * certificate's consolidated Photo Report page (CertificatePreview.tsx).
 *
 * `minRequired`, if set, is enforced (not just displayed) — see
 * missingPhotoRequirements() in InspectionWorkspace.tsx, which blocks
 * Finalize until every section's minimum is met.
 */
export default function PhotoUpload({ photos, onAdd, onRemove, onCaptionChange, minRequired = 0, maxPhotos }: Props) {
  const [compressing, setCompressing] = useState(false);
  const atMax = maxPhotos !== undefined && photos.length >= maxPhotos;

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remaining = maxPhotos !== undefined ? Math.max(0, maxPhotos - photos.length) : files.length;
    if (remaining === 0) return;
    setCompressing(true);
    compressImages(Array.from(files).slice(0, remaining))
      .then((dataUris) => onAdd(dataUris.filter(Boolean).map((data) => ({ data, caption: "" }))))
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
      <div style={{ marginBottom: 8, display: "flex", flexWrap: "wrap", gap: 10 }}>
        {photos.length === 0 && <span style={{ fontSize: 11, color: "var(--insp-muted)" }}>No photos attached yet.</span>}
        {photos.map((p, i) => (
          <div key={i} style={{ position: "relative", width: 90 }}>
            <img src={p.data} alt={p.caption || `Evidence ${i + 1}`} style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 5, border: "1px solid #C9D1D8", display: "block" }} />
            <button
              type="button"
              onClick={() => onRemove(i)}
              style={{ position: "absolute", top: -6, right: -6, background: "var(--insp-red)", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 11, cursor: "pointer", lineHeight: 1 }}
            >
              ×
            </button>
            <input
              type="text"
              value={p.caption}
              onChange={(e) => onCaptionChange(i, e.target.value)}
              placeholder="Description"
              style={{ width: "100%", marginTop: 4, padding: "3px 5px", fontSize: 10.5, border: "1px solid #C9D1D8", borderRadius: 4 }}
            />
          </div>
        ))}
      </div>
      {atMax ? (
        <p className="insp-help-note">Maximum {maxPhotos} photo{maxPhotos === 1 ? "" : "s"} reached — remove {maxPhotos === 1 ? "it" : "one"} to add another.</p>
      ) : (
        <>
          <input type="file" accept="image/*" multiple={maxPhotos === undefined || maxPhotos > 1} onChange={(e) => handleFiles(e.target.files)} disabled={compressing} />
          {compressing && <p className="insp-help-note" style={{ color: "var(--insp-amber)" }}>Compressing photo(s)...</p>}
          <p className="insp-help-note">Attach photos of the equipment, nameplate, and any defects found — take a new photo or choose one already on your device, then describe what it shows.</p>
        </>
      )}
    </fieldset>
  );
}
