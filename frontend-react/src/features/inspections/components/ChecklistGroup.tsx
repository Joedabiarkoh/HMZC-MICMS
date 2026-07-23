import { ChecklistSection } from "../types/inspection.types";
import StatusToggle from "./StatusToggle";

interface Props {
  section: ChecklistSection;
  disabled?: boolean;
  disabledReason?: string;
  onItemChange: (index: number, field: "status" | "remark", value: string) => void;
  onSpecialChange: (index: number, field: "status" | "remark", value: string) => void;
}

export default function ChecklistGroup({ section, disabled, disabledReason, onItemChange, onSpecialChange }: Props) {
  if (disabled) {
    return (
      <div className="insp-chk-group">
        <div className="insp-chk-group-title">
          {section.code}. {section.name} — <span style={{ fontWeight: 400, color: "var(--insp-muted)" }}>{disabledReason || "not fitted"}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="insp-chk-group">
      <div className="insp-chk-group-title">{section.code}. {section.name}</div>
      {section.items.map((item, i) => (
        <div className="insp-chk-row" key={`${section.code}-item-${i}`}>
          <div className="insp-chk-name">{item.label}</div>
          <StatusToggle value={item.status} onChange={(v) => onItemChange(i, "status", v)} />
          <input
            className="insp-chk-remark"
            placeholder="Remarks"
            value={item.remark}
            onChange={(e) => onItemChange(i, "remark", e.target.value)}
          />
        </div>
      ))}
      {section.special.map((item, i) => (
        <div className="insp-chk-row" key={`${section.code}-special-${i}`}>
          <div className="insp-chk-name">
            {item.label} <span style={{ color: "var(--insp-muted)", fontWeight: 400 }}>({item.presetRemark})</span>
          </div>
          <StatusToggle value={item.status} onChange={(v) => onSpecialChange(i, "status", v)} />
          <input
            className="insp-chk-remark"
            placeholder="Remarks"
            value={item.remark}
            onChange={(e) => onSpecialChange(i, "remark", e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}
