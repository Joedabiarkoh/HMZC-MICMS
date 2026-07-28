import { ChecklistStatus } from "../types/inspection.types";

interface Props {
  value: ChecklistStatus;
  onChange: (v: ChecklistStatus) => void;
}

const OPTIONS: { v: ChecklistStatus; label: string; full: string; cls: string }[] = [
  { v: "good", label: "G", full: "Good", cls: "sel-good" },
  { v: "part", label: "PE", full: "Part-Ex", cls: "sel-part" },
  { v: "repair", label: "R", full: "Repair", cls: "sel-repair" },
  { v: "na", label: "NA", full: "N/A", cls: "sel-na" },
];

export default function StatusToggle({ value, onChange }: Props) {
  return (
    <div className="insp-chk-toggle" role="group" aria-label="Checklist item status">
      {OPTIONS.map((opt) => (
        <button
          key={opt.v}
          type="button"
          className={value === opt.v ? opt.cls : ""}
          aria-pressed={value === opt.v}
          aria-label={opt.full}
          onClick={() => onChange(opt.v)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
