import { FFE_CERT_TYPES, getFFEConfig } from "../data/ffeCertTypes";
import { freshFFEState } from "../data/inspectionHelpers";
import { InspectionCertificate } from "../types/inspection.types";
import VesselLookupPanel from "./VesselLookupPanel";

interface Props {
  current: InspectionCertificate;
  updateField: <K extends keyof InspectionCertificate>(key: K, value: InspectionCertificate[K]) => void;
  openCertificate: (certNo: string) => void;
}

/**
 * Requested directly: put HMZC's real FFE certificate templates (27
 * Word documents covering extinguishers, fixed gas/foam/watermist
 * systems, breathing apparatus, suits, life jackets, hydrostatic tests,
 * etc.) into the Firefighting Equipment division, harmonize every one
 * of them onto the same 3-row header (Vessel/Certificate No, IMO No/
 * Date, Class/Place of Service), and make the item tables incrementable
 * — the inspector adds or removes rows to match how many units they
 * actually found and serviced, rather than a fixed row count baked into
 * a template.
 *
 * One config-driven form handles all ~20 sub-types (see
 * ffeCertTypes.ts) instead of 20 separate hardcoded components — the
 * templates repeat the same handful of shapes (an item register, a
 * fixed system's technical-description + checklist + cylinder
 * register, a small checklist, or a readings table) with different
 * column/field sets, which is exactly what a config, not more
 * components, should express.
 */
