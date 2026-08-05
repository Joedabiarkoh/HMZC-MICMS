import type { ReactNode } from "react";
import { EquipmentTypeConfig, InspectionCertificate, ChecklistStatus, EquipResult, CalibrationData, FFEData, LooseGearData, LooseGearMultipleItemsData, LooseGearStandardReportData, LooseGearStatutoryAnswers, LooseGearVisualCertData, LooseGearYesNo } from "../types/inspection.types";
import { getFFEConfig } from "../data/ffeCertTypes";
import { getCalibrationConfig } from "../data/calibrationCertTypes";
import { HMZC_LOGO_DATA_URI } from "../assets/logo";
import { HMZC_STAMP_DATA_URI } from "../assets/stamp";
import { ABS_LOGO_DATA_URI, BUREAU_VERITAS_LOGO_DATA_URI, CRALOG_LOGO_DATA_URI, DNV_LOGO_DATA_URI } from "../assets/approvalLogos";
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

  if (config.kind === "loosegear" && cert.looseGear) {
    return <LooseGearCertificatePage cert={cert} looseGear={cert.looseGear} />;
  }

  if (config.kind === "calibration" && cert.calibration) {
    return <CalibrationCertificatePage cert={cert} calibration={cert.calibration} />;
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
              <td className="insp-label-cell">Certificate No</td><td>{cert.certNo}</td>
              <td className="insp-label-cell">Date of Servicing</td><td>{fmtDate(cert.dateOfServicing)}</td>
            </tr>
            <tr>
              <td className="insp-label-cell">Name of Ship</td><td>{cert.vesselName || "—"}</td>
              <td className="insp-label-cell">IMO No.</td><td>{cert.imoNo || "—"}</td>
            </tr>
            {/* Requested directly: "the statement is also missing date and
                other information" — Flag and Location on Board were
                already captured by the form (StatementForm.tsx) but never
                printed on the certificate; Flag didn't exist as a field
                at all until now. */}
            <tr>
              <td className="insp-label-cell">Flag</td><td>{cert.flag || "—"}</td>
              <td className="insp-label-cell">{isBoat ? "Location on Board" : "Crane Location"}</td><td>{cert.location || "—"}</td>
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
                {/* Requested directly: Manufacturer was already captured
                    by the form for every one of boat/release/davit/winch
                    (IdBlock in InspectionWorkspace.tsx) but the printed
                    certificate previously showed none of it, and Release
                    Mechanism didn't appear on the printed certificate at
                    all — matching the reference Iberia Lifeboat Service
                    certificates, which print Type/Building No./
                    Manufacturer for the boat, release gear, davit, and
                    winch as four distinct blocks. */}
                <tr>
                  <td className="insp-label-cell">Manufacturer</td><td colSpan={3}>{cert.boat?.manufacturer || "—"}</td>
                </tr>
                <tr>
                  <td className="insp-label-cell">Release Mechanism</td>
                  <td>Type: {cert.release?.typeName || "—"}</td>
                  <td className="insp-label-cell">Serial No.</td><td>{cert.release?.serial || "—"}</td>
                </tr>
                <tr>
                  <td className="insp-label-cell" /><td>Mfg: {cert.release?.mfgDate || "—"}</td>
                  <td className="insp-label-cell">Manufacturer</td><td>{cert.release?.manufacturer || "—"}</td>
                </tr>
                <tr>
                  <td className="insp-label-cell">Davit</td><td>Type: {cert.davit?.typeName || "—"}</td>
                  <td className="insp-label-cell">Serial No.</td><td>{cert.davit?.serial || "—"}</td>
                </tr>
                <tr>
                  <td className="insp-label-cell" /><td>Mfg: {cert.davit?.mfgDate || "—"}</td>
                  <td className="insp-label-cell">Manufacturer</td><td>{cert.davit?.manufacturer || "—"}</td>
                </tr>
                <tr>
                  <td className="insp-label-cell">Winch</td><td>Type: {cert.winch?.typeName || "—"}</td>
                  <td className="insp-label-cell">Serial No.</td><td>{cert.winch?.serial || "—"}</td>
                </tr>
                <tr>
                  <td className="insp-label-cell" /><td>Mfg: {cert.winch?.mfgDate || "—"}</td>
                  <td className="insp-label-cell">Manufacturer</td><td>{cert.winch?.manufacturer || "—"}</td>
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

        {/* Requested directly: "keep the signature style same for all
            certificate" — this page used to have its own bespoke
            3-column signature grid (Captain | Engineer | a Certificate
            No./Serviced/Issued-by block crammed in as the 3rd column)
            instead of the shared SignatureFooter every other
            certificate type uses. Certificate No. and Date of
            Servicing moved into the ID table above (matching
            FFECertificatePage's own convention), "Issued by" moved to
            this small line right before the signatures (matching
            FFECertificatePage/MultipleItemsPage's own convention too),
            and the signature area itself is now the same shared
            2-column SignatureFooter as everywhere else. */}
        {cert.issuedBy && (
          <div style={{ fontSize: 10, color: "var(--insp-muted)", marginTop: 8 }}>
            Issued by {cert.issuedBy}{cert.issuedAt ? ` — ${new Date(cert.issuedAt).toLocaleString()}` : ""}
          </div>
        )}
        <SignatureFooter cert={cert} masterLabel="Captain Signature" techLabel="Service Engineer" />
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
            <thead>
              <CertNoTheadRow certNo={cert.certNo} colSpan={5} />
              <tr><th>Item</th><th>Qty</th><th>Unit</th><th>Result</th><th>Remarks</th></tr>
            </thead>
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
          <SignatureFooter cert={cert} masterLabel="Captain Signature" techLabel="Service Engineer" />
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

// Requested directly: the certificate number should appear on every
// page of the same certificate, not just the first one. A multi-page
// boat/crane certificate (main page + a separate ChecklistPage per
// section — Boat Checklist, Davit Checklist, Equipment List, each its
// own .insp-cert-page with its own Letterhead) previously only showed
// Certificate No. on that first page's own ID table — any continuation
// page had no way to identify which certificate it belonged to once
// separated from the rest (a printed page shuffled out of order, or a
// single page photocopied on its own). A <thead> row is a real native
// browser behavior that repeats on every physical page a table spans —
// this is that row, meant to be the first row inside a table's own
// <thead>, above its real column headers, for any table long enough to
// plausibly overflow a page on its own (an equipment/item register, a
// checklist). There used to also be a plain, one-off "Certificate No:"
// line printed just above the table for this same reason — removed
// (requested directly, reviewing a printed PDF: "the certificate
// number is appearing twice on the same page") since this thead row
// already covers the table's first page too, making that line pure
// duplication there, and it never printed on the table's own
// continuation pages anyway.
function CertNoTheadRow({ certNo, colSpan }: { certNo: string; colSpan: number }) {
  return (
    <tr>
      <th colSpan={colSpan} style={{ fontWeight: 400 }}>Certificate No: {certNo}</th>
    </tr>
  );
}

// Requested directly: "inset a break for pages when it goes beyond
// certain number of added rows like 20 added rows per page or 25 for
// easy orientation and arrangement" — for the FFE item table
// specifically ("FFE certificate can also go beyond 1 page depending
// on number of equipment on board"). Previously it relied purely on
// wherever content happened to run out of room on the page —
// break-inside: avoid on each row (inspections.css) only stops a row
// being split in half, it doesn't control WHERE the break falls, so
// one certificate's item table might break after 18 rows and another
// after 31 depending on how much other content sat above it. This
// forces a hard break every fixed number of rows instead, so a table
// with (say) 60 added items reliably prints as three pages of 25
// rather than some other split. Deliberately scoped to just this
// table — the boat/crane checklists, Equipment List, and Loose Gear's
// Multiple Items register were tried with the same forced break but
// reverted back to natural pagination on request.
const ROWS_PER_PRINT_PAGE = 25;

function chunkRows<T>(rows: T[]): T[][] {
  if (rows.length === 0) return [[]];
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_PRINT_PAGE) {
    chunks.push(rows.slice(i, i + ROWS_PER_PRINT_PAGE));
  }
  return chunks;
}

