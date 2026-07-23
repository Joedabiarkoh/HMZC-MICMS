import { ChecklistStatus } from "../types/inspection.types";

interface Props {
  value: ChecklistStatus;
  onChange: (v: ChecklistStatus) => void;
}

const OPTIONS: { v: ChecklistStatus; label: string; cls: string }[] = [
  { v: "good", label: "G", cls: "sel-good" },
  { v: "part", label: "PE", cls: "sel-part" },
  { v: "repair", label: "R", cls: "sel-repair" },
  { v: "na", label: "NA", cls: "sel-na" },
];

export default function StatusToggle({ value, onChange }: Props) {
  return (
    <div className="insp-chk-toggle">
      {OPTIONS.map((opt) => (
        <button
          key={opt.v}
          type="button"
          className={value === opt.v ? opt.cls : ""}
          onClick={() => onChange(opt.v)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
