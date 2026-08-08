import { useRef } from "react";
import type { ReactNode } from "react";
import { EquipmentTypeConfig, InspectionCertificate, ChecklistStatus, EquipResult, CalibrationData, FFEData, LooseGearData, LooseGearMultipleItemsData, LooseGearStandardReportData, LooseGearStatutoryAnswers, LooseGearVisualCertData, LooseGearYesNo } from "../types/inspection.types";
import { getFFEConfig } from "../data/ffeCertTypes";
import { getCalibrationConfig } from "../data/calibrationCertTypes";
import { ABS_LOGO_DATA_URI, BUREAU_VERITAS_LOGO_DATA_URI, CRALOG_LOGO_DATA_URI, DNV_LOGO_DATA_URI } from "../assets/approvalLogos";
import CertificateQR, { buildCertQrPayload } from "./CertificateQR";
import { useFillToPageMultiple } from "../../../hooks/useFillToPageMultiple";
// Side-effect only — sets --insp-watermark-url/--insp-stamp-url once
// on the root element. See cssVars.ts's own comment for why the logo/
// stamp are referenced via these CSS variables (a single background-
// image) rather than each certificate section carrying its own <img>
// copy of either.
import "../assets/cssVars";

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

  if (config.kind === "photoreport") {
    return <PhotoReportCertificatePage cert={cert} config={config} />;
  }

  const isBoat = config.kind === "boat";

  return (
    <>
      <CertPageFrame cert={cert}>
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
            instead of the shared SignatureGrid every other
            certificate type uses. Certificate No. and Date of
            Servicing moved into the ID table above (matching
            FFECertificatePage's own convention), "Issued by" moved to
            this small line right before the signatures (matching
            FFECertificatePage/MultipleItemsPage's own convention too),
            and the signature area itself is now the same shared
            2-column SignatureGrid as everywhere else. */}
        {cert.issuedBy && (
          <div style={{ fontSize: 10, color: "var(--insp-muted)", marginTop: 8 }}>
            Issued by {cert.issuedBy}{cert.issuedAt ? ` — ${new Date(cert.issuedAt).toLocaleString()}` : ""}
          </div>
        )}
        <SignatureGrid cert={cert} masterLabel="Captain Signature" techLabel="Service Engineer" />
      </CertPageFrame>

      {isBoat && cert.boatChecklist && (
        <ChecklistPage title={config.boatTitle || "Checklist"} config={config} cert={cert} sections={cert.boatChecklist} outstandingKey="boatChecklist" />
      )}
      {isBoat && cert.davitChecklist && (
        <ChecklistPage title={config.davitTitle || "Davit Checklist"} config={config} cert={cert} sections={cert.davitChecklist} outstandingKey="davitChecklist" />
      )}
      {isBoat && cert.equip && (
        <CertPageFrame cert={cert}>
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
          <SignatureGrid cert={cert} masterLabel="Captain Signature" techLabel="Service Engineer" />
        </CertPageFrame>
      )}
      {!isBoat && cert.checklist && (
        <ChecklistPage title={config.checklistTitle || "Inspection Checklist"} config={config} cert={cert} sections={cert.checklist} outstandingKey="checklist" />
      )}
      <PhotoReportPage cert={cert} />
    </>
  );
}

function checklistResultLabel(r: string) {
  return { done: "Carried Out", not_done: "Not Carried Out", na: "N/A", "": "—" }[r] || r;
}

