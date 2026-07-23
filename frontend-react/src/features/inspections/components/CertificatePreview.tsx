import { EquipmentTypeConfig, InspectionCertificate, ChecklistStatus, EquipResult, FFEData } from "../types/inspection.types";
import { getFFEConfig } from "../data/ffeCertTypes";
import { HMZC_LOGO_DATA_URI } from "../assets/logo";
import CertificateQR, { buildCertQrPayload } from "./CertificateQR";

// Faint background watermark on every printed page, same treatment as the
// previous standalone tool. Set as a CSS custom property (rather than a
// plain CSS background-image) so the data-URI logo constant can drive it
// without a build-time asset pipeline. Module-level so every page-shaped
// component below (CertificatePreview, ChecklistPage) can share it.
const watermarkStyle = { ["--insp-watermark-url" as any]: `url(${HMZC_LOGO_DATA_URI})` };

interface Props {
  cert: InspectionCertificate;
  config: EquipmentTypeConfig;
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function statusLabel(s: ChecklistStatus) {
  return { good: "GOOD", part: "PART EX.", repair: "REPAIR", na: "N/A", "": "—" }[s] || s;
}
function equipLabel(s: EquipResult) {
  return { ok: "OK", expired: "EXPIRED", missing: "MISSING", damaged: "DAMAGED" }[s] || s;
}

export default function CertificatePreview({ cert, config }: Props) {
  if (config.kind === "ffe" && cert.ffe) {
    return <FFECertificatePage cert={cert} ffe={cert.ffe} />;
  }

  const isBoat = config.kind === "boat";

  return (
    <>
      <div className="insp-cert-page" style={watermarkStyle}>
        <Letterhead cert={cert} />
        <div className="insp-cert-title-row">
          <h2>Statement</h2>
          <span className="insp-badge">{config.typeName.toUpperCase()}</span>
        </div>
        <p style={{ fontSize: 11.5, lineHeight: 1.6 }}>{config.statementIntro}</p>

        <table className="insp-id-table">
          <tbody>
            <tr>
              <td className="insp-label-cell">Name of Ship</td><td>{cert.vesselName || "—"}</td>
              <td className="insp-label-cell">IMO No.</td><td>{cert.imoNo || "—"}</td>
            </tr>
            {isBoat ? (
              <>
                <tr>
                  <td className="insp-label-cell">{config.label}</td>
                  <td>Type: {cert.boat?.typeName || "—"}</td>
                  <td className="insp-label-cell">Serial No.</td><td>{cert.boat?.serial || "—"}</td>
                </tr>
                <tr>
                  <td className="insp-label-cell" /><td>Mfg: {cert.boat?.mfgDate || "—"}</td>
                  <td className="insp-label-cell">Capacity</td><td>{cert.capacity || "—"}</td>
                </tr>
                <tr>
                  <td className="insp-label-cell">Davit</td><td>Type: {cert.davit?.typeName || "—"}</td>
                  <td className="insp-label-cell">Serial No.</td><td>{cert.davit?.serial || "—"}</td>
                </tr>
                <tr>
                  <td className="insp-label-cell">Winch</td><td>Type: {cert.winch?.typeName || "—"}</td>
                  <td className="insp-label-cell">Serial No.</td><td>{cert.winch?.serial || "—"}</td>
                </tr>
              </>
            ) : (
              <>
                <tr>
                  <td className="insp-label-cell">Crane</td><td>Type: {cert.crane?.typeName || "—"}</td>
                  <td className="insp-label-cell">SWL</td><td>{cert.crane?.swl || "—"}</td>
                </tr>
                <tr>
                  <td className="insp-label-cell">Wire Rope</td><td>Type: {cert.wireRope?.typeName || "—"}</td>
                  <td className="insp-label-cell">Diameter</td><td>{cert.wireRope?.diameter || "—"}</td>
                </tr>
              </>
            )}
            <tr>
              <td className="insp-label-cell">Last Serviced</td><td>{fmtDate(cert.lastServicing)}</td>
              <td className="insp-label-cell">Port</td><td>{cert.portServicing || "—"}</td>
            </tr>
            <tr>
              <td className="insp-label-cell">Kind of Servicing</td><td colSpan={3}>{cert.kindOfServicing}</td>
            </tr>
          </tbody>
        </table>

        <div className="insp-remarks-box">Remarks: {cert.remarks}</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 18 }}>
          <SignBox label="Captain Signature" name={cert.captainName} sig={cert.captainSig} />
          <SignBox label="Service Engineer" name={cert.engineerName} sig={cert.engineerSig} />
          <div style={{ borderTop: "1px solid #B9C0C6", paddingTop: 6 }}>
            <div style={{ fontFamily: "monospace", fontSize: 13, color: "var(--insp-navy)" }}>{cert.certNo}</div>
            <div style={{ fontSize: 9.5, color: "var(--insp-muted)", textTransform: "uppercase" }}>Certificate No.</div>
            <div style={{ fontSize: 10.5 }}>Serviced: {fmtDate(cert.dateOfServicing)}</div>
            {cert.issuedBy && (
              <div style={{ fontSize: 9, color: "var(--insp-muted)", marginTop: 2 }}>
                Issued by {cert.issuedBy}{cert.issuedAt ? ` — ${new Date(cert.issuedAt).toLocaleString()}` : ""}
              </div>
            )}
          </div>
        </div>
      </div>

