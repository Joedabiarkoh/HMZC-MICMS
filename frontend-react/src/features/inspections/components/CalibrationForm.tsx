import { CALIBRATION_CERT_TYPES, getCalibrationConfig } from "../data/calibrationCertTypes";
import { freshCalibrationState } from "../data/inspectionHelpers";
import { InspectionCertificate } from "../types/inspection.types";
import VesselLookupPanel from "./VesselLookupPanel";
import SignatureCanvas from "./SignatureCanvas";

interface Props {
  current: InspectionCertificate;
  updateField: <K extends keyof InspectionCertificate>(key: K, value: InspectionCertificate[K]) => void;
  openCertificate: (certNo: string) => void;
}

/**
 * Requested directly: put HMZC/BTMS's real calibration certificate
 * templates (personal multi-gas detector, fixed gas sampling system,
 * 15ppm OWS, pressure/temperature calibrators, VECS O2, ODME) into a
 * new Calibration division, harmonized onto the same 3-row header
 * (Vessel/Certificate No, IMO No/Date, Class/Place of Service) FFE
 * already uses. One config-driven form handles all 8 sub-types (see
 * calibrationCertTypes.ts) — mirrors FFEForm.tsx's exact architecture
 * (proven, already built) rather than inventing a parallel data model,
 * kept as its own component/division rather than folded into
 * Firefighting Equipment so "this is a calibration certificate" stays
 * self-documenting.
 */
export default function CalibrationForm({ current, updateField, openCertificate }: Props) {
  const cal = current.calibration || freshCalibrationState(CALIBRATION_CERT_TYPES[0].id);
  const cfg = getCalibrationConfig(cal.subType);

  function updateCalibration(patch: Partial<typeof cal>) {
    updateField("calibration", { ...cal, ...patch });
  }

  function changeSubType(id: string) {
    updateCalibration(freshCalibrationState(id));
  }

  function updateTechnicalValue(key: string, value: string) {
    updateCalibration({ technicalValues: { ...cal.technicalValues, [key]: value } });
  }

  function addItemRow(table: "items" | "items2") {
    const cols = table === "items" ? cfg.itemColumns : cfg.items2Columns;
    const blank: Record<string, string> = {};
    for (const c of cols || []) blank[c.key] = "";
    updateCalibration({ [table]: [...cal[table], blank] } as any);
  }

  function removeItemRow(table: "items" | "items2", index: number) {
    const next = [...cal[table]];
    next.splice(index, 1);
    updateCalibration({ [table]: next } as any);
  }

  function updateItemCell(table: "items" | "items2", index: number, key: string, value: string) {
    const next = [...cal[table]];
    next[index] = { ...next[index], [key]: value };
    updateCalibration({ [table]: next } as any);
  }

  return (
    <>
      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Certificate Type</legend>
        <div className="insp-field">
          <label htmlFor="cal-subtype">Calibration Type</label>
          <select id="cal-subtype" value={cal.subType} onChange={(e) => changeSubType(e.target.value)}>
            {CALIBRATION_CERT_TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
      </fieldset>

      {/* Harmonized header — same 3-row layout FFE already uses, matching
          6 of the 8 source templates natively; the other 2 (older,
          pre-harmonization templates) had their own Vessel/Date/Cert No/
          Temperature/Humidity header instead — folded onto this same
          shape, with their ambient readings moved into Technical
          Reference below (see calibrationCertTypes.ts's own comment). */}
      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Certificate</legend>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="cal-vessel">Vessel</label><input id="cal-vessel" value={current.vesselName} onChange={(e) => updateField("vesselName", e.target.value)} /></div>
          <div className="insp-field"><label htmlFor="cal-cert-no">Certificate No</label><input id="cal-cert-no" value={current.certNo} readOnly /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="cal-imo">IMO No</label><input id="cal-imo" value={current.imoNo} onChange={(e) => updateField("imoNo", e.target.value)} /></div>
          <div className="insp-field"><label htmlFor="cal-date">Date</label><input id="cal-date" type="date" value={current.dateOfServicing} onChange={(e) => updateField("dateOfServicing", e.target.value)} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="cal-class">Class/Flag</label><input id="cal-class" value={cal.certClass} onChange={(e) => updateCalibration({ certClass: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="cal-place">Place of Service</label><input id="cal-place" value={cal.placeOfService} onChange={(e) => updateCalibration({ placeOfService: e.target.value })} /></div>
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

      {!!cfg.technicalFields.length && (
        <fieldset className="insp-fieldset">
          <legend className="insp-legend">Calibration Reference</legend>
          {cfg.technicalFields.map((f) => (
            <div className="insp-field" key={f.key}>
              <label>{f.label}</label>
              <input value={cal.technicalValues[f.key] || ""} onChange={(e) => updateTechnicalValue(f.key, e.target.value)} />
            </div>
          ))}
        </fieldset>
      )}

      <ItemTable
        title={cfg.itemTableLabel}
        columns={cfg.itemColumns}
        rows={cal.items}
        onAdd={() => addItemRow("items")}
        onRemove={(i) => removeItemRow("items", i)}
        onChange={(i, key, v) => updateItemCell("items", i, key, v)}
      />

      <ItemTable
        title={cfg.items2Label}
        columns={cfg.items2Columns}
        rows={cal.items2}
        onAdd={() => addItemRow("items2")}
        onRemove={(i) => removeItemRow("items2", i)}
        onChange={(i, key, v) => updateItemCell("items2", i, key, v)}
      />

      {cfg.note && (
        <div style={{ margin: "0 0 14px", background: "#F4F6F7", border: "1px solid #DCE1E5", borderRadius: 6, padding: "8px 12px", fontSize: 11.5, color: "var(--insp-muted)" }}>
          {cfg.note}
        </div>
      )}

      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Comments</legend>
        <textarea rows={3} value={cal.comments} onChange={(e) => updateCalibration({ comments: e.target.value })} placeholder="e.g. Recommended due date, instrument condition..." />
      </fieldset>

      {/* Reuses the same captainName/captainSig/engineerName/engineerSig
          fields every other equipment type already has on
          InspectionCertificate — "Master" is the same field boat certs
          label "Captain", "Technician" is "Service Engineer" — matching
          the source templates' "Checked By"/"Approved By" roles. */}
      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Signatures</legend>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="cal-master-name">Master Name (optional)</label><input id="cal-master-name" value={current.captainName} onChange={(e) => updateField("captainName", e.target.value)} /></div>
          <div className="insp-field"><label htmlFor="cal-technician-name">Checked/Approved By</label><input id="cal-technician-name" value={current.engineerName} onChange={(e) => updateField("engineerName", e.target.value)} /></div>
        </div>
        <div className="insp-row2">
          <SignatureCanvas label="Master Signature" value={current.captainSig} onChange={(v) => updateField("captainSig", v)} />
          <SignatureCanvas label="Checked/Approved By Signature" value={current.engineerSig} onChange={(v) => updateField("engineerSig", v)} allowSavedDefault />
        </div>
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