// The combined FFE/Calibration vessel Photo Report — see
// inspectionChecklists.ts's photo_report entry and
// PhotoReportForm.tsx's own comment for why this is its own
// certificate type rather than an appendix to one FFE/Calibration
// sub-type certificate. No checklist/item register at all: just the
// same vessel/certificate identity table every other type has, then
// PhotoReportPage IS the certificate's real content here (rather than
// an appendix at the end of a longer certificate), followed by
// sign-off.
function PhotoReportCertificatePage({ cert, config }: { cert: InspectionCertificate; config: EquipmentTypeConfig }) {
  return (
    <>
      <CertPageFrame cert={cert}>
        <div className="insp-cert-title-row">
          <h2>Photo Report</h2>
          <span className="insp-badge">{config.typeName.toUpperCase()}</span>
        </div>
        <p style={{ fontSize: 11.5, lineHeight: 1.6 }}>{config.statementIntro}</p>
        <table className="insp-id-table">
          <tbody>
            <tr>
              <td className="insp-label-cell">Certificate No</td><td>{cert.certNo}</td>
              <td className="insp-label-cell">Date</td><td>{fmtDate(cert.dateOfServicing)}</td>
            </tr>
            <tr>
              <td className="insp-label-cell">Name of Ship</td><td>{cert.vesselName || "—"}</td>
              <td className="insp-label-cell">IMO No.</td><td>{cert.imoNo || "—"}</td>
            </tr>
          </tbody>
        </table>
        <div className="insp-remarks-box">Comments: {cert.remarks || "None"}</div>
        {cert.issuedBy && (
          <div style={{ fontSize: 10, color: "var(--insp-muted)", marginTop: 8 }}>
            Issued by {cert.issuedBy}{cert.issuedAt ? ` — ${new Date(cert.issuedAt).toLocaleString()}` : ""}
          </div>
        )}
        <SignatureGrid cert={cert} masterLabel="Captain Signature" techLabel="Service Engineer" />
      </CertPageFrame>
      <PhotoReportPage cert={cert} />
    </>
  );
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
// its own letterhead and its own SignatureGrid/ApprovalLogosRow.
// Requested directly: a certificate should be ONE page by default, and
// only spill onto additional pages when there's actually enough content
// (a long item register, a big checklist) to need it — not force
// separate pages for "info", "items", "checklist" etc. as fixed
// sections regardless of how short each one is, which is what the
// previous <FFEPage>-per-section version did (a Fire Blanket cert with
// two rows and no checklist still printed 3 forced pages).
//
// One .insp-cert-page div now holds every section, with ONE Letterhead
// at the top and ONE SignatureGrid at the true end — natural browser
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
    <CertPageFrame cert={cert}>
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

      <SignatureGrid cert={cert} masterLabel="Master" techLabel="Technician" />
    </CertPageFrame>
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
    <CertPageFrame cert={cert}>
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

      <SignatureGrid cert={cert} masterLabel="Master" techLabel="Checked/Approved By" />
    </CertPageFrame>
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

// Requested directly: "the lose gear report appears to be two pages,
// make it one, and create a section inside the report where we can
// put a picture of the item inspected, instead of the photo report
// section imbed the photo inside the report for the lose gear, just
// one photo." The separate PhotoReportPage (a whole extra physical
// page whenever any photo existed at all) is what pushed this to two
// pages — removed for Loose Gear specifically (see the three page
// components below) and replaced with a single photo shown inline, in
// the flow of the report itself, right after the item's own identity
// details. "Just one" is enforced where the photo is actually
// attached — see PhotoUpload's maxPhotos prop, wired to 1 in
// LooseGearForm.tsx — so there's never more than the first entry here
// to show.
// Requested directly, after measuring the real print output: "reduce
// size of the photo in lose gears and make the report one page
// report." Measured directly in the browser via
// useFillToPageMultiple's own natural-content-height check: this
// report's content already ran ~55px over one page's budget with NO
// photo at all (the statutory declaration alone is long), and a
// realistic phone photo at the old maxWidth/maxHeight (220x150) added
// another ~180px on top of that — ~236px over budget in total. Fixed
// width/height with object-fit: cover (70x50, versus a photo that
// could render up to 150px tall before) plus the label sitting beside
// it instead of on its own line above closes most of that gap — the
// single biggest lever available without touching the shared
// .insp-id-table/.insp-remarks-box styling every other certificate
// type also relies on.
//
// Requested directly: "remove the photo from the multiple items
// report." Only rendered from VisualCertPage/StandardReportPage now —
// Multiple Items covers a register of several different items, not
// one single item being inspected, so "photo of item inspected"
// (singular) never quite made sense there the way it does for the
// other two templates.
function LooseGearItemPhoto({ cert }: { cert: InspectionCertificate }) {
  const photo = cert.photos?.looseGear?.[0];
  if (!photo) return null;
  return (
    <div style={{ margin: "4px 0", display: "flex", alignItems: "center", gap: 8 }}>
      <img
        src={photo.data}
        alt="Item inspected"
        style={{ width: 70, height: 50, objectFit: "cover", border: "1px solid #C9D1D8", borderRadius: 4, flexShrink: 0 }}
      />
      <div>
        <div style={{ fontWeight: 700, fontSize: 10, color: "var(--insp-navy)" }}>Photo of Item Inspected</div>
        {photo.caption && <div style={{ fontSize: 9, color: "var(--insp-muted)", marginTop: 1 }}>{photo.caption}</div>}
      </div>
    </div>
  );
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
    <CertPageFrame cert={cert}>
      <div className="lg-compact">
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
      <LooseGearItemPhoto cert={cert} />

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
      <SignatureGrid cert={cert} masterLabel="Master" techLabel="Inspector" />
      </div>
    </CertPageFrame>
  );
}