      {isBoat && cert.boatChecklist && (
        <ChecklistPage title={config.boatTitle || "Checklist"} config={config} cert={cert} sections={cert.boatChecklist} outstandingKey="boatChecklist" />
      )}
      {isBoat && cert.davitChecklist && (
        <ChecklistPage title={config.davitTitle || "Davit Checklist"} config={config} cert={cert} sections={cert.davitChecklist} outstandingKey="davitChecklist" />
      )}
      {isBoat && cert.equip && (
        <div className="insp-cert-page" style={watermarkStyle}>
          <Letterhead cert={cert} />
          <div className="insp-cert-title-row"><h2>{config.equipListTitle}</h2><span className="insp-badge">{config.typeName.toUpperCase()}</span></div>
          <table className="insp-print-chk">
            <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Result</th><th>Remarks</th></tr></thead>
            <tbody>
              {cert.equip.map((e) => (
                <tr key={e.n}>
                  <td>{e.n}</td><td>{e.qty}</td><td>{e.unit}</td>
                  <td><span className={`insp-pill ${e.result}`}>{equipLabel(e.result)}</span></td>
                  <td>{e.remark || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!isBoat && cert.checklist && (
        <ChecklistPage title={config.checklistTitle || "Inspection Checklist"} config={config} cert={cert} sections={cert.checklist} outstandingKey="checklist" />
      )}
    </>
  );
}

function checklistResultLabel(r: string) {
  return { done: "Carried Out", not_done: "Not Carried Out", na: "N/A", "": "—" }[r] || r;
}

function FFECertificatePage({ cert, ffe }: { cert: InspectionCertificate; ffe: FFEData }) {
  const cfg = getFFEConfig(ffe.subType);
  return (
    <div className="insp-cert-page" style={watermarkStyle}>
      <Letterhead cert={cert} />
      <div className="insp-cert-title-row">
        <h2>Certificate &amp; Checklist</h2>
        <span className="insp-badge">{cfg.label.toUpperCase()}</span>
      </div>

      <table className="insp-id-table">
        <tbody>
          <tr>
            <td className="insp-label-cell">Vessel</td><td>{cert.vesselName || "—"}</td>
            <td className="insp-label-cell">Certificate No</td><td>{cert.certNo}</td>
          </tr>
          <tr>
            <td className="insp-label-cell">IMO No</td><td>{cert.imoNo || "—"}</td>
            <td className="insp-label-cell">Date</td><td>{fmtDate(cert.dateOfServicing)}</td>
          </tr>
          <tr>
            <td className="insp-label-cell">Class</td><td>{ffe.certClass || "—"}</td>
            <td className="insp-label-cell">Place of Service</td><td>{ffe.placeOfService || "—"}</td>
          </tr>
        </tbody>
      </table>

      {!!cfg.workCodes?.length && (
        <>
          <div style={{ fontWeight: 700, fontSize: 11.5, color: "var(--insp-navy)", margin: "10px 0 4px" }}>Description of Work Codes</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px 16px", fontSize: 10.5 }}>
            {cfg.workCodes.map((w) => <div key={w}>{w}</div>)}
          </div>
        </>
      )}

      {!!cfg.technicalFields?.length && (
        <>
          <div style={{ fontWeight: 700, fontSize: 11.5, color: "var(--insp-navy)", margin: "10px 0 4px" }}>Technical Description</div>
          <table className="insp-id-table">
            <tbody>
              {cfg.technicalFields.map((f) => (
                <tr key={f.key}><td className="insp-label-cell">{f.label}</td><td colSpan={3}>{ffe.technicalValues[f.key] || "—"}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {!!cfg.itemColumns?.length && (
        <FFEItemsTable title={cfg.itemTableLabel || "Items"} columns={cfg.itemColumns} rows={ffe.items} />
      )}
      {!!cfg.items2Columns?.length && (
        <FFEItemsTable title={cfg.items2Label || "Items"} columns={cfg.items2Columns} rows={ffe.items2} />
      )}

      {!!cfg.checklistItems?.length && (
        <>
          <div style={{ fontWeight: 700, fontSize: 11.5, color: "var(--insp-navy)", margin: "10px 0 4px" }}>Description of Inspection/Tests</div>
          <table className="insp-print-chk">
            <thead><tr><th>No</th><th>Description</th><th>Result</th><th>Comment</th></tr></thead>
            <tbody>
              {ffe.checklist.map((row) => (
                <tr key={row.no}>
                  <td>{row.no}</td>
                  <td>{row.description}</td>
                  <td><span className={`insp-pill ${row.result === "done" ? "good" : row.result === "not_done" ? "repair" : row.result === "na" ? "na" : ""}`}>{checklistResultLabel(row.result)}</span></td>
                  <td>{row.comment || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {!!cfg.readingsRows?.length && (
        <>
          <div style={{ fontWeight: 700, fontSize: 11.5, color: "var(--insp-navy)", margin: "10px 0 4px" }}>Readings</div>
          <table className="insp-print-chk">
            <thead><tr><th>Type of Vapor/Gas</th><th>Measured Value</th><th>Maximum Allowed</th></tr></thead>
            <tbody>
              {cfg.readingsRows.map((r) => (
                <tr key={r.key}>
                  <td>{r.label}</td>
                  <td>{ffe.technicalValues[`reading_${r.key}`] || "—"}</td>
                  <td>{r.maxAllowed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {cfg.note && <div style={{ fontSize: 10, color: "var(--insp-muted)", marginTop: 8 }}>{cfg.note}</div>}

      <div className="insp-remarks-box">Comments: {ffe.comments || "None"}</div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 18 }}>
        <div style={{ fontSize: 10, color: "var(--insp-muted)" }}>
          This Certificate is valid for {cfg.validityYears === 2 ? "Two Years" : "One Year"} from the date of issue.
          {cert.issuedBy && (
            <div style={{ marginTop: 4 }}>
              Issued by {cert.issuedBy}{cert.issuedAt ? ` — ${new Date(cert.issuedAt).toLocaleString()}` : ""}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FFEItemsTable({ title, columns, rows }: { title: string; columns: { key: string; label: string }[]; rows: Record<string, string>[] }) {
  return (
    <>
      <div style={{ fontWeight: 700, fontSize: 11.5, color: "var(--insp-navy)", margin: "10px 0 4px" }}>{title}</div>
      <table className="insp-print-chk">
        <thead>
          <tr>
            <th>#</th>
            {columns.map((c) => <th key={c.key}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length + 1} style={{ color: "var(--insp-muted)" }}>No rows recorded.</td></tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                {columns.map((c) => <td key={c.key}>{row[c.key] || "—"}</td>)}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </>
  );
}

function Letterhead({ cert }: { cert: InspectionCertificate }) {
  return (
    <div className="insp-letterhead">
      <img src={HMZC_LOGO_DATA_URI} alt="HMZC LTD" />
      <div className="insp-lh-right" style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div>
          HMZC LTD — Marine Engineering Services<br />
          Cabinda HQ: Urbanização 4 De Abril, Cabinda, Angola<br />
          Luanda: N.º 5 Rua da Igreja (Vulgo Bento Raimundo), Próximo ao Mercado Kiffca,<br />
          Bairro Chinguar, Bairro Benfica-Talatona, Luanda<br />
          admin@hmzchealthinmarine.com&nbsp;|&nbsp;+244 972 320 300
        </div>
        <CertificateQR
          payload={buildCertQrPayload(cert.certNo, cert.vesselName, cert.imoNo, cert.dateOfServicing)}
          size={54}
        />
      </div>
    </div>
  );
}

function SignBox({ label, name, sig }: { label: string; name: string; sig: string }) {
  return (
    <div style={{ borderTop: "1px solid #B9C0C6", paddingTop: 6 }}>
      {sig ? <img src={sig} alt={label} style={{ height: 34 }} /> : <div style={{ fontFamily: "cursive", fontSize: 18, color: "var(--insp-navy)" }}>{name}</div>}
      <div style={{ fontSize: 9.5, color: "var(--insp-muted)", textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}

function ChecklistPage({ title, config, cert, sections, outstandingKey }: any) {
  return (
    <div className="insp-cert-page" style={watermarkStyle}>
      <Letterhead cert={cert} />
      <div className="insp-cert-title-row"><h2>{title}</h2><span className="insp-badge">{config.typeName.toUpperCase()}</span></div>
      <table className="insp-print-chk">
        <thead><tr><th>Item</th><th>Result</th><th>Remarks</th></tr></thead>
        <tbody>
          {sections.map((sec: any) => {
            if (sec.hydraulicGate && cert.type === "rescueboat" && !cert.hydraulicFitted) return null;
            return (
              <>
                <tr className="insp-section-row" key={`${sec.code}-hdr`}><td colSpan={3}>{sec.code}. {sec.name}</td></tr>
                {sec.items.map((it: any, i: number) => (
                  <tr key={`${sec.code}-${i}`}>
                    <td>{it.label}</td>
                    <td><span className={`insp-pill ${it.status}`}>{statusLabel(it.status)}</span></td>
                    <td>{it.remark || "—"}</td>
                  </tr>
                ))}
                {sec.special.map((it: any, i: number) => (
                  <tr key={`${sec.code}-sp-${i}`}>
                    <td>{it.label} <em style={{ color: "var(--insp-muted)" }}>({it.presetRemark})</em></td>
                    <td><span className={`insp-pill ${it.status}`}>{statusLabel(it.status)}</span></td>
                    <td>{it.remark || "—"}</td>
                  </tr>
                ))}
              </>
            );
          })}
        </tbody>
      </table>
      <div className="insp-remarks-box" style={{ borderColor: "var(--insp-red)", background: "#FBEEEC", color: "#7A241B" }}>
        Outstanding Issues / Defects Raised: {(cert.outstanding && cert.outstanding[outstandingKey]) || "None"}
      </div>
      {cert.photos && cert.photos[outstandingKey] && cert.photos[outstandingKey].length > 0 && (
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
          {cert.photos[outstandingKey].map((p: string, i: number) => (
            <img key={i} src={p} alt={`Evidence ${i + 1}`} style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 4, border: "1px solid #C9D1D8" }} />
          ))}
        </div>
      )}
    </div>
  );
}
