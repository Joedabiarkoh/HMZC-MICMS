// Requested directly, reviewing a real CRALOG-issued certificate for
// comparison: their statements close with one unambiguous declaration —
// "The equipment remains FIT FOR PURPOSE: Yes / No" — separate from any
// individual checklist item's own result, right next to the signature.
// Shared across every certificate kind that uses this declaration (see
// InspectionCertificate.fitForPurpose's own comment for which kinds and
// why) rather than four separate copies. Same checkbox-pair visual
// pattern as LooseGearForm.tsx's YesNoField — a literal YES [x] NO [ ]
// pair reads as an actual statutory form field, not a generic app
// control, and clicking the already-selected box clears it back to
// unanswered, matching that established pattern.
export default function FitForPurposeField({ value, onChange }: { value: "" | "yes" | "no"; onChange: (v: "" | "yes" | "no") => void }) {
  return (
    <div className="insp-field">
      <span id="fit-for-purpose-label" style={{ display: "block", fontSize: 11, color: "var(--insp-muted)", marginBottom: 3, fontWeight: 600 }}>
        The equipment remains FIT FOR PURPOSE
      </span>
      <div className="insp-yesno-toggle" role="group" aria-labelledby="fit-for-purpose-label">
        <button
          type="button"
          className={value === "yes" ? "selected" : ""}
          aria-pressed={value === "yes"}
          onClick={() => onChange(value === "yes" ? "" : "yes")}
        >
          <span aria-hidden="true">{value === "yes" ? "☒" : "☐"}</span> YES
        </button>
        <button
          type="button"
          className={value === "no" ? "selected" : ""}
          aria-pressed={value === "no"}
          onClick={() => onChange(value === "no" ? "" : "no")}
        >
          <span aria-hidden="true">{value === "no" ? "☒" : "☐"}</span> NO
        </button>
      </div>
    </div>
  );
}