function StandardReportPage({ cert, data }: { cert: InspectionCertificate; data: LooseGearStandardReportData }) {
  return (
    <CertPageFrame cert={cert}>
      <div className="lg-compact">
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
      <LooseGearItemPhoto cert={cert} />

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
      <SignatureGrid cert={cert} masterLabel="Master" techLabel="Inspector" />
      </div>
    </CertPageFrame>
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
    <CertPageFrame cert={cert}>
      <div className="lg-compact">
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
      <SignatureGrid cert={cert} masterLabel="Master" techLabel="Inspector" />
      </div>
    </CertPageFrame>
  );
}

// Requested directly: "do the pagination engine (paged.js), to solve
// the issue once and for all." Attempted — genuine CSS Paged Media
// running headers/footers via Paged.js (see the now-removed
// PagedPreview.tsx) — but reverted: instrumented directly, Paged.js's
// own pagination call never resolved even for a deliberately tiny
// (156KB) document, well past any reasonable timeout, consistently
// reproducible in this app's actual runtime. A hung, frozen
// certificate preview is a worse outcome than the bug it was meant to
// fix, so this reverts to the previous working mechanism: wrapping a
// certificate page's entire content in one real <table>, with the
// letterhead as its <thead> and ApprovalLogosRow as its <tfoot> —
// <thead>/<tfoot> repeating on every physical page a table spans is a
// reliable, native browser behavior (the same mechanism
// CertNoTheadRow relies on), unlike position: fixed, which proved
// unreliable earlier in the same investigation. The signature grid is
// NOT inside the <tfoot> — it's ordinary <tbody> content, so it still
// prints exactly once, wherever it naturally falls ("do not make the
// signature section part of the header and footer").
function CertPageFrame({ cert, children }: { cert: InspectionCertificate; children: ReactNode }) {
  const theadRef = useRef<HTMLTableSectionElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const tfootRef = useRef<HTMLTableSectionElement>(null);
  // Requested directly: "the FFE page when you create a page and it
  // breaks and it half filled page should have the header and footer
  // in the same position as the one which is full." See
  // useFillToPageMultiple's own comment for the full reasoning — a
  // fixed min-height only padded a section up to ONE page; this pads
  // to whatever whole multiple of a page the section's real content
  // actually needs, so FFE's own item-table pagination (or any other
  // section long enough to span multiple physical pages on its own)
  // gets its trailing, partially-filled page pushed down to match
  // every other page's footer position, not just the very last one.
  useFillToPageMultiple(fillRef, theadRef, tfootRef);
  return (
    <div className="insp-cert-page">
      <table className="insp-page-frame">
        <thead ref={theadRef}><tr><td><Letterhead cert={cert} /></td></tr></thead>
        {/* min-height on a <td> itself is unreliable — measured on a
            real page, the browser didn't stretch it — but the exact
            same min-height on a plain <div> inside that <td> does. See
            inspections.css's own comment on .insp-page-tbody-fill for
            the full reasoning (short content now pads out to a full
            page instead of leaving the footer stranded partway down). */}
        <tbody><tr><td><div ref={fillRef} className="insp-page-tbody-fill">{children}</div></td></tr></tbody>
        <tfoot ref={tfootRef}><tr><td><ApprovalLogosRow /></td></tr></tfoot>
      </table>
    </div>
  );
}