export default function FFEForm({ current, updateField, openCertificate }: Props) {
  const ffe = current.ffe || freshFFEState(FFE_CERT_TYPES[0].id);
  const cfg = getFFEConfig(ffe.subType);

  function updateFFE(patch: Partial<typeof ffe>) {
    updateField("ffe", { ...ffe, ...patch });
  }

  function changeSubType(id: string) {
    updateFFE(freshFFEState(id));
  }

  function updateTechnicalValue(key: string, value: string) {
    updateFFE({ technicalValues: { ...ffe.technicalValues, [key]: value } });
  }

  function addItemRow(table: "items" | "items2") {
    const cols = table === "items" ? cfg.itemColumns : cfg.items2Columns;
    const blank: Record<string, string> = {};
    for (const c of cols || []) blank[c.key] = "";
    updateFFE({ [table]: [...ffe[table], blank] } as any);
  }

  function removeItemRow(table: "items" | "items2", index: number) {
    const next = [...ffe[table]];
    next.splice(index, 1);
    updateFFE({ [table]: next } as any);
  }

  function updateItemCell(table: "items" | "items2", index: number, key: string, value: string) {
    const next = [...ffe[table]];
    next[index] = { ...next[index], [key]: value };
    updateFFE({ [table]: next } as any);
  }

  function updateChecklistRow(index: number, patch: Partial<(typeof ffe.checklist)[number]>) {
    const next = [...ffe.checklist];
    next[index] = { ...next[index], ...patch };
    updateFFE({ checklist: next });
  }

  return (
    <>
      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Certificate Type</legend>
        <div className="insp-field">
          <label>FFE Equipment / System</label>
          <select value={ffe.subType} onChange={(e) => changeSubType(e.target.value)}>
            {FFE_CERT_TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
      </fieldset>

      {/* Harmonized header — same 3-row layout across every FFE sub-type,
          requested directly, replacing each template's own inconsistent
          header (some used "Ships/Rig name/Client/Location/Annual
          Service Date", others already used this shorter 3-row form). */}
      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Certificate</legend>
        <div className="insp-row2">
          <div className="insp-field"><label>Vessel</label><input value={current.vesselName} onChange={(e) => updateField("vesselName", e.target.value)} /></div>
          <div className="insp-field"><label>Certificate No</label><input value={current.certNo} readOnly /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label>IMO No</label><input value={current.imoNo} onChange={(e) => updateField("imoNo", e.target.value)} /></div>
          <div className="insp-field"><label>Date</label><input type="date" value={current.dateOfServicing} onChange={(e) => updateField("dateOfServicing", e.target.value)} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label>Class</label><input value={ffe.certClass} onChange={(e) => updateFFE({ certClass: e.target.value })} /></div>
          <div className="insp-field"><label>Place of Service</label><input value={ffe.placeOfService} onChange={(e) => updateFFE({ placeOfService: e.target.value })} /></div>
        </div>
      </fieldset>

      <VesselLookupPanel
        vesselName={current.vesselName}
        imoNo={current.imoNo}
        onOpenCertificate={(certNo, equipmentType) => {
          if (equipmentType === current.type) {
            openCertificate(certNo);
          } else {
            window.location.href = `/inspections?type=${equipmentType}&open=${encodeURIComponent(certNo)}`;
          }
        }}
      />

      {!!cfg.workCodes?.length && (
        <fieldset className="insp-fieldset">
          <legend className="insp-legend">Description of Work Codes</legend>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 16px", fontSize: 11.5 }}>
            {cfg.workCodes.map((w) => <div key={w}>{w}</div>)}
          </div>
        </fieldset>
      )}

      {!!cfg.technicalFields?.length && (
        <fieldset className="insp-fieldset">
          <legend className="insp-legend">Technical Description</legend>
          {cfg.technicalFields.map((f) => (
            <div className="insp-field" key={f.key}>
              <label>{f.label}</label>
              <input value={ffe.technicalValues[f.key] || ""} onChange={(e) => updateTechnicalValue(f.key, e.target.value)} />
            </div>
          ))}
        </fieldset>
      )}

      {!!cfg.itemColumns?.length && (
        <ItemTable
          title={cfg.itemTableLabel || "Items"}
          columns={cfg.itemColumns}
          rows={ffe.items}
          onAdd={() => addItemRow("items")}
          onRemove={(i) => removeItemRow("items", i)}
          onChange={(i, key, v) => updateItemCell("items", i, key, v)}
        />
      )}

      {!!cfg.items2Columns?.length && (
        <ItemTable
          title={cfg.items2Label || "Items"}
          columns={cfg.items2Columns}
          rows={ffe.items2}
          onAdd={() => addItemRow("items2")}
          onRemove={(i) => removeItemRow("items2", i)}
          onChange={(i, key, v) => updateItemCell("items2", i, key, v)}
        />
      )}

      {!!cfg.checklistItems?.length && (
        <fieldset className="insp-fieldset">
          <legend className="insp-legend">Description of Inspection/Tests</legend>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #DCE1E5" }}>
                <th style={{ padding: "4px 6px", width: 32 }}>No</th>
                <th style={{ padding: "4px 6px" }}>Description</th>
                <th style={{ padding: "4px 6px", width: 220 }}>Result</th>
                <th style={{ padding: "4px 6px", width: 160 }}>Comment</th>
              </tr>
            </thead>
            <tbody>
              {ffe.checklist.map((row, i) => (
                <tr key={row.no} style={{ borderTop: "1px solid #EEF1F3" }}>
                  <td style={{ padding: "4px 6px" }}>{row.no}</td>
                  <td style={{ padding: "4px 6px" }}>{row.description}</td>
                  <td style={{ padding: "4px 6px" }}>
                    <select value={row.result} onChange={(e) => updateChecklistRow(i, { result: e.target.value as any })}>
                      <option value="">—</option>
                      <option value="done">Carried Out</option>
                      <option value="not_done">Not Carried Out</option>
                      <option value="na">N/A</option>
                    </select>
                  </td>
                  <td style={{ padding: "4px 6px" }}>
                    <input value={row.comment} onChange={(e) => updateChecklistRow(i, { comment: e.target.value })} style={{ width: "100%" }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </fieldset>
      )}

      {!!cfg.readingsRows?.length && (
        <fieldset className="insp-fieldset">
          <legend className="insp-legend">Readings</legend>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #DCE1E5" }}>
                <th style={{ padding: "4px 6px" }}>Type of Vapor/Gas</th>
                <th style={{ padding: "4px 6px" }}>Measured Value</th>
                <th style={{ padding: "4px 6px" }}>Maximum Allowed</th>
              </tr>
            </thead>
            <tbody>
              {cfg.readingsRows.map((r) => (
                <tr key={r.key} style={{ borderTop: "1px solid #EEF1F3" }}>
                  <td style={{ padding: "4px 6px" }}>{r.label}</td>
                  <td style={{ padding: "4px 6px" }}>
                    <input value={ffe.technicalValues[`reading_${r.key}`] || ""} onChange={(e) => updateTechnicalValue(`reading_${r.key}`, e.target.value)} />
                  </td>
                  <td style={{ padding: "4px 6px", color: "var(--insp-muted)" }}>{r.maxAllowed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </fieldset>
      )}

      {cfg.note && (
        <div style={{ margin: "0 0 14px", background: "#F4F6F7", border: "1px solid #DCE1E5", borderRadius: 6, padding: "8px 12px", fontSize: 11.5, color: "var(--insp-muted)" }}>
          {cfg.note}
        </div>
      )}

      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Comments</legend>
        <textarea rows={3} value={ffe.comments} onChange={(e) => updateFFE({ comments: e.target.value })} />
      </fieldset>
    </>
  );
}

function ItemTable({
  title, columns, rows, onAdd, onRemove, onChange,
}: {
  title: string;
  columns: { key: string; label: string }[];
  rows: Record<string, string>[];
  onAdd: () => void;
  onRemove: (i: number) => void;
  onChange: (i: number, key: string, value: string) => void;
}) {
  return (
    <fieldset className="insp-fieldset">
      <legend className="insp-legend">{title}</legend>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", minWidth: columns.length * 110 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #DCE1E5" }}>
              <th style={{ padding: "4px 6px", width: 30 }}>#</th>
              {columns.map((c) => <th key={c.key} style={{ padding: "4px 6px" }}>{c.label}</th>)}
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ borderTop: "1px solid #EEF1F3" }}>
                <td style={{ padding: "4px 6px", color: "var(--insp-muted)" }}>{i + 1}</td>
                {columns.map((c) => (
                  <td key={c.key} style={{ padding: "4px 6px" }}>
                    <input value={row[c.key] || ""} onChange={(e) => onChange(i, c.key, e.target.value)} style={{ width: "100%" }} />
                  </td>
                ))}
                <td style={{ padding: "4px 6px" }}>
                  <button type="button" className="insp-btn insp-btn-outline" style={{ padding: "2px 8px", fontSize: 11, color: "var(--insp-red)" }} onClick={() => onRemove(i)}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="insp-btn insp-btn-outline" style={{ marginTop: 8, width: "auto", padding: "5px 14px", fontSize: 12 }} onClick={onAdd}>
        + Add Row
      </button>
    </fieldset>
  );
}
