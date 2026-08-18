import type { ReactNode } from "react";
import type { RegisterColumn } from "../data/inspectionHelpers";

// Requested directly: "start with 1" of a 3-item list — fix the
// recurring class of bug that came from building each Loose Gear
// register (Multiple Items' item table, the Defect Report table) three
// separate times: once as an editable form (LooseGearForm.tsx), once
// as a print/preview page (CertificatePreview.tsx), once as a Word
// export (certificateDocxExport.ts). That's exactly how the numbering-
// missing-from-print bug, the white-page crash, and the Result→Status
// rename needing three hand-edits all happened — three implementations
// that could each drift from the other two.
//
// FFE already has a config-driven register (see FFESubTypeConfig's
// itemColumns/items2Columns in ffeCertTypes.ts) — but its own render
// components (ItemTable in FFEForm.tsx, and a second, separately
// hand-written copy in CalibrationForm.tsx) only ever support a plain
// text `<input>` per cell, which isn't enough for Loose Gear: Multiple
// Items needs a Status dropdown and a Safe-to-Use yes/no, Defect Report
// needs an Immediate Danger yes/no with a dependent field. Rather than
// widen FFE's own well-tested, widely-depended-on ItemTable (27+ real
// certificate templates lean on it) to take on that risk for this
// specific need, this is a new, separately-typed component scoped to
// Loose Gear's two registers — proving the same "one config, shared
// renderer" pattern properly for the certificate types that actually
// had the bugs, without touching FFE/Calibration's working code path.
//
// The numbering (#) column is built into both renderers below, not
// something each certificate type has to remember to add — the
// specific bug that motivated this ("numbering should also appear in
// print and preview just as you see when inputting the data") is
// structurally impossible to reintroduce once a register is built on
// top of this, since there's exactly one place "#" is ever rendered
// per surface.

export interface RegisterLegend {
  title: string;
  items: string[];
}

function ynLabel(v: string) {
  return v === "yes" ? "YES" : v === "no" ? "NO" : "—";
}

function fmtRegisterDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ---------------- Edit-mode (form) table ----------------

export function RegisterEditTable({
  columns, rows, onAdd, onRemove, onChange, onDuplicate, addLabel,
}: {
  columns: RegisterColumn[];
  rows: Record<string, string>[];
  onAdd: () => void;
  onRemove: (i: number) => void;
  onChange: (i: number, key: string, value: string) => void;
  onDuplicate?: (i: number) => void;
  addLabel: string;
}) {
  return (
    <>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", minWidth: (columns.length + 1) * 105 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #DCE1E5" }}>
              <th style={{ padding: "4px 6px", width: 30 }}>#</th>
              {columns.map((c) => <th key={c.key} style={{ padding: "4px 6px" }}>{c.label}</th>)}
              <th style={{ width: onDuplicate ? 62 : 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ borderTop: "1px solid #EEF1F3" }}>
                <td style={{ padding: "4px 6px", color: "var(--insp-muted)" }}>{i + 1}</td>
                {columns.map((c) => (
                  <td key={c.key} style={{ padding: "4px 6px" }}>
                    <RegisterEditCell column={c} row={row} onChange={(v) => onChange(i, c.key, v)} />
                  </td>
                ))}
                <td style={{ padding: "4px 6px", display: "flex", gap: 4 }}>
                  {onDuplicate && (
                    <button type="button" className="insp-btn insp-btn-outline" style={{ padding: "2px 8px", fontSize: 11 }} title="Duplicate this row" onClick={() => onDuplicate(i)}>⧉</button>
                  )}
                  <button type="button" className="insp-btn insp-btn-outline" style={{ padding: "2px 8px", fontSize: 11, color: "var(--insp-red)" }} title="Remove this row" onClick={() => onRemove(i)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="insp-btn insp-btn-outline" style={{ marginTop: 8, width: "auto", padding: "5px 14px", fontSize: 12 }} onClick={onAdd}>
        {addLabel}
      </button>
    </>
  );
}

function RegisterEditCell({ column, row, onChange }: { column: RegisterColumn; row: Record<string, string>; onChange: (v: string) => void }) {
  const value = row[column.key] || "";
  const disabled = column.disabledWhen ? column.disabledWhen(row) : false;

  if (column.type === "yesno") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    );
  }
  if (column.type === "select") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {(column.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  return (
    <input
      type={column.type === "date" ? "date" : "text"}
      value={value}
      disabled={disabled}
      placeholder={disabled ? column.disabledPlaceholder : undefined}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: "100%" }}
    />
  );
}

// ---------------- Print/preview table ----------------

export function RegisterPreviewTable({
  columns, rows, certNoHeaderRow, emptyMessage, legend,
}: {
  columns: RegisterColumn[];
  rows: Record<string, string>[];
  // The "Certificate No: ..." row that repeats on every physical page a
  // table spans (see CertNoTheadRow's own comment in
  // CertificatePreview.tsx) — passed in rather than built here, since
  // building it requires colSpan math this component already knows
  // (columns.length + 1) but the actual <tr> markup lives with the rest
  // of that repeating-header convention.
  certNoHeaderRow: (colSpan: number) => ReactNode;
  emptyMessage: string;
  legend?: RegisterLegend;
}) {
  const colSpan = columns.length + 1;
  return (
    <>
      <table className="insp-print-chk">
        <thead>
          {certNoHeaderRow(colSpan)}
          <tr>
            <th>#</th>
            {columns.map((c) => <th key={c.key}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={colSpan} style={{ color: "var(--insp-muted)" }}>{emptyMessage}</td></tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                {columns.map((c) => <td key={c.key}><RegisterPreviewCell column={c} row={row} /></td>)}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {legend && (
        <>
          <div style={{ fontWeight: 700, fontSize: 11.5, color: "var(--insp-navy)", margin: "10px 0 4px" }}>{legend.title}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px 16px", fontSize: 10.5 }}>
            {legend.items.map((item) => <div key={item}>{item}</div>)}
          </div>
        </>
      )}
    </>
  );
}

function RegisterPreviewCell({ column, row }: { column: RegisterColumn; row: Record<string, string> }) {
  const value = row[column.key];
  if (column.type === "yesno") {
    return <span className={`insp-pill ${value === "yes" ? "good" : value === "no" ? "repair" : ""}`}>{ynLabel(value)}</span>;
  }
  if (column.type === "date") {
    return <>{fmtRegisterDate(value)}</>;
  }
  if (column.disabledWhen && column.disabledWhen(row)) {
    return <>N/A</>;
  }
  return <>{value || "—"}</>;
}