function Letterhead({ cert }: { cert: InspectionCertificate }) {
  return (
    <div className="insp-letterhead">
      {/* Requested directly, reviewing why Paged.js pagination on a
          multi-section certificate was blocking the browser for tens
          of seconds: this used to be <img src={HMZC_LOGO_DATA_URI}>,
          which carried a full copy of the logo's base64 data in every
          section's own markup (Letterhead renders once per
          CertPageFrame). See cssVars.ts for why a background-image
          referencing the shared --insp-watermark-url variable
          (already set once, globally) replaces that. */}
      <div role="img" aria-label="HMZC LTD" className="insp-letterhead-logo" />
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
// Plain, one-time, in-flow content wherever it's placed in a
// CertPageFrame's children — deliberately NOT part of the repeating
// <thead>/<tfoot> ("do not make the signature section part of the
// header and footer... the signature and technician name can move
// with the page as it is now"). ApprovalLogosRow (rendered separately,
// in CertPageFrame's own <tfoot>) is what repeats.
function SignatureGrid({ cert, masterLabel, techLabel }: { cert: InspectionCertificate; masterLabel: string; techLabel: string }) {
  return (
    // Requested directly: "include this stamp to all certificate...
    // this is supposed to be the digital stamp of HMZC" — then, asked
    // to make it "look it has been used to stamp over the signature of
    // the technician" rather than sit as its own separate block.
    // `stamp` on the technician/engineer SignBox (never Master's)
    // overlays it there — see SignBox's own comment for how.
    //
    // Requested directly, reviewing a real printed PDF: "when the
    // service engineer sign or name holder drops, it should come
    // along with the Master so they stay in the same line, as it
    // stands the service engineer is above the Master section." On
    // screen this was already a single row (confirmed directly:
    // getBoundingClientRect showed identical top for both boxes) — the
    // drop only happens in print, where Chrome's CSS Grid fragments
    // each grid item independently across a page break instead of
    // keeping a row together, the same unreliable-in-print behavior
    // position: fixed had earlier in this file (see CertPageFrame's
    // own comment). A <table> row doesn't have that problem — a <tr>
    // either fits whole on the current page or the whole row moves to
    // the next one, which is exactly why the letterhead/footer above
    // and every data table in this file already use a table for
    // anything that has to survive pagination intact.
    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12, breakInside: "avoid", pageBreakInside: "avoid" } as any}>
      <tbody>
        <tr style={{ breakInside: "avoid", pageBreakInside: "avoid" } as any}>
          <td style={{ width: "50%", verticalAlign: "top", paddingRight: 7 }}>
            <SignBox label={masterLabel} name={cert.captainName} sig={cert.captainSig} />
          </td>
          <td style={{ width: "50%", verticalAlign: "top", paddingLeft: 7 }}>
            <SignBox label={techLabel} name={cert.engineerName} sig={cert.engineerSig} stamp />
          </td>
        </tr>
      </tbody>
    </table>
  );
}