// Used by FFEItemsTable (FFE + Calibration item tables) — each chunk of
// ROWS_PER_PRINT_PAGE rows renders as its own <table> with its own
// repeating <CertNoTheadRow>/column headers (same native-thead-repeats-
// per-page mechanism CertNoTheadRow already relies on), and
// break-before: page forces every chunk after the first onto a fresh
// physical page.
function PaginatedTable<T>({
  title, certNo, colSpan, columnHeaders, rows, renderRow, emptyMessage,
}: {
  title?: string;
  certNo: string;
  colSpan: number;
  columnHeaders: ReactNode;
  rows: T[];
  renderRow: (row: T, indexInChunk: number, globalIndex: number) => ReactNode;
  emptyMessage?: string;
}) {
  const chunks = chunkRows(rows);
  return (
    <>
      {chunks.map((chunk, ci) => (
        <div key={ci} style={ci > 0 ? ({ breakBefore: "page" } as any) : undefined}>
          {title && (
            <div style={{ fontWeight: 700, fontSize: 11.5, color: "var(--insp-navy)", margin: "10px 0 4px" }}>
              {title}{chunks.length > 1 ? ` (continued — page ${ci + 1} of ${chunks.length})` : ""}
            </div>
          )}
          <table className="insp-print-chk">
            <thead>
              <CertNoTheadRow certNo={certNo} colSpan={colSpan} />
              {columnHeaders}
            </thead>
            <tbody>
              {chunk.length === 0 ? (
                <tr><td colSpan={colSpan} style={{ color: "var(--insp-muted)" }}>{emptyMessage || "No rows recorded."}</td></tr>
              ) : (
                chunk.map((row, i) => renderRow(row, i, ci * ROWS_PER_PRINT_PAGE + i))
              )}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}

// Requested directly: every certificate page needs a signature. FFE
// certificates previously rendered as one giant page (a 25-item CO2
// checklist plus a cylinder register plus everything else all in one
// div), so a signature at the very bottom only ever appeared once, no
// matter how many physical pages that content actually printed across.
// Split into the same kind of fixed, per-section pages the boat/crane
// certificates already use (Statement / Boat Checklist / Davit
// Checklist / Equipment List, always separate regardless of how short
// any one of them is) — one page for the header+technical info, one
// per populated table section, one for comments/sign-off — each with
// its own letterhead and its own SignatureFooter.
// Requested directly: a certificate should be ONE page by default, and
// only spill onto additional pages when there's actually enough content
// (a long item register, a big checklist) to need it — not force
// separate pages for "info", "items", "checklist" etc. as fixed
// sections regardless of how short each one is, which is what the
// previous <FFEPage>-per-section version did (a Fire Blanket cert with
// two rows and no checklist still printed 3 forced pages).
//
// One .insp-cert-page div now holds every section, with ONE Letterhead
// at the top and ONE SignatureFooter at the true end — natural browser
// print pagination (no forced page-break-after) decides where content
// actually needs to continue onto a new physical page. Each table's own
// <thead> (item tables, checklist) still repeats its column headers on
// a following page when a table itself spans more than one page — a
// real, native browser behavior, not something built here — and
// break-inside: avoid on individual rows (see inspections.css) stops a
// single row being awkwardly split across the page boundary, which is
// what keeps each page's row count naturally landing in a legible
// range rather than an arbitrary fixed row count per page.
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
            <td className="insp-label-cell">Class/Flag</td><td>{ffe.certClass || "—"}</td>
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

      {cfg.note && <div style={{ fontSize: 10, color: "var(--insp-muted)", marginTop: 8 }}>{cfg.note}</div>}

      {!!cfg.itemColumns?.length && (
        <FFEItemsTable title={cfg.itemTableLabel || "Items"} columns={cfg.itemColumns} rows={ffe.items} certNo={cert.certNo} />
      )}

      {!!cfg.items2Columns?.length && (
        <FFEItemsTable title={cfg.items2Label || "Items"} columns={cfg.items2Columns} rows={ffe.items2} certNo={cert.certNo} />
      )}

      {!!cfg.checklistItems?.length && (
        <>
          <div style={{ fontWeight: 700, fontSize: 11.5, color: "var(--insp-navy)", margin: "10px 0 4px" }}>Description of Inspection/Tests</div>
          <table className="insp-print-chk">
            <thead>
              <CertNoTheadRow certNo={cert.certNo} colSpan={4} />
              <tr><th>No</th><th>Description</th><th>Result</th><th>Comment</th></tr>
            </thead>
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
            <thead>
              <CertNoTheadRow certNo={cert.certNo} colSpan={3} />
              <tr><th>Type of Vapor/Gas</th><th>Measured Value</th><th>Maximum Allowed</th></tr>
            </thead>
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

      <div className="insp-remarks-box">Comments: {ffe.comments || "None"}</div>
      <div style={{ fontSize: 10, color: "var(--insp-muted)", marginTop: 8 }}>
        This Certificate is valid for {cfg.validityYears === 2 ? "Two Years" : "One Year"} from the date of issue.
        {cert.issuedBy && (
          <div style={{ marginTop: 4 }}>
            Issued by {cert.issuedBy}{cert.issuedAt ? ` — ${new Date(cert.issuedAt).toLocaleString()}` : ""}
          </div>
        )}
      </div>

      <SignatureFooter cert={cert} masterLabel="Master" techLabel="Technician" />
    </div>
  );
}

function FFEItemsTable({ title, columns, rows, certNo }: { title: string; columns: { key: string; label: string }[]; rows: Record<string, string>[]; certNo: string }) {
  return (
    <PaginatedTable
      title={title}
      certNo={certNo}
      colSpan={columns.length + 1}
      columnHeaders={<tr><th>#</th>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr>}
      rows={rows}
      renderRow={(row, _i, globalIndex) => (
        <tr key={globalIndex}>
          <td>{globalIndex + 1}</td>
          {columns.map((c) => <td key={c.key}>{row[c.key] || "—"}</td>)}
        </tr>
      )}
    />
  );
}

// Mirrors FFECertificatePage's exact structure (same reasoning as
// CalibrationForm.tsx mirroring FFEForm.tsx) — reuses FFEItemsTable
// above directly since it's already generic, not FFE-specific.
function CalibrationCertificatePage({ cert, calibration }: { cert: InspectionCertificate; calibration: CalibrationData }) {
  const cfg = getCalibrationConfig(calibration.subType);

  return (
    <div className="insp-cert-page" style={watermarkStyle}>
      <Letterhead cert={cert} />
      <div className="insp-cert-title-row">
        <h2>Calibration Certificate</h2>
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
            <td className="insp-label-cell">Class/Flag</td><td>{calibration.certClass || "—"}</td>
            <td className="insp-label-cell">Place of Service</td><td>{calibration.placeOfService || "—"}</td>
          </tr>
        </tbody>
      </table>

      {!!cfg.technicalFields.length && (
        <>
          <div style={{ fontWeight: 700, fontSize: 11.5, color: "var(--insp-navy)", margin: "10px 0 4px" }}>Calibration Reference</div>
          <table className="insp-id-table">
            <tbody>
              {cfg.technicalFields.map((f) => (
                <tr key={f.key}><td className="insp-label-cell">{f.label}</td><td colSpan={3}>{calibration.technicalValues[f.key] || "—"}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <FFEItemsTable title={cfg.itemTableLabel} columns={cfg.itemColumns} rows={calibration.items} certNo={cert.certNo} />
      <FFEItemsTable title={cfg.items2Label} columns={cfg.items2Columns} rows={calibration.items2} certNo={cert.certNo} />

      {cfg.note && <div style={{ fontSize: 10, color: "var(--insp-muted)", marginTop: 8 }}>{cfg.note}</div>}

      <div className="insp-remarks-box">Comments: {calibration.comments || "None"}</div>
      <div style={{ fontSize: 10, color: "var(--insp-muted)", marginTop: 8 }}>
        This Certificate is valid for {cfg.validityYears === 2 ? "Two Years" : "One Year"} from the date of issue.
        {cert.issuedBy && (
          <div style={{ marginTop: 4 }}>
            Issued by {cert.issuedBy}{cert.issuedAt ? ` — ${new Date(cert.issuedAt).toLocaleString()}` : ""}
          </div>
        )}
      </div>

      <SignatureFooter cert={cert} masterLabel="Master" techLabel="Checked/Approved By" />
    </div>
  );
}

function yesNoLabel(v: LooseGearYesNo) {
  return { yes: "YES", no: "NO", "": "—" }[v] || v;
}

// The source LOLER forms show every statutory answer as a literal
// checkbox pair ("YES [x] NO [ ]"), not a plain word — matches the same
// visual convention LooseGearForm.tsx's YesNoField uses on the editing
// side, so the printed certificate reads like the actual form rather
// than a generic app table.
function yesNoCheckboxes(v: LooseGearYesNo) {
  return (
    <span style={{ whiteSpace: "nowrap" }}>
      <span aria-hidden="true">{v === "yes" ? "☒" : "☐"}</span> YES&nbsp;&nbsp;
      <span aria-hidden="true">{v === "no" ? "☒" : "☐"}</span> NO
    </span>
  );
}

// Three genuinely different source templates, each printed as its own
// distinct layout — no shared "LooseGearCertificatePage" wrapper,
// matching how the form side (LooseGearForm.tsx) keeps them separate
// rather than forcing one restyled shape onto all three.
function LooseGearCertificatePage({ cert, looseGear }: { cert: InspectionCertificate; looseGear: LooseGearData }) {
  if (looseGear.subType === "visual_certificate" && looseGear.visualCert) {
    return <VisualCertPage cert={cert} data={looseGear.visualCert} />;
  }
  if (looseGear.subType === "standard_report" && looseGear.standardReport) {
    return <StandardReportPage cert={cert} data={looseGear.standardReport} />;
  }
  if (looseGear.subType === "multiple_items" && looseGear.multipleItems) {
    return <MultipleItemsPage cert={cert} data={looseGear.multipleItems} />;
  }
  return null;
}

function StatutoryAnswersRows({ data }: { data: LooseGearStatutoryAnswers }) {
  return (
    <>
      <table className="insp-id-table">
        <tbody>
          <tr>
            <td className="insp-label-cell">First Exam After Install</td><td>{yesNoCheckboxes(data.firstExaminationAfterInstall)}</td>
            <td className="insp-label-cell">Installed Correctly</td><td>{yesNoCheckboxes(data.installedCorrectly)}</td>
          </tr>
          <tr>
            <td className="insp-label-cell">Within 6 Months</td><td>{yesNoCheckboxes(data.examinedWithin6Months)}</td>
            <td className="insp-label-cell">Within 12 Months</td><td>{yesNoCheckboxes(data.examinedWithin12Months)}</td>
          </tr>
          <tr>
            <td className="insp-label-cell">Per Examination Scheme</td><td>{yesNoCheckboxes(data.inAccordanceWithScheme)}</td>
            <td className="insp-label-cell">After Exceptional Circumstances</td><td>{yesNoCheckboxes(data.afterExceptionalCircumstances)}</td>
          </tr>
        </tbody>
      </table>
      <div className="insp-remarks-box">Defect: {data.defectDescription || "NONE"}</div>
      <table className="insp-id-table">
        <tbody>
          <tr>
            <td className="insp-label-cell">Existing/Imminent Danger</td><td>{yesNoCheckboxes(data.existingOrImminentDanger)}</td>
            <td className="insp-label-cell">Could Become Danger By</td><td>{fmtDate(data.couldBecomeDangerBy)}</td>
          </tr>
        </tbody>
      </table>
      {data.repairParticulars && <div className="insp-remarks-box">Repair/Renewal Required: {data.repairParticulars}</div>}
      {data.testsCarriedOut && <div className="insp-remarks-box">Tests Carried Out: {data.testsCarriedOut}</div>}
      {data.observations && <div className="insp-remarks-box">Observations: {data.observations}</div>}
      <table className="insp-id-table">
        <tbody>
          <tr>
            <td className="insp-label-cell">Safe to Operate</td>
            <td><span className={`insp-pill ${data.safeToOperate === "yes" ? "good" : data.safeToOperate === "no" ? "repair" : ""}`}>{yesNoLabel(data.safeToOperate)}</span></td>
          </tr>
        </tbody>
      </table>
    </>
  );
}

function VisualCertPage({ cert, data }: { cert: InspectionCertificate; data: LooseGearVisualCertData }) {
  return (
    <div className="insp-cert-page" style={watermarkStyle}>
      <Letterhead cert={cert} />
      <div className="insp-cert-title-row">
        <h2>Visual Certificate of Thorough Examination</h2>
        <span className="insp-badge">LOOSE GEAR &amp; LIFTING EQUIPMENT</span>
      </div>
      <table className="insp-id-table">
        <tbody>
          <tr>
            <td className="insp-label-cell">Client/Owner</td><td>{data.clientOwner || "—"}</td>
            <td className="insp-label-cell">Certificate No</td><td>{cert.certNo}</td>
          </tr>
          <tr>
            <td className="insp-label-cell">Site</td><td>{data.site || "—"}</td>
            <td className="insp-label-cell">Charge Code/Order No.</td><td>{data.chargeCodeOrderNo || "—"}</td>
          </tr>
          <tr>
            <td className="insp-label-cell">Site Location</td><td>{data.siteLocation || "—"}</td>
            <td className="insp-label-cell">Issue Date</td><td>{fmtDate(cert.dateOfServicing)}</td>
          </tr>
          <tr>
            <td className="insp-label-cell">PO/Job No.</td><td>{data.poJobNo || "—"}</td>
            <td className="insp-label-cell">Color Code</td><td>{data.colorCode || "—"}</td>
          </tr>
          <tr>
            <td className="insp-label-cell">Inspection Type</td><td>{data.inspectionType || "—"}</td>
            <td className="insp-label-cell">Standard</td><td>{data.standard || "—"}</td>
          </tr>
          <tr>
            <td className="insp-label-cell">Vessel</td><td colSpan={3}>{cert.vesselName || "—"}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ fontWeight: 700, fontSize: 11.5, color: "var(--insp-navy)", margin: "10px 0 4px" }}>Details of Examination</div>
      <table className="insp-id-table">
        <tbody>
          <tr>
            <td className="insp-label-cell">Item Serial No.</td><td>{data.itemSerialNo || "—"}</td>
            <td className="insp-label-cell">Item Description</td><td>{data.itemDescription || "—"}</td>
          </tr>
          <tr>
            <td className="insp-label-cell">SWL</td><td>{data.swl || "—"}</td>
            <td className="insp-label-cell">Item Location</td><td>{data.itemLocation || "—"}</td>
          </tr>
          <tr>
            <td className="insp-label-cell">Previous Cert No.</td><td>{data.previousCertificateNo || "—"}</td>
            <td className="insp-label-cell">Manufacturer</td><td>{data.manufacturer || "—"}</td>
          </tr>
          <tr>
            <td className="insp-label-cell">Previous Inspection</td><td>{fmtDate(data.previousInspectionDate)}</td>
            <td className="insp-label-cell">Test Date</td><td>{fmtDate(data.testDate)}</td>
          </tr>
          <tr>
            <td className="insp-label-cell">EC Declaration Available</td><td>{yesNoCheckboxes(data.ecDeclarationAvailable)}</td>
            <td className="insp-label-cell">CE Mark Visible</td><td>{yesNoCheckboxes(data.ceMarkVisible)}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ fontWeight: 700, fontSize: 11.5, color: "var(--insp-navy)", margin: "10px 0 4px" }}>LOLER 1998 Statutory Declaration</div>
      <StatutoryAnswersRows data={data.statutory} />
      <table className="insp-id-table">
        <tbody>
          <tr>
            <td className="insp-label-cell">Reported By</td><td colSpan={3}>{data.reportedByNameAndQualifications || "—"}</td>
          </tr>
          <tr>
            <td className="insp-label-cell">Authenticated By</td><td>{data.authenticatedByName || "—"}</td>
            <td className="insp-label-cell">Next Exam Due</td><td>{fmtDate(data.nextExaminationDue)}</td>
          </tr>
          <tr>
            <td className="insp-label-cell">Employer</td><td colSpan={3}>{data.employerNameAddress || "—"}</td>
          </tr>
        </tbody>
      </table>

      {cert.issuedBy && (
        <div style={{ fontSize: 9, color: "var(--insp-muted)", marginTop: 8 }}>
          Issued by {cert.issuedBy}{cert.issuedAt ? ` — ${new Date(cert.issuedAt).toLocaleString()}` : ""}
        </div>
      )}
      <SignatureFooter cert={cert} masterLabel="Master" techLabel="Inspector" />
    </div>
  );
}

function StandardReportPage({ cert, data }: { cert: InspectionCertificate; data: LooseGearStandardReportData }) {
  return (
    <div className="insp-cert-page" style={watermarkStyle}>
      <Letterhead cert={cert} />
      <div className="insp-cert-title-row">
        <h2>Report of Thorough Examination</h2>
        <span className="insp-badge">LOOSE GEAR &amp; LIFTING EQUIPMENT</span>
      </div>
      <div style={{ fontSize: 10, color: "var(--insp-muted)", marginBottom: 6 }}>
        Lifting &amp; Rigging colour code is based on ACEPA (Association of Companies of Oil Exploration and Production in Angola).
      </div>
      <table className="insp-id-table">
        <tbody>
          <tr>
            <td className="insp-label-cell">Certificate No</td><td>{cert.certNo}</td>
            <td className="insp-label-cell">Vessel</td><td>{cert.vesselName || "—"}</td>
          </tr>
          <tr>
            <td className="insp-label-cell">Date of Examination</td><td>{fmtDate(data.dateOfExamination)}</td>
            <td className="insp-label-cell">Date of Report</td><td>{fmtDate(data.dateOfReport)}</td>
          </tr>
          <tr>
            <td className="insp-label-cell">Report Number</td><td colSpan={3}>{data.reportNumber || "—"}</td>
          </tr>
          <tr>
            <td className="insp-label-cell">Employer (for whom exam made)</td><td colSpan={3}>{data.clientEmployerNameAddress || "—"}</td>
          </tr>
          <tr>
            <td className="insp-label-cell">Premises Address</td><td colSpan={3}>{data.premisesAddress || "—"}</td>
          </tr>
          <tr>
            <td className="insp-label-cell">Equipment Description</td><td colSpan={3}>{data.equipmentDescription || "—"}</td>
          </tr>
          <tr>
            <td className="insp-label-cell">SWL</td><td>{data.swl || "—"}</td>
            <td className="insp-label-cell">Date of Manufacture</td><td>{fmtDate(data.dateOfManufacture)}</td>
          </tr>
          <tr>
            <td className="insp-label-cell">Date of Last Examination</td><td colSpan={3}>{fmtDate(data.dateOfLastExamination)}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ fontWeight: 700, fontSize: 11.5, color: "var(--insp-navy)", margin: "10px 0 4px" }}>LOLER 1998 Statutory Declaration</div>
      <StatutoryAnswersRows data={data.statutory} />
      <table className="insp-id-table">
        <tbody>
          <tr>
            <td className="insp-label-cell">Reported By</td><td colSpan={3}>{data.reportedByNameAndQualifications || "—"}</td>
          </tr>
          <tr>
            <td className="insp-label-cell">Authenticated By</td><td>{data.authenticatedByName || "—"}</td>
            <td className="insp-label-cell">Next Exam Due</td><td>{fmtDate(data.nextExaminationDue)}</td>
          </tr>
          <tr>
            <td className="insp-label-cell">Employer (authenticating)</td><td colSpan={3}>{data.authenticatingEmployerNameAddress || "—"}</td>
          </tr>
        </tbody>
      </table>

      {cert.issuedBy && (
        <div style={{ fontSize: 9, color: "var(--insp-muted)", marginTop: 8 }}>
          Issued by {cert.issuedBy}{cert.issuedAt ? ` — ${new Date(cert.issuedAt).toLocaleString()}` : ""}
        </div>
      )}
      <SignatureFooter cert={cert} masterLabel="Master" techLabel="Inspector" />
    </div>
  );
}

const REASON_PRINT_LABELS: Record<string, string> = {
  installation: "Installation (A)",
  "6monthly": "6 Monthly (B)",
  "12monthly": "12 Monthly (C)",
  written_scheme: "Written Scheme (D)",
  exceptional: "Exceptional Circumstance (E)",
  "": "—",
};

function MultipleItemsPage({ cert, data }: { cert: InspectionCertificate; data: LooseGearMultipleItemsData }) {
  return (
    <div className="insp-cert-page" style={watermarkStyle}>
      <Letterhead cert={cert} />
      <div className="insp-cert-title-row">
        <h2>Report of Thorough Examination (Multiple Items)</h2>
        <span className="insp-badge">LOOSE GEAR &amp; LIFTING EQUIPMENT</span>
      </div>
      <table className="insp-id-table">
        <tbody>
          <tr>
            <td className="insp-label-cell">Certificate No</td><td colSpan={3}>{cert.certNo}</td>
          </tr>
          <tr>
            <td className="insp-label-cell">Job/PO No.</td><td>{data.jobPoNo || "—"}</td>
            <td className="insp-label-cell">Inspected By</td><td>{data.inspectedBy || "—"}</td>
          </tr>
          <tr>
            <td className="insp-label-cell">Vessel Name</td><td>{cert.vesselName || "—"}</td>
            <td className="insp-label-cell">Colour Code</td><td>{data.colourCode || "—"}</td>
          </tr>
          <tr>
            <td className="insp-label-cell">Location/Port</td><td>{cert.location || "—"}</td>
            <td className="insp-label-cell">Date of Report</td><td>{fmtDate(cert.dateOfServicing)}</td>
          </tr>
          <tr>
            <td className="insp-label-cell">Reason for Inspection</td><td colSpan={3}>{REASON_PRINT_LABELS[data.reasonForInspection] || "—"}</td>
          </tr>
        </tbody>
      </table>

      <table className="insp-print-chk">
        <thead>
          <CertNoTheadRow certNo={cert.certNo} colSpan={10} />
          <tr>
            <th>Serial No.</th><th>Description</th><th>SWL</th><th>Manufacturer</th><th>Result</th>
            <th>Cert No./Test Date</th><th>Location</th><th>Type of Inspection</th><th>Next Inspection</th><th>Safe to Use</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.length === 0 ? (
            <tr><td colSpan={10} style={{ color: "var(--insp-muted)" }}>No items recorded.</td></tr>
          ) : (
            data.rows.map((row, i) => (
              <tr key={i}>
                <td>{row.serialNo || "—"}</td>
                <td>{row.description || "—"}</td>
                <td>{row.swl || "—"}</td>
                <td>{row.manufacturer || "—"}</td>
                <td>{row.result || "—"}</td>
                <td>{row.certNoTestDate || "—"}</td>
                <td>{row.itemLocation || "—"}</td>
                <td>{row.typeOfInspection || "—"}</td>
                <td>{fmtDate(row.nextInspectionDate)}</td>
                <td><span className={`insp-pill ${row.safeToUse === "yes" ? "good" : row.safeToUse === "no" ? "repair" : ""}`}>{yesNoLabel(row.safeToUse)}</span></td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {cert.issuedBy && (
        <div style={{ fontSize: 9, color: "var(--insp-muted)", marginTop: 8 }}>
          Issued by {cert.issuedBy}{cert.issuedAt ? ` — ${new Date(cert.issuedAt).toLocaleString()}` : ""}
        </div>
      )}
      <SignatureFooter cert={cert} masterLabel="Master" techLabel="Inspector" />
    </div>
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
          Luanda, Benfica Rua Bento Raimundo.<br />
          admin@hmzchealthinmarine.com&nbsp;|&nbsp;+244 972 320 300
        </div>
        <CertificateQR
          payload={buildCertQrPayload(cert.certNo)}
          size={54}
        />
      </div>
    </div>
  );
}

// Requested directly: every printed page of a certificate needs a
// signature, not just the first (Statement) page — previously the
// Boat/Davit Checklist and Equipment List pages, and every FFE page
// past the first, carried no signature at all, so a page separated
// from the rest of the certificate couldn't be authenticated on its
// own. One shared component rather than repeating the same markup on
// every page type.
// The signature grid itself prints as plain, one-time, in-flow content
// at the end of the page — deliberately NOT pinned/repeating (requested
// directly: "do not make the signature section part of the header and
// footer... the signature and technician name can move with the page
// as it is now"). ApprovalLogosRow below, by contrast, IS pinned — see
// its own comment for why the two are treated differently.
function SignatureFooter({ cert, masterLabel, techLabel }: { cert: InspectionCertificate; masterLabel: string; techLabel: string }) {
  return (
    <>
      {/* Requested directly: "include this stamp to all certificate...
          this is supposed to be the digital stamp of HMZC" — then,
          asked to make it "look it has been used to stamp over the
          signature of the technician" rather than sit as its own
          separate block. `stamp` on the technician/engineer SignBox
          (never Master's) overlays it there — see SignBox's own
          comment for how. */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 12 }}>
        <SignBox label={masterLabel} name={cert.captainName} sig={cert.captainSig} />
        <SignBox label={techLabel} name={cert.engineerName} sig={cert.engineerSig} stamp />
      </div>
      <ApprovalLogosRow />
    </>
  );
}

// Requested directly: HMZC's classification society / approval body
// logos (ABS, DNV, Bureau Veritas, CRALOG), printed in the footer of
// every certificate. Pinned to the bottom of every physical printed
// page (inspections.css's .insp-approvals-footer print rule) — the
// signature grid above it is deliberately excluded from that pinning
// ("the approval and the line above it should stay as the footer and
// not move based on the page usage"), so this is now the ONLY part of
// SignatureFooter that repeats/stays fixed; it's a small, fixed-height
// block (a divider line, a label, four logos), unlike the signature
// grid which varies with whether a signature is an uploaded image or a
// cursive-font name fallback.
function ApprovalLogosRow() {
  const logos = [
    { src: ABS_LOGO_DATA_URI, alt: "ABS" },
    { src: DNV_LOGO_DATA_URI, alt: "DNV" },
    { src: BUREAU_VERITAS_LOGO_DATA_URI, alt: "Bureau Veritas" },
    { src: CRALOG_LOGO_DATA_URI, alt: "CRALOG" },
  ];
  return (
    <div className="insp-approvals-footer" style={{ borderTop: "1px solid #E4E7E9", marginTop: 16, paddingTop: 8 }}>
      <div style={{ fontSize: 8.5, color: "var(--insp-muted)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 5 }}>Approvals</div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        {logos.map((logo) => (
          <img key={logo.alt} src={logo.src} alt={logo.alt} style={{ height: 24, objectFit: "contain" }} />
        ))}
      </div>
    </div>
  );
}

// Requested directly: the stamp should look like it's actually been
// used to stamp over the technician's signature, not sit as its own
// separate block — `stamp` (only ever passed for the technician/
// engineer box, never Master's) absolutely-positions the transparent
// stamp PNG (see assets/stamp.ts — background keyed out from the
// original scan so the signature underneath still shows through the
// gaps in the ink) over this box, slightly rotated for the imperfect
// hand-stamped look a real one has. `position: relative` on the
// wrapper is what the overlay positions against.
function SignBox({ label, name, sig, stamp }: { label: string; name: string; sig: string; stamp?: boolean }) {
  return (
    <div style={{ borderTop: "1px solid #B9C0C6", paddingTop: 6, position: "relative" }}>
      {sig ? <img src={sig} alt={label} style={{ height: 34 }} /> : <div style={{ fontFamily: "cursive", fontSize: 18, color: "var(--insp-navy)" }}>{name}</div>}
      <div style={{ fontSize: 9.5, color: "var(--insp-muted)", textTransform: "uppercase" }}>{label}</div>
      {stamp && (
        <img
          src={HMZC_STAMP_DATA_URI}
          alt="HMZC Official Stamp"
          style={{
            position: "absolute",
            left: "50%",
            top: -4,
            transform: "translateX(-50%) rotate(-7deg)",
            height: 52,
            width: "auto",
            opacity: 0.9,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}

function ChecklistPage({ title, config, cert, sections, outstandingKey }: any) {
  return (
    <div className="insp-cert-page" style={watermarkStyle}>
      <Letterhead cert={cert} />
      <div className="insp-cert-title-row"><h2>{title}</h2><span className="insp-badge">{config.typeName.toUpperCase()}</span></div>
      <table className="insp-print-chk">
        <thead>
          <CertNoTheadRow certNo={cert.certNo} colSpan={3} />
          <tr><th>Item</th><th>Result</th><th>Remarks</th></tr>
        </thead>
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
      <SignatureFooter cert={cert} masterLabel="Captain Signature" techLabel="Service Engineer" />
    </div>
  );
}