// Requested directly: HMZC's classification society / approval body
// logos (ABS, DNV, Bureau Veritas, CRALOG). Rendered inside every
// CertPageFrame's <tfoot> — see that component's own comment for why a
// real table footer, not position: fixed, is what makes this actually
// repeat on every physical printed page.
function ApprovalLogosRow() {
  const logos = [
    { src: ABS_LOGO_DATA_URI, alt: "ABS" },
    { src: DNV_LOGO_DATA_URI, alt: "DNV" },
    { src: BUREAU_VERITAS_LOGO_DATA_URI, alt: "Bureau Veritas" },
    { src: CRALOG_LOGO_DATA_URI, alt: "CRALOG" },
  ];
  return (
    <div style={{ borderTop: "1px solid #E4E7E9", marginTop: 16, paddingTop: 8 }}>
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
    // Requested directly, reviewing the technician box with the stamp
    // applied: "put the master or the technician name on the line
    // above the stamp or remove that line." Measured directly in the
    // browser: the stamp's own rotated bounding box (rotate(-7deg))
    // extends from ~13px above this box's top down to ~58px into it —
    // well past where the old borderTop divider sat (right at the very
    // top, y:0) — so that divider line was being visually crossed/cut
    // by the stamp graphic rather than sitting cleanly above it. Removed
    // rather than relocating the printed name (the other option) since
    // the name was only just fixed to appear at all here, and the
    // SignatureGrid's own gap (14px) plus marginTop (12px) already
    // separate this block from the content above without it.
    <div style={{ paddingTop: 6, position: "relative" }}>
      {/* Requested directly: "technician name is still not appearing
          on the pdf." It never printed whenever a signature image
          existed — sig replaced name entirely rather than
          supplementing it, so a certificate with a real drawn
          signature (the normal case) never showed the typed name at
          all, only the (often hard-to-read) signature scribble. Real
          paper certificates print BOTH — a signature line with the
          signer's printed name underneath it for legibility — so this
          now does the same: the image if one exists, the typed name
          underneath it either way (not just as a same-slot fallback
          when there's no image). Enlarged from 34px to 44px and the
          canvas stroke drawn bolder (SignatureCanvas.tsx) — requested
          directly: "the signature also appear too small ... bolder or
          enlarging it." */}
      {/* Requested directly, looking at a real printed PDF where the
          Master hadn't signed yet: "I want the master signature to
          drop to same line as service engineer so that when printed
          and sign after issuance by the service engineer, the master
          signature can be same as the service engineer." The Master
          normally has no digital signature at all — they sign the
          printed PAPER by hand after issuance — so with nothing
          rendered above it, "CAPTAIN SIGNATURE" sat right at the top
          of its cell, while "SERVICE ENGINEER" sat ~58px lower, below
          the technician's image+name. Both boxes were already in the
          same table row (see SignatureGrid), but the LABELS inside
          each cell landed at different heights because a blank
          signature reserved no space at all. This wrapper reserves
          the same height (44px image + the printed name's own line —
          64px measured directly in the browser) whether or not
          there's actually a signature yet, so the label — and the
          blank space above it where the Master will physically sign —
          lines up with the Technician's regardless of which box is
          filled in. */}
      <div style={{ minHeight: 64 }}>
        {sig && <img src={sig} alt={label} style={{ height: 44 }} />}
        {!sig && name && <div style={{ fontFamily: "cursive", fontSize: 20, color: "var(--insp-navy)" }}>{name}</div>}
        {sig && name && <div style={{ fontSize: 10, color: "var(--insp-text)", marginTop: 2 }}>{name}</div>}
      </div>
      <div style={{ fontSize: 9.5, color: "var(--insp-muted)", textTransform: "uppercase" }}>{label}</div>
      {/* Requested directly, reviewing why Paged.js pagination on a
          multi-section certificate was blocking the browser for tens
          of seconds: this used to be <img src={HMZC_STAMP_DATA_URI}>,
          which carried a full copy of the stamp's base64 data in
          every section's own markup (SignBox renders once per
          SignatureGrid, once per CertPageFrame section). See
          cssVars.ts for why a background-image referencing the
          shared --insp-stamp-url variable (already set once,
          globally) replaces that — width is explicit rather than
          "auto" since a background-image has no intrinsic size to
          derive one from the way an <img> does; 164x52 preserves the
          source PNG's own 327:104 aspect ratio at this height. */}
      {stamp && (
        <div
          role="img"
          aria-label="HMZC Official Stamp"
          style={{
            position: "absolute",
            left: "50%",
            top: -4,
            transform: "translateX(-50%) rotate(-7deg)",
            height: 52,
            width: 164,
            backgroundImage: "var(--insp-stamp-url)",
            backgroundSize: "contain",
            backgroundRepeat: "no-repeat",
            // Requested directly: "the stamp is not showing." Chrome
            // suppresses background-image in print output by default
            // unless the user has "Background graphics" checked in
            // the print dialog — see inspections.css's own comment on
            // .insp-cert-page::before for the full reasoning.
            printColorAdjust: "exact",
            WebkitPrintColorAdjust: "exact",
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
    <CertPageFrame cert={cert}>
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
      {/* Requested directly: "the uploaded photos should be used as
          photo report attached to the final page all on one page" —
          the small per-section thumbnails that used to print right
          here were removed; every photo from every section now prints
          once, consolidated with its caption, on PhotoReportPage at
          the very end of the certificate (see the default export's
          own use of it). */}
      <div className="insp-remarks-box" style={{ borderColor: "var(--insp-red)", background: "#FBEEEC", color: "#7A241B" }}>
        Outstanding Issues / Defects Raised: {(cert.outstanding && cert.outstanding[outstandingKey]) || "None"}
      </div>
      <SignatureGrid cert={cert} masterLabel="Captain Signature" techLabel="Service Engineer" />
    </CertPageFrame>
  );
}

// Human-readable section names for the keys cert.photos is keyed by
// (boatChecklist/davitChecklist/checklist — see InspectionWorkspace.tsx's
// OutstandingAndPhotos, the only place that ever writes to cert.photos).
// Falls back to the raw key for anything not listed, so a future
// section doesn't silently print a blank label.
const PHOTO_SECTION_LABELS: Record<string, string> = {
  boatChecklist: "Boat Checklist",
  davitChecklist: "Davit Checklist",
  checklist: "Inspection Checklist",
  looseGear: "Loose Gear Inspection",
  general: "Photo Report",
};

function chunk2<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += 2) out.push(items.slice(i, i + 2));
  return out;
}

// Requested directly: "the uploaded photos should be used as photo
// report attached to the final page all on one page, and should have
// description." Every photo used to print as a tiny 64x64 thumbnail
// right on its own checklist page (see ChecklistPage's own comment on
// why that was removed) — scattered across whichever pages happened
// to have photos, with no caption at all. This instead walks every
// section's photos[] (each now a { data, caption } — see
// PhotoEvidence in inspection.types.ts) into one flat list and prints
// them all together on a single dedicated page at the very end of the
// certificate, captioned and labelled with which section they came
// from.
//
// A <table> of 2-per-row image+caption cells, not a CSS grid — the
// same reliability reason SignatureGrid uses a table (see its own
// comment): a grid's rows aren't guaranteed to stay together when
// Chrome paginates print output across physical pages, a <tr> is.
// "All on one page" is meant the same way every other section in this
// file is — natural browser pagination decides where it actually
// needs to spill onto an additional physical page (see
// FFECertificatePage's own comment on this convention) rather than
// this trying to force a hard page-count cap; a certificate with only
// a handful of photos will, in practice, fit on the one page.
function PhotoReportPage({ cert }: { cert: InspectionCertificate }) {
  const entries = Object.entries(cert.photos || {}).flatMap(([key, photos]) =>
    (photos || []).map((photo, index) => ({ key, photo, index }))
  );
  if (entries.length === 0) return null;

  return (
    <CertPageFrame cert={cert}>
      <div className="insp-cert-title-row">
        <h2>Photo Report</h2>
        <span className="insp-badge">EVIDENCE</span>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {chunk2(entries).map((pair, ri) => (
            <tr key={ri} style={{ breakInside: "avoid", pageBreakInside: "avoid" } as any}>
              {pair.map(({ key, photo, index }) => (
                <td key={index} style={{ width: "50%", verticalAlign: "top", padding: 6 }}>
                  <img
                    src={photo.data}
                    alt={photo.caption || `Evidence ${index + 1}`}
                    style={{ width: "100%", height: 190, objectFit: "cover", borderRadius: 5, border: "1px solid #C9D1D8", display: "block" }}
                  />
                  <div style={{ fontSize: 9, color: "var(--insp-muted)", textTransform: "uppercase", marginTop: 4 }}>
                    {PHOTO_SECTION_LABELS[key] || key}
                  </div>
                  <div style={{ fontSize: 11, marginTop: 2 }}>{photo.caption || "No description provided."}</div>
                </td>
              ))}
              {pair.length === 1 && <td style={{ width: "50%" }} />}
            </tr>
          ))}
        </tbody>
      </table>
    </CertPageFrame>
  );
}
