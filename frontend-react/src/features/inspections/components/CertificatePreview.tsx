import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { EquipmentTypeConfig, InspectionCertificate, ChecklistStatus, EquipResult, CalibrationData, FFEData, LooseGearData, LooseGearMultipleItemsData, LooseGearStandardReportData, LooseGearStatutoryAnswers, LooseGearVisualCertData, LooseGearYesNo, NDTCommonData, NDTFooterData, MPIData, PTData, RTData, UTData, VTData, ETData, LoadTestData, PhotoEvidence } from "../types/inspection.types";
import { getFFEConfig, getEffectiveFFELabel, getEffectiveFFENote } from "../data/ffeCertTypes";
import { getCalibrationConfig } from "../data/calibrationCertTypes";
import { LOOSE_GEAR_STATUS_CODES, normalizedSerialNos } from "../data/inspectionHelpers";
import { ABS_LOGO_DATA_URI, BUREAU_VERITAS_LOGO_DATA_URI, CRALOG_LOGO_DATA_URI, DNV_LOGO_DATA_URI } from "../assets/approvalLogos";
import { APP_BUILD_VERSION } from "../data/appVersion";
import CertificateQR, { buildCertQrPayload } from "./CertificateQR";
import { useFillToPageMultiple, PAGE_HEIGHT_PX } from "../../../hooks/useFillToPageMultiple";
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
      <ExplanatoryNotesPage cert={cert} config={config} />
      <PhotoReportPage cert={cert} />
    </>
  );
}

// Requested directly, reviewing a real CRALOG-issued certificate for
// comparison: theirs closes with an "Explanatory remarks" page defining
// exactly what each result column means, plus the regulatory basis —
// reads as a more complete, defensible document than ours, which never
// explained its own Good/Part-Ex/Repair/N.A. vocabulary anywhere.
// Deliberately NOT a point-by-point mapping of every checklist item to
// a specific SOLAS/MSC.402(96) sub-paragraph the way CRALOG's is —
// their document is written against their own checklist's exact
// wording and numbering, which isn't the same as this app's (built
// independently, referencing a different source form). Citing specific
// paragraph numbers per item without verifying each one against this
// checklist's actual wording would risk putting a wrong regulatory
// citation on a real safety certificate, so this stays a general
// glossary + the same regulatory basis the statement itself already
// cites, not a fabricated per-item mapping. Scoped to boat/crane types
// only for now (the ones that use this exact 4-way vocabulary) — FFE's
// checklist uses a different, simpler 3-way one (see checklistResultLabel).
function ExplanatoryNotesPage({ cert, config }: { cert: InspectionCertificate; config: EquipmentTypeConfig }) {
  return (
    <CertPageFrame cert={cert}>
      <div className="insp-cert-title-row">
        <h2>Explanatory Notes</h2>
        <span className="insp-badge">{config.typeName.toUpperCase()}</span>
      </div>
      <p style={{ fontSize: 11.5, lineHeight: 1.6 }}>{config.statementIntro}</p>
      <div style={{ fontWeight: 700, fontSize: 11.5, color: "var(--insp-navy)", margin: "10px 0 4px" }}>Checklist Result Key</div>
      <table className="insp-id-table">
        <tbody>
          <tr><td className="insp-label-cell" style={{ width: "20%" }}>Good</td><td>Item inspected and found in satisfactory condition — no action required.</td></tr>
          <tr><td className="insp-label-cell">Part-Ex</td><td>Partially exceptions taken — item is usable but has a noted defect or wear that should be monitored or addressed at the next opportunity.</td></tr>
          <tr><td className="insp-label-cell">Repair</td><td>Item requires repair, adjustment, or replacement before it can be considered satisfactory.</td></tr>
          <tr><td className="insp-label-cell">N/A</td><td>Not applicable to this particular installation or configuration.</td></tr>
        </tbody>
      </table>
      <div style={{ fontSize: 10, color: "var(--insp-muted)", marginTop: 10 }}>
        This inspection was carried out in accordance with the regulatory basis stated in this certificate's Statement page. Individual
        checklist item results and any remarks recorded above reflect the condition found at the time of this inspection.
      </div>
    </CertPageFrame>
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
  // Root-caused from a real report: "photos loaded to the FFE photo
  // report goes to the second page not the first page." This
  // certificate type's vessel-info block above is nearly empty (a
  // 2-row ID table, a comments box, a signature grid) — plenty of
  // room left on page 1 — but the photos used to render via a
  // separate PhotoReportPage, which wraps in its own CertPageFrame
  // and therefore always started a fresh physical page, even for a
  // single uploaded photo. Rendering PhotoGrid directly inside this
  // same CertPageFrame instead lets natural browser pagination decide
  // whether photos need their own page, the same convention every
  // other section in this file already follows.
  const entries = Object.entries(cert.photos || {}).flatMap(([key, photos]) =>
    (photos || []).map((photo, index) => ({ key, photo, index }))
  );
  return (
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
      {entries.length > 0 && <PhotoGrid entries={entries} showHeading={false} />}
      {/* Requested directly: "move the Comment on photo report below
          after the photos" — was rendered right after the vessel-info
          table, above the photos; moved to sit with the sign-off
          instead, after everything the comment might actually be
          describing. */}
      <div className="insp-remarks-box">Comments: {cert.remarks || "None"}</div>
      {cert.issuedBy && (
        <div style={{ fontSize: 10, color: "var(--insp-muted)", marginTop: 8 }}>
          Issued by {cert.issuedBy}{cert.issuedAt ? ` — ${new Date(cert.issuedAt).toLocaleString()}` : ""}
        </div>
      )}
      <SignatureGrid cert={cert} masterLabel="Captain Signature" techLabel="Service Engineer" hideFitForPurpose />
    </CertPageFrame>
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
// reliably prints the same number of rows per page rather than some
// other split. Deliberately scoped to just this table — the boat/crane
// checklists, Equipment List, and Loose Gear's Multiple Items register
// were tried with the same forced break but reverted back to natural
// pagination on request.
//
// Root-caused from a real printed PDF ("dragon portable" — a 57-row
// extinguisher register): a flat 25 was tuned once, a while back,
// against whatever row content was on hand at the time. This table's
// actual rows are short single-line entries, so 25 of them only fill
// roughly a third of a physical page — the forced break was firing
// three times too often, leaving most of pages 2 and 3 blank. Rather
// than re-guess a new flat number that'll just be wrong for the next
// certificate with longer (wrapping) remarks, DEFAULT_ROWS_PER_PAGE is
// now only the first-paint guess; useRowsPerPage below measures the
// real rendered height of a row and the thead against PAGE_HEIGHT_PX
// (the same physical page height useFillToPageMultiple already targets)
// and corrects it to however many rows actually fit — self-adjusting
// per certificate sub-type instead of a single magic number everyone
// has to share.
const DEFAULT_ROWS_PER_PAGE = 25;
const PAGINATED_TABLE_SAFETY_MARGIN_PX = 24;

function chunkRows<T>(rows: T[], perPage: number): T[][] {
  if (rows.length === 0) return [[]];
  const size = Math.max(1, perPage);
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
}

// Measures the first chunk's actual rendered thead height and average
// row height, then computes how many rows of THIS table's real content
// fit in one physical page. Runs after every render (no dependency
// array) but only calls setRowsPerPage when the measured value actually
// changes, so it settles after one correction: default (25) renders →
// measures the real row height from that render → corrects to the real
// capacity → re-renders with the new chunk size → measures again, same
// answer → stops. A table with only one chunk (nothing to correct,
// since there's no forced break to place) skips measuring entirely.
function useRowsPerPage(theadRef: RefObject<HTMLElement>, tbodyRef: RefObject<HTMLElement>, chunkCount: number) {
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE);
  useLayoutEffect(() => {
    if (chunkCount <= 1) return;
    const thead = theadRef.current;
    const tbody = tbodyRef.current;
    if (!thead || !tbody) return;
    const rowCount = tbody.children.length;
    if (rowCount === 0) return;
    const avgRowHeight = tbody.scrollHeight / rowCount;
    if (avgRowHeight <= 0) return;
    const available = PAGE_HEIGHT_PX - thead.offsetHeight - PAGINATED_TABLE_SAFETY_MARGIN_PX;
    if (available <= 0) return;
    const measured = Math.max(1, Math.floor(available / avgRowHeight));
    if (measured !== rowsPerPage) setRowsPerPage(measured);
  });
  return rowsPerPage;
}

// Used by FFEItemsTable (FFE + Calibration item tables) — each chunk of
// rowsPerPage rows renders as its own <table> with its own repeating
// <CertNoTheadRow>/column headers (same native-thead-repeats-per-page
// mechanism CertNoTheadRow already relies on), and break-before: page
// forces every chunk after the first onto a fresh physical page.
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
  // Chunked against the default first, then re-chunked once the real
  // row height is known — see useRowsPerPage above.
  const provisionalChunkCount = chunkRows(rows, DEFAULT_ROWS_PER_PAGE).length;
  const theadRef = useRef<HTMLTableSectionElement | null>(null);
  const tbodyRef = useRef<HTMLTableSectionElement | null>(null);
  const rowsPerPage = useRowsPerPage(theadRef, tbodyRef, provisionalChunkCount);
  const chunks = chunkRows(rows, rowsPerPage);
  // Root-caused from a real report: "the pages are not continues as it
  // left a chunk of space to start next on page 3 to 4." Only chunk 1+
  // forced a fresh page — chunk 0 didn't, so whenever something else
  // (a checklist rendered above this table via itemsAfterChecklist, a
  // technical-description block, another item table) already used up
  // part of the current page, chunk 0's own rowsPerPage rows no longer
  // reliably fit in what was left of that page — its last few rows
  // spilled onto a mostly-empty continuation page, and chunk 1's own
  // forced break then stranded that emptiness permanently, since it
  // jumps to a fresh page regardless of how little of the current one
  // is used. Forcing chunk 0 onto a fresh page too, whenever the table
  // is big enough to need more than one chunk in the first place,
  // means every chunk always gets a full page to grow into — the same
  // reliable, predictable per-page guarantee chunk 1+ already had, now
  // applied uniformly instead of only to the chunks after the first. A
  // table that fits in one chunk is completely unaffected — it still
  // flows inline exactly as before.
  return (
    <>
      {chunks.map((chunk, ci) => (
        <div key={ci} style={(ci > 0 || chunks.length > 1) ? ({ breakBefore: "page" } as any) : undefined}>
          {title && (
            <div style={{ fontWeight: 700, fontSize: 11.5, color: "var(--insp-navy)", margin: "10px 0 4px" }}>
              {title}{chunks.length > 1 ? ` (continued — page ${ci + 1} of ${chunks.length})` : ""}
            </div>
          )}
          <table className="insp-print-chk">
            <thead ref={ci === 0 ? theadRef : undefined}>
              <CertNoTheadRow certNo={certNo} colSpan={colSpan} />
              {columnHeaders}
            </thead>
            <tbody ref={ci === 0 ? tbodyRef : undefined}>
              {chunk.length === 0 ? (
                <tr><td colSpan={colSpan} style={{ color: "var(--insp-muted)" }}>{emptyMessage || "No rows recorded."}</td></tr>
              ) : (
                chunk.map((row, i) => renderRow(row, i, ci * rowsPerPage + i))
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
        <span className="insp-badge">{getEffectiveFFELabel(cfg, ffe).toUpperCase()}</span>
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

      {getEffectiveFFENote(cfg, ffe) && <div style={{ fontSize: 10, color: "var(--insp-muted)", marginTop: 3 }}>{getEffectiveFFENote(cfg, ffe)}</div>}

      {!cfg.itemsAfterChecklist && (
        <>
          {!!cfg.itemColumns?.length && (
            <FFEItemsTable title={cfg.itemTableLabel || "Items"} columns={cfg.itemColumns} rows={ffe.items} certNo={cert.certNo} />
          )}
          {!!cfg.items2Columns?.length && (
            <FFEItemsTable title={cfg.items2Label || "Items"} columns={cfg.items2Columns} rows={ffe.items2} certNo={cert.certNo} />
          )}
        </>
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

      {/* Requested directly: "move the cylinder details below the
          description of inspection for CO2, novec, wet chemical" —
          see ffeCertTypes.ts's itemsAfterChecklist. */}
      {!!cfg.itemsAfterChecklist && (
        <>
          {!!cfg.itemColumns?.length && (
            <FFEItemsTable title={cfg.itemTableLabel || "Items"} columns={cfg.itemColumns} rows={ffe.items} certNo={cert.certNo} />
          )}
          {!!cfg.items2Columns?.length && (
            <FFEItemsTable title={cfg.items2Label || "Items"} columns={cfg.items2Columns} rows={ffe.items2} certNo={cert.certNo} />
          )}
        </>
      )}

      {!!cfg.readingsRows?.length && (
        <>
          <div style={{ fontWeight: 700, fontSize: 11.5, color: "var(--insp-navy)", margin: "10px 0 4px" }}>Readings</div>
          <table className="insp-print-chk">
            <thead>
              <CertNoTheadRow certNo={cert.certNo} colSpan={4} />
              <tr><th>Type of Vapor/Gas</th><th>Measured Value</th><th>Maximum Allowed</th><th>Remarks</th></tr>
            </thead>
            <tbody>
              {cfg.readingsRows.map((r) => (
                <tr key={r.key}>
                  <td>{r.label}</td>
                  <td>{ffe.technicalValues[`reading_${r.key}`] || "—"}</td>
                  <td>{r.maxAllowed}</td>
                  <td>{ffe.technicalValues[`remarks_${r.key}`] || "—"}</td>
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

      <SignatureGrid cert={cert} masterLabel="Master" techLabel="Technician" hideFitForPurpose />
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

      <SignatureGrid cert={cert} masterLabel="Master" techLabel="Checked/Approved By" hideFitForPurpose />
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
  if (looseGear.subType === "mpi" && looseGear.mpi) return <MPIPage cert={cert} data={looseGear.mpi} />;
  if (looseGear.subType === "pt" && looseGear.pt) return <PTPage cert={cert} data={looseGear.pt} />;
  if (looseGear.subType === "rt" && looseGear.rt) return <RTPage cert={cert} data={looseGear.rt} />;
  if (looseGear.subType === "ut" && looseGear.ut) return <UTPage cert={cert} data={looseGear.ut} />;
  if (looseGear.subType === "vt" && looseGear.vt) return <VTPage cert={cert} data={looseGear.vt} />;
  if (looseGear.subType === "et" && looseGear.et) return <ETPage cert={cert} data={looseGear.et} />;
  if (looseGear.subType === "load_test" && looseGear.loadTest) return <LoadTestPage cert={cert} data={looseGear.loadTest} />;
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
      <SignatureGrid cert={cert} masterLabel="Master" techLabel="Inspector" hideFitForPurpose />
      </div>
    </CertPageFrame>
  );
}

const EXAMINATION_TYPE_PRINT_LABELS: Record<string, string> = {
  initial: "Initial",
  standard: "Standard",
  under_scheme: "Under A Scheme",
  exceptional: "After Exceptional Circumstances",
  "": "—",
};

// Requested directly: "change the thorough examination report to this
// type and style" — restructured to match the attached reference
// ("Test & Tag" branded "Report of Thorough Examination of Lifting
// Equipment", LOLER 1998): customer/site/report#/date header,
// examination type, equipment identification block, free-text
// examination details, and a PASS/FAIL result — no LOLER statutory
// declaration section (that stayed on the legacy Visual Certificate
// template only, see LooseGearStandardReportData's own comment in
// inspection.types.ts). "Do not imbed the photo" — no
// LooseGearItemPhoto here either now.
// Requested directly: "make the whole document layout just as the pdf
// loaded do not change the style" (Exam-Report-Sheet-1.pdf, the "Test
// & Tag" branded reference) — rebuilt as a plain black-bordered form
// grid matching that reference's own field grouping, in place of the
// app's usual soft-card .insp-id-table/.insp-remarks-box/.insp-pill
// styling (see .tt-report in inspections.css for why this is its own
// scoped style rather than a change to those shared rules). HMZC's own
// letterhead — already rendered above by CertPageFrame — is kept
// as-is; the reference's OWN company letterhead ("TEST & TAG",
// Certificate of Incorporation Number, LEEA accreditation logo) is
// intentionally not reproduced, matching the same "style, not literal
// branding" call made when this report was first redesigned. "Page 1
// of 1" (the reference's own pagination footer, meaningless for this
// app's single-certificate model) is swapped for a Vessel field this
// business actually needs and the reference has no field for.
//
// "remove the previous examiner sign and master sign section" — the
// reference has only ONE signer block ("Examination Carried Out By":
// Name, Signature — Position/LEEA ID Number were removed on later
// request), not the app's usual Master+Technician pair, so the shared SignatureGrid
// (see MultipleItemsPage and every other certificate kind) is dropped
// here in favor of a bespoke table matching that exact grouping — no
// Master/Captain name or signature field renders for this report type
// at all now (see the same exclusion in VesselLookupAndSignatures,
// LooseGearForm.tsx).
function StandardReportPage({ cert, data }: { cert: InspectionCertificate; data: LooseGearStandardReportData }) {
  // Same class of bug as MultipleItemsPage's `defects` (see that
  // function's own comment) — see normalizedSerialNos's own comment in
  // inspectionHelpers.ts for why this one recovers the old value
  // instead of just falling back to an empty list.
  const serialNos = normalizedSerialNos(data);
  return (
    <CertPageFrame cert={cert}>
      <div className="lg-compact tt-report">
      <div className="tt-title">Report of Thorough Examination of Lifting Equipment</div>
      <div className="tt-subtitle">This report complies with the requirements of the Lifting Operations and Lifting Equipment Regulations 1998</div>

      <table className="tt-grid">
        <tbody>
          <tr>
            <td rowSpan={2} style={{ width: "27%" }}><span className="tt-label">Customer Details</span>{data.customerDetails || "—"}</td>
            <td rowSpan={2} style={{ width: "27%" }}><span className="tt-label">Site Address</span>{data.siteAddress || "—"}</td>
            <td style={{ width: "23%" }}><span className="tt-label">Report No.</span>{cert.certNo}</td>
            <td style={{ width: "23%" }}><span className="tt-label">Date of Examination</span>{fmtDate(data.dateOfExamination)}</td>
          </tr>
          <tr>
            <td colSpan={2}>
              <span className="tt-label">Examination Type</span>{EXAMINATION_TYPE_PRINT_LABELS[data.examinationType] || "—"}
              <div className="tt-note">Types: Initial, Standard, Under A Scheme, After Exceptional Circumstances</div>
            </td>
            {/* Requested directly: "look at this [BDA Technical Guide]
                at the report section and include section where
                needed" — LOLER Schedule 1 item 11's own "date of the
                report", and item 6(b)'s "installed correctly" answer
                (only meaningful when Examination Type is "Initial" —
                see the type definition's own comment). Date of Report
                spans both remaining columns when there's no Installed
                Correctly cell to sit beside, so the row always fills
                the table's width. */}
            <td colSpan={data.examinationType === "initial" ? 1 : 2}><span className="tt-label">Date of Report</span>{fmtDate(data.dateOfReport)}</td>
            {data.examinationType === "initial" && (
              <td><span className="tt-label">Installed Correctly?</span>{yesNoCheckboxes(data.installedCorrectly)}</td>
            )}
          </tr>
          <tr>
            <td><span className="tt-label">Job No</span>{cert.jobRef || data.jobNo || "—"}</td>
            <td><span className="tt-label">Prev. Exam Date</span>{fmtDate(data.prevExamDate)}</td>
            <td><span className="tt-label">Next Exam Date</span>{fmtDate(data.nextExamDate)}</td>
            <td><span className="tt-label">Vessel</span>{cert.vesselName || "—"}</td>
          </tr>
        </tbody>
      </table>

      <table className="tt-grid">
        <tbody>
          <tr><td className="tt-section-header" colSpan={3}>Description and Identification of the Equipment Item Examined</td></tr>
          <tr>
            <td><span className="tt-label">I.D. No</span>{data.idNo || "—"}</td>
            <td><span className="tt-label">Description</span>{data.description || "—"}</td>
            <td><span className="tt-label">Model Details</span>{data.modelDetails || "—"}</td>
          </tr>
          <tr>
            <td><span className="tt-label">Serial No(s)</span>{serialNos.filter((s) => s.trim()).join(", ") || "—"}</td>
            <td><span className="tt-label">Manufacturer</span>{data.manufacturer || "—"}</td>
            <td><span className="tt-label">P.R.V. Fitted</span>{yesNoCheckboxes(data.prvFitted)}</td>
          </tr>
          <tr>
            <td><span className="tt-label">Mfg. Date</span>{fmtDate(data.mfgDate)}</td>
            <td><span className="tt-label">Location</span>{data.itemLocation || "—"}</td>
            <td><span className="tt-label">S.W.L</span>{data.swl || "—"}</td>
            <td><span className="tt-label">WLL</span>{data.ewl || "—"}</td>
          </tr>
          {/* Requested directly, from the BDA Technical Guide: MBL is
              the figure SWL/WLL is calculated FROM (WLL = MBL/FoS),
              and the guide repeatedly recommends recording the Factor
              of Safety used on the certificate itself. */}
          <tr>
            <td colSpan={2}><span className="tt-label">MBL (Minimum Breaking Load)</span>{data.mbl || "—"}</td>
            <td colSpan={2}><span className="tt-label">Factor of Safety</span>{data.factorOfSafety || "—"}</td>
          </tr>
        </tbody>
      </table>

      <table className="tt-grid">
        <tbody>
          <tr><td className="tt-section-header" colSpan={3}>Examination Details</td></tr>
          <tr>
            <td><span className="tt-label">Type of Examination/Test Carried Out</span>{data.examinationCarriedOut || "—"}</td>
            <td><span className="tt-label">Examination Result / Equipment Status</span>{data.examinationResult || "—"}</td>
            <td><span className="tt-label">Safe For Use</span>{yesNoCheckboxes(data.safeForUse)}</td>
          </tr>
          <tr>
            <td colSpan={2}><span className="tt-label">(A) Defects In Need of Attention To Prevent Immediate Failure &amp; Details of Action Required</span>{data.defectsImmediate || "NONE"}</td>
            <td colSpan={1}><span className="tt-label">(B) Defects to be Kept Under Observation, Date When Must Be Rectified By and Parts Required</span>{data.defectsObservation || "NONE"}</td>
          </tr>
          {/* LOLER Schedule 1 item 8(a)'s own sub-question, flagged
              explicitly in the BDA guide: a defect that IS an
              immediate danger to persons must be reported to the
              enforcing authority, a materially different consequence
              than one merely kept under observation above. */}
          <tr>
            <td colSpan={3}><span className="tt-label">Is Defect (A) an Immediate Danger to Persons?</span>{yesNoCheckboxes(data.defectImmediateDanger)}</td>
          </tr>
          <tr>
            <td colSpan={2}><span className="tt-label">Particulars of Any Tests Carried Out as Part of the Examination</span>{data.testsCarriedOut || "NONE"}</td>
            <td colSpan={1}><span className="tt-label">Additional Comments Made As Part of This Examination</span>{data.additionalComments || "None"}</td>
          </tr>
        </tbody>
      </table>

      <table className="tt-grid tt-result-grid">
        <tbody>
          <tr>
            <td style={{ width: "34%" }}>RESULT</td>
            <td className={`tt-result-pass ${data.result === "pass" ? "" : "tt-result-dim"}`}>PASS</td>
            <td className={`tt-result-fail ${data.result === "fail" ? "" : "tt-result-dim"}`}>FAIL</td>
          </tr>
        </tbody>
      </table>

      <table className="tt-grid">
        <tbody>
          <tr>
            <td rowSpan={2} style={{ width: "24%" }}><span className="tt-label">Examination Carried Out By</span></td>
            <td><span className="tt-label">Name</span>{cert.engineerName || "—"}</td>
          </tr>
          <tr>
            <td style={{ position: "relative" }}>
              <span className="tt-label">Signature</span>
              {/* Requested directly: "the signature and stamp appears
                  small, check if the size can be increased on all the
                  certificate" — matches SignBox's own scale-up above. */}
              {cert.engineerSig ? (
                <img src={cert.engineerSig} alt="Examiner signature" style={{ height: 42 }} />
              ) : cert.engineerName ? (
                <span style={{ fontFamily: "cursive", fontSize: 20 }}>{cert.engineerName}</span>
              ) : "—"}
              {/* Requested directly: "the stamp is removed from the
                  Lose gear certificate, you need to bring it back" —
                  restores the same HMZC stamp overlay SignBox applies
                  elsewhere (see SignBox's own comment for the full
                  technique/reasoning) onto this report's own Examiner
                  signature cell, since this report doesn't render a
                  SignBox/SignatureGrid at all anymore (see this
                  function's own top comment). */}
              <div
                role="img"
                aria-label="HMZC Official Stamp"
                style={{
                  position: "absolute",
                  left: "58%",
                  bottom: -11,
                  transform: "translateX(-50%) rotate(-7deg)",
                  height: 58,
                  width: 182,
                  backgroundImage: "var(--insp-stamp-url)",
                  backgroundSize: "contain",
                  backgroundRepeat: "no-repeat",
                  printColorAdjust: "exact",
                  WebkitPrintColorAdjust: "exact",
                  opacity: 0.9,
                  pointerEvents: "none",
                }}
              />
            </td>
          </tr>
        </tbody>
      </table>

      {cert.issuedBy && (
        <div style={{ fontSize: 9, color: "#555", marginTop: 4 }}>
          Issued by {cert.issuedBy}{cert.issuedAt ? ` — ${new Date(cert.issuedAt).toLocaleString()}` : ""}
        </div>
      )}
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
  // Root-caused from a real report: opening a Multiple Items
  // certificate saved before the Defect Report feature existed showed
  // a blank white page — `data.defects`/`data.defectObservations`
  // simply aren't present in that older certificate's stored JSON (no
  // migration touches already-saved payloads, see freshLooseGearRegisterRow's
  // own comment on why the field itself is never renamed either), so
  // `data.defects.length` below threw on `undefined` and crashed the
  // render with no error boundary to catch it. Normalized once here
  // instead of guarding every read site individually.
  const defects = data.defects || [];
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
          {/* Requested directly: "for all multiple should have numbering
              also appearing in print and preview just as you see when
              inputing the data" — the form's own Item Register already
              numbers rows (LooseGearForm.tsx's MultipleItemsForm); this
              # column matches it here, colSpan raised 10→11 to match. */}
          <CertNoTheadRow certNo={cert.certNo} colSpan={11} />
          <tr>
            <th>#</th><th>Serial No.</th><th>Description</th><th>SWL</th><th>Manufacturer</th>
            <th>Cert No./Test Date</th><th>Location</th><th>Type of Inspection</th><th>Next Inspection</th>
            {/* Requested directly: "change result to (status) and move
                it to the end close to safe to use" — see
                LooseGearRegisterRow.result's own comment in
                inspection.types.ts for why the field itself is still
                named `result`. */}
            <th>Status</th><th>Safe to Use</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.length === 0 ? (
            <tr><td colSpan={11} style={{ color: "var(--insp-muted)" }}>No items recorded.</td></tr>
          ) : (
            data.rows.map((row, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{row.serialNo || "—"}</td>
                <td>{row.description || "—"}</td>
                <td>{row.swl || "—"}</td>
                <td>{row.manufacturer || "—"}</td>
                <td>{row.certNoTestDate || "—"}</td>
                <td>{row.itemLocation || "—"}</td>
                <td>{row.typeOfInspection || "—"}</td>
                <td>{fmtDate(row.nextInspectionDate)}</td>
                <td>{row.result || "—"}</td>
                <td><span className={`insp-pill ${row.safeToUse === "yes" ? "good" : row.safeToUse === "no" ? "repair" : ""}`}>{yesNoLabel(row.safeToUse)}</span></td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div style={{ fontWeight: 700, fontSize: 11.5, color: "var(--insp-navy)", margin: "10px 0 4px" }}>Status</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px 16px", fontSize: 10.5 }}>
        {LOOSE_GEAR_STATUS_CODES.map((s) => <div key={s.code}>{s.label}</div>)}
      </div>

      {/* Requested directly, from a real reference form (LEEA-030.1d
          "Report of Thorough Examination — Defect Report List"): an
          attachment for any row above marked SDR/OBS. Only rendered
          when at least one defect was actually recorded — a clean
          register with no defects shouldn't carry a blank attachment
          page, matching how the source form is used as a genuine
          addendum, not a standing section. */}
      {defects.length > 0 && (
        <>
          <div className="insp-cert-title-row" style={{ marginTop: 14 }}>
            <h2 style={{ fontSize: 13 }}>Defect Report</h2>
          </div>
          <p style={{ fontSize: 10.5, margin: "0 0 8px" }}>
            This defect report refers to the equipment listed on the Thorough Examination report number: <strong>{cert.certNo}</strong>
          </p>
          <table className="insp-print-chk">
            <thead>
              <CertNoTheadRow certNo={cert.certNo} colSpan={7} />
              <tr>
                <th>#</th><th>Equipment ID No.</th><th>Equipment Description</th><th>Defective Parts</th>
                <th>Immediate Danger *</th><th>When Will It Become a Danger</th><th>Repair/Renewal/Alteration Particulars</th>
              </tr>
            </thead>
            <tbody>
              {defects.map((row, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{row.equipmentIdNo || "—"}</td>
                  <td>{row.equipmentDescription || "—"}</td>
                  <td>{row.defectiveParts || "—"}</td>
                  <td><span className={`insp-pill ${row.immediateDanger === "yes" ? "repair" : row.immediateDanger === "no" ? "good" : ""}`}>{yesNoLabel(row.immediateDanger)}</span></td>
                  <td>{row.immediateDanger === "yes" ? "N/A" : row.whenBecomesDanger || "—"}</td>
                  <td>{row.repairParticulars || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 9.5, color: "var(--insp-red)", margin: "4px 0 8px" }}>* If yes, must be reported to HSE.</p>
          <div style={{ fontWeight: 700, fontSize: 11.5, color: "var(--insp-navy)", margin: "6px 0 4px" }}>
            Observations / Additional Comments Relative to This Thorough Examination
          </div>
          <p style={{ fontSize: 10.5, margin: 0 }}>{data.defectObservations || "None"}</p>
        </>
      )}

      {cert.issuedBy && (
        <div style={{ fontSize: 9, color: "var(--insp-muted)", marginTop: 8 }}>
          Issued by {cert.issuedBy}{cert.issuedAt ? ` — ${new Date(cert.issuedAt).toLocaleString()}` : ""}
        </div>
      )}
      <SignatureGrid cert={cert} masterLabel="Master" techLabel="Inspector" hideFitForPurpose />
      </div>
    </CertPageFrame>
  );
}

// ============================================================
// Load Test / NDT report types (MPI, PT, RT, UT, VT, ET) — requested
// directly: put HMZC's Load Test Report and 6 NDT method templates into
// Loose Gear & Lifting Equipment, based on the MPI/PT templates' own
// format, styled after a real reference report (dense bordered grid) —
// reusing the same tt-grid/tt-label/tt-section-header/tt-report family
// StandardReportPage already established for exactly that look, rather
// than the looser insp-id-table convention VisualCertPage/
// MultipleItemsPage use. Signatures reuse the shared SignatureGrid
// component (relabeled) — same as MultipleItemsPage already does inside
// this same lg-compact page family, just with different labels.
// ============================================================

const MPI_METHOD_LABELS: Record<string, string> = { prods: "Prods", yoke: "Yoke", other: "Other", "": "—" };
const MPI_MAGNETIZED_LABELS: Record<string, string> = { longitudinal: "Longitudinal Defects", transverse: "Transverse Defects", both: "Longitudinal + Transverse Defects", "": "—" };
const PT_REMOVER_LABELS: Record<string, string> = { water: "Water", emulsifier: "Emulsifier", solvent: "Solvent", "": "—" };
const PT_DEVELOPER_LABELS: Record<string, string> = { dry_powder: "1. Dry Powder", solution_water: "2. Solution in Water", suspension_water: "3. Suspension in Water", powder_solvent: "4. Powder in Volatile Solvent (Spray)", "": "—" };
const RT_TECHNIQUE_LABELS: Record<string, string> = { swsi: "SWSI", dwsi: "DWSI", dwdi: "DWDI", "": "—" };
const UT_SCANNING_LABELS: Record<string, string> = { contact: "Contact", immersion: "Immersion", "": "—" };
const VT_STAGE_LABELS: Record<string, string> = { pre_weld: "Pre-Weld", in_process: "In-Process", final: "Final", "": "—" };
const VT_DIRECT_LABELS: Record<string, string> = { direct: "Direct", remote: "Remote", "": "—" };

// Report No./Date of Testing/Vessel/IMO reuse cert-level fields (not
// duplicated on NDTCommonData — see its own comment in inspection.types.ts).
function NDTHeaderGrid({ cert, common }: { cert: InspectionCertificate; common: NDTCommonData }) {
  return (
    <table className="tt-grid">
      <tbody>
        <tr>
          <td style={{ width: "25%" }}><span className="tt-label">Report No.</span>{cert.certNo}</td>
          <td style={{ width: "25%" }}><span className="tt-label">Date of Testing</span>{fmtDate(cert.dateOfServicing)}</td>
          <td style={{ width: "25%" }}><span className="tt-label">Vessel</span>{cert.vesselName || "—"}</td>
          <td style={{ width: "25%" }}><span className="tt-label">IMO No.</span>{cert.imoNo || "—"}</td>
        </tr>
        <tr>
          <td colSpan={2}><span className="tt-label">Client</span>{common.client || "—"}</td>
          <td colSpan={2}><span className="tt-label">Manufacturer</span>{common.manufacturer || "—"}</td>
        </tr>
        <tr>
          <td colSpan={4}><span className="tt-label">Object of Control</span>{common.objectOfControl || "—"}</td>
        </tr>
        <tr>
          <td><span className="tt-label">PO No.</span>{common.poNo || "—"}</td>
          <td colSpan={3}><span className="tt-label">Procedure Reference</span>{common.procedureReference || "—"}</td>
        </tr>
        <tr>
          <td colSpan={2}><span className="tt-label">Drawing No.</span>{common.drawingNo || "—"}</td>
          <td colSpan={2}><span className="tt-label">Extent of Testing</span>{common.extentOfTesting || "—"}</td>
        </tr>
        <tr>
          <td colSpan={3}><span className="tt-label">Acceptance Standard</span>{common.acceptanceStandard || "—"}</td>
          <td><span className="tt-label">Operator</span>{common.operator || "—"}</td>
        </tr>
      </tbody>
    </table>
  );
}

function NDTIndicationsGrid({ title, columns, rows }: { title: string; columns: { key: string; label: string }[]; rows: Record<string, string>[] }) {
  return (
    <table className="tt-grid">
      <tbody>
        <tr><td className="tt-section-header" colSpan={columns.length}>{title}</td></tr>
        <tr>
          {columns.map((c) => <td key={c.key} style={{ fontWeight: 700, fontSize: 9, textTransform: "uppercase" }}>{c.label}</td>)}
        </tr>
        {rows.length === 0 ? (
          <tr><td colSpan={columns.length} style={{ color: "var(--insp-muted)" }}>None recorded.</td></tr>
        ) : rows.map((row, i) => (
          <tr key={i}>{columns.map((c) => <td key={c.key}>{row[c.key] || "—"}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

function NDTFooterGrid({ cert, footer }: { cert: InspectionCertificate; footer: NDTFooterData }) {
  return (
    <>
      <table className="tt-grid">
        <tbody>
          <tr><td className="tt-section-header" colSpan={2}>Test Result</td></tr>
          <tr>
            <td colSpan={2}><span className="tt-label">Findings / Result Statement</span>{footer.findingsStatement || "—"}</td>
          </tr>
          <tr>
            <td><span className="tt-label">Serial No.</span>{footer.serialNo || "—"}</td>
            <td>
              <span className="tt-label">Repairs Marked On</span>
              <span aria-hidden="true">{footer.repairsMarkedOnObject ? "☒" : "☐"}</span> Object&nbsp;&nbsp;
              <span aria-hidden="true">{footer.repairsMarkedOnSketch ? "☒" : "☐"}</span> Sketch
            </td>
          </tr>
        </tbody>
      </table>
      <LooseGearItemPhoto cert={cert} />
    </>
  );
}

function MPIPage({ cert, data }: { cert: InspectionCertificate; data: MPIData }) {
  return (
    <CertPageFrame cert={cert}>
      <div className="lg-compact tt-report">
        <div className="tt-title">Magnetic Particle Testing Certificate</div>
        <div className="tt-subtitle">ISO 9712 / SNT-TC-1A — Non-Destructive Testing (MT)</div>
        <NDTHeaderGrid cert={cert} common={data.common} />
        <table className="tt-grid">
          <tbody>
            <tr><td className="tt-section-header" colSpan={4}>Material &amp; Method</td></tr>
            <tr>
              <td><span className="tt-label">Material Type</span>{data.materialType || "—"}</td>
              <td><span className="tt-label">Surface</span>{data.surface || "—"}</td>
              <td><span className="tt-label">Groove/Geometry</span>{data.grooveGeometry || "—"}</td>
              <td><span className="tt-label">Welding Process</span>{data.weldingProcess || "—"}</td>
            </tr>
            <tr>
              <td><span className="tt-label">Welder's ID</span>{data.weldersId || "—"}</td>
              <td><span className="tt-label">Object Temperature</span>{data.objectTemperature || "—"}</td>
              <td><span className="tt-label">Method</span>{MPI_METHOD_LABELS[data.method]}{data.methodSMax ? ` (S max ${data.methodSMax}mm)` : ""}</td>
              <td><span className="tt-label">Current</span>{data.current ? data.current.toUpperCase() : "—"}</td>
            </tr>
            <tr>
              <td><span className="tt-label">Field Strength</span>{data.fieldStrength || "—"}</td>
              <td><span className="tt-label">Medium</span>{[data.mediumWetDry, data.mediumType].filter(Boolean).map((s) => s![0].toUpperCase() + s!.slice(1)).join(" / ") || "—"}</td>
              <td colSpan={2}><span className="tt-label">Magnetized For</span>{MPI_MAGNETIZED_LABELS[data.magnetizedFor]}</td>
            </tr>
            <tr>
              <td colSpan={2}><span className="tt-label">Contrast Colour</span>{data.contrastColour || "—"}</td>
              <td colSpan={2}><span className="tt-label">Field Indicator</span>{data.fieldIndicator || "—"}</td>
            </tr>
          </tbody>
        </table>
        <NDTFooterGrid cert={cert} footer={data.footer} />
        <SignatureGrid cert={cert} masterLabel="Approved By" techLabel="Operator/Technician" hideFitForPurpose />
      </div>
    </CertPageFrame>
  );
}

function PTPage({ cert, data }: { cert: InspectionCertificate; data: PTData }) {
  return (
    <CertPageFrame cert={cert}>
      <div className="lg-compact tt-report">
        <div className="tt-title">Liquid Penetrant Testing Certificate</div>
        <div className="tt-subtitle">ISO 9712 / SNT-TC-1A — Non-Destructive Testing (PT)</div>
        <NDTHeaderGrid cert={cert} common={data.common} />
        <table className="tt-grid">
          <tbody>
            <tr><td className="tt-section-header" colSpan={4}>Material &amp; Penetrant</td></tr>
            <tr>
              <td><span className="tt-label">Material Type</span>{data.materialType || "—"}</td>
              <td><span className="tt-label">Surface</span>{data.surface || "—"}</td>
              <td><span className="tt-label">Groove/Geometry</span>{data.grooveGeometry || "—"}</td>
              <td><span className="tt-label">Welding Process</span>{data.weldingProcess || "—"}</td>
            </tr>
            <tr>
              <td><span className="tt-label">Welder's ID</span>{data.weldersId || "—"}</td>
              <td><span className="tt-label">Object Temperature</span>{data.objectTemperature || "—"}</td>
              <td><span className="tt-label">Penetrant Type</span>{data.penetrantType || "—"}</td>
              <td><span className="tt-label">Application Method</span>{data.applicationMethod || "—"}</td>
            </tr>
            <tr>
              <td><span className="tt-label">Fluorescent</span>{yesNoCheckboxes(data.fluorescent)}</td>
              <td><span className="tt-label">Penetrant Remover</span>{PT_REMOVER_LABELS[data.penetrantRemover]}</td>
              <td colSpan={2}><span className="tt-label">Developer</span>{PT_DEVELOPER_LABELS[data.developer]}</td>
            </tr>
            <tr>
              <td colSpan={2}><span className="tt-label">Penetration Time</span>{data.penetrationTime || "—"}</td>
              <td colSpan={2}><span className="tt-label">Developing Time</span>{data.developingTime || "—"}</td>
            </tr>
          </tbody>
        </table>
        <NDTFooterGrid cert={cert} footer={data.footer} />
        <SignatureGrid cert={cert} masterLabel="Approved By" techLabel="Operator/Technician" hideFitForPurpose />
      </div>
    </CertPageFrame>
  );
}

const RT_INDICATION_PRINT_COLUMNS = [
  { key: "filmImageNo", label: "Film/Image No." },
  { key: "weldLocation", label: "Weld/Location" },
  { key: "indicationType", label: "Indication Type" },
  { key: "size", label: "Size (mm)" },
  { key: "evaluation", label: "Evaluation" },
];

function RTPage({ cert, data }: { cert: InspectionCertificate; data: RTData }) {
  return (
    <CertPageFrame cert={cert}>
      <div className="lg-compact tt-report">
        <div className="tt-title">Radiographic Testing Certificate</div>
        <div className="tt-subtitle">ISO 17636 / ASME V Art. 2 — Non-Destructive Testing (RT)</div>
        <NDTHeaderGrid cert={cert} common={data.common} />
        <table className="tt-grid">
          <tbody>
            <tr><td className="tt-section-header" colSpan={4}>Material &amp; Joint</td></tr>
            <tr>
              <td><span className="tt-label">Material Type</span>{data.materialType || "—"}</td>
              <td><span className="tt-label">Thickness (mm)</span>{data.thickness || "—"}</td>
              <td><span className="tt-label">Joint/Weld Type</span>{data.jointWeldType || "—"}</td>
              <td><span className="tt-label">Welding Process</span>{data.weldingProcess || "—"}</td>
            </tr>
            <tr>
              <td><span className="tt-label">Welder's ID</span>{data.weldersId || "—"}</td>
              <td colSpan={3}><span className="tt-label">Technique</span>{RT_TECHNIQUE_LABELS[data.technique]}</td>
            </tr>
            <tr><td className="tt-section-header" colSpan={4}>Exposure Parameters</td></tr>
            <tr>
              <td><span className="tt-label">Source Type</span>{data.sourceType || "—"}</td>
              <td><span className="tt-label">Focal Spot Size</span>{data.focalSpotSize || "—"}</td>
              <td><span className="tt-label">kV / Curie (Ci)</span>{data.kvOrCurie || "—"}</td>
              <td><span className="tt-label">mA / Exposure Time</span>{data.maOrExposureTime || "—"}</td>
            </tr>
            <tr>
              <td><span className="tt-label">Source-to-Film Distance</span>{data.sourceToFilmDistance || "—"}</td>
              <td><span className="tt-label">Screens (Front/Back)</span>{data.screens || "—"}</td>
              <td><span className="tt-label">Film Type / Detector</span>{data.filmTypeOrDetector || "—"}</td>
              <td><span className="tt-label">Density Range</span>{data.densityRange || "—"}</td>
            </tr>
            <tr><td className="tt-section-header" colSpan={4}>Image Quality</td></tr>
            <tr>
              <td><span className="tt-label">IQI Type</span>{data.iqiType || "—"}</td>
              <td><span className="tt-label">Sensitivity Achieved (%)</span>{data.sensitivityAchieved || "—"}</td>
              <td><span className="tt-label">No. of Exposures</span>{data.numberOfExposures || "—"}</td>
              <td><span className="tt-label">Viewing Conditions</span>{data.viewingConditions || "—"}</td>
            </tr>
          </tbody>
        </table>
        <NDTIndicationsGrid title="Indications / Test Result" columns={RT_INDICATION_PRINT_COLUMNS} rows={data.indications} />
        <NDTFooterGrid cert={cert} footer={data.footer} />
        <SignatureGrid cert={cert} masterLabel="Approved By" techLabel="Operator/Technician" hideFitForPurpose />
      </div>
    </CertPageFrame>
  );
}

const UT_INDICATION_PRINT_COLUMNS = [
  { key: "indNo", label: "Ind. No." },
  { key: "weldLocation", label: "Weld/Location" },
  { key: "length", label: "Length (mm)" },
  { key: "amplitude", label: "Amplitude (dB)" },
  { key: "depth", label: "Depth (mm)" },
  { key: "evaluation", label: "Evaluation" },
];

function UTPage({ cert, data }: { cert: InspectionCertificate; data: UTData }) {
  return (
    <CertPageFrame cert={cert}>
      <div className="lg-compact tt-report">
        <div className="tt-title">Ultrasonic Testing Certificate</div>
        <div className="tt-subtitle">ISO 17640 / ASME V Art. 4 — Non-Destructive Testing (UT)</div>
        <NDTHeaderGrid cert={cert} common={data.common} />
        <table className="tt-grid">
          <tbody>
            <tr><td className="tt-section-header" colSpan={4}>Material &amp; Weld</td></tr>
            <tr>
              <td><span className="tt-label">Material Type</span>{data.materialType || "—"}</td>
              <td><span className="tt-label">Surface</span>{data.surface || "—"}</td>
              <td><span className="tt-label">Groove/Geometry</span>{data.grooveGeometry || "—"}</td>
              <td><span className="tt-label">Welding Process</span>{data.weldingProcess || "—"}</td>
            </tr>
            <tr>
              <td><span className="tt-label">Welder's ID</span>{data.weldersId || "—"}</td>
              <td colSpan={3}><span className="tt-label">Object Temperature</span>{data.objectTemperature || "—"}</td>
            </tr>
            <tr><td className="tt-section-header" colSpan={4}>Equipment &amp; Probe</td></tr>
            <tr>
              <td><span className="tt-label">Instrument Type / Model</span>{data.instrumentTypeModel || "—"}</td>
              <td><span className="tt-label">Instrument Serial No.</span>{data.instrumentSerialNo || "—"}</td>
              <td><span className="tt-label">Calibration Due Date</span>{fmtDate(data.calibrationDueDate)}</td>
              <td><span className="tt-label">Reference/Calibration Block</span>{data.referenceBlock || "—"}</td>
            </tr>
            <tr>
              <td><span className="tt-label">Probe Type</span>{data.probeType || "—"}</td>
              <td><span className="tt-label">Frequency (MHz)</span>{data.probeFrequency || "—"}</td>
              <td><span className="tt-label">Angle</span>{data.probeAngle || "—"}</td>
              <td><span className="tt-label">Size</span>{data.probeSize || "—"}</td>
            </tr>
            <tr>
              <td><span className="tt-label">Couplant</span>{data.couplant || "—"}</td>
              <td colSpan={3}><span className="tt-label">Scanning Technique</span>{UT_SCANNING_LABELS[data.scanningTechnique]}</td>
            </tr>
            <tr><td className="tt-section-header" colSpan={4}>Calibration &amp; Sensitivity</td></tr>
            <tr>
              <td><span className="tt-label">Reference Level (dB)</span>{data.referenceLevel || "—"}</td>
              <td><span className="tt-label">Scanning Sensitivity (dB)</span>{data.scanningSensitivity || "—"}</td>
              <td><span className="tt-label">Recording Level (DAC/dB)</span>{data.recordingLevel || "—"}</td>
              <td><span className="tt-label">Reporting Level (dB)</span>{data.reportingLevel || "—"}</td>
            </tr>
            <tr>
              <td colSpan={2}><span className="tt-label">Scan Coverage (%)</span>{data.scanCoverage || "—"}</td>
              <td colSpan={2}><span className="tt-label">Beam Angle Check</span>{data.beamAngleCheck || "—"}</td>
            </tr>
          </tbody>
        </table>
        <NDTIndicationsGrid title="Indications / Test Result" columns={UT_INDICATION_PRINT_COLUMNS} rows={data.indications} />
        <NDTFooterGrid cert={cert} footer={data.footer} />
        <SignatureGrid cert={cert} masterLabel="Approved By" techLabel="Operator/Technician" hideFitForPurpose />
      </div>
    </CertPageFrame>
  );
}

const VT_OBSERVATION_PRINT_COLUMNS = [
  { key: "itemNo", label: "Item No." },
  { key: "locationWeld", label: "Location/Weld" },
  { key: "observation", label: "Observation" },
  { key: "evaluation", label: "Evaluation" },
];

function VTPage({ cert, data }: { cert: InspectionCertificate; data: VTData }) {
  return (
    <CertPageFrame cert={cert}>
      <div className="lg-compact tt-report">
        <div className="tt-title">Visual Testing Certificate</div>
        <div className="tt-subtitle">ISO 17637 / ASME V Art. 9 — Non-Destructive Testing (VT)</div>
        <NDTHeaderGrid cert={cert} common={data.common} />
        <table className="tt-grid">
          <tbody>
            <tr><td className="tt-section-header" colSpan={4}>Material &amp; Weld</td></tr>
            <tr>
              <td><span className="tt-label">Material Type</span>{data.materialType || "—"}</td>
              <td><span className="tt-label">Joint/Weld Type</span>{data.jointWeldType || "—"}</td>
              <td><span className="tt-label">Surface Condition</span>{data.surfaceCondition || "—"}</td>
              <td><span className="tt-label">Welding Process</span>{data.weldingProcess || "—"}</td>
            </tr>
            <tr>
              <td><span className="tt-label">Welder's ID</span>{data.weldersId || "—"}</td>
              <td colSpan={3}><span className="tt-label">Stage of Inspection</span>{VT_STAGE_LABELS[data.stageOfInspection]}</td>
            </tr>
            <tr><td className="tt-section-header" colSpan={4}>Inspection Conditions</td></tr>
            <tr>
              <td><span className="tt-label">Illumination Level (lux)</span>{data.illuminationLevel || "—"}</td>
              <td><span className="tt-label">Viewing Distance/Angle</span>{data.viewingDistanceAngle || "—"}</td>
              <td><span className="tt-label">Aids Used</span>{data.aidsUsed || "—"}</td>
              <td><span className="tt-label">Direct or Remote</span>{VT_DIRECT_LABELS[data.directOrRemote]}</td>
            </tr>
          </tbody>
        </table>
        <NDTIndicationsGrid title="Observations / Test Result" columns={VT_OBSERVATION_PRINT_COLUMNS} rows={data.observations} />
        <NDTFooterGrid cert={cert} footer={data.footer} />
        <SignatureGrid cert={cert} masterLabel="Approved By" techLabel="Operator/Technician" hideFitForPurpose />
      </div>
    </CertPageFrame>
  );
}

const ET_INDICATION_PRINT_COLUMNS = [
  { key: "indNo", label: "Ind. No." },
  { key: "weldLocation", label: "Weld/Location" },
  { key: "signalAmplitude", label: "Signal Amplitude" },
  { key: "phaseAngle", label: "Phase Angle" },
  { key: "evaluation", label: "Evaluation" },
];

function ETPage({ cert, data }: { cert: InspectionCertificate; data: ETData }) {
  return (
    <CertPageFrame cert={cert}>
      <div className="lg-compact tt-report">
        <div className="tt-title">Eddy Current Testing Certificate</div>
        <div className="tt-subtitle">ISO 17643 / ASME V Art. 8 — Non-Destructive Testing (ET)</div>
        <NDTHeaderGrid cert={cert} common={data.common} />
        <table className="tt-grid">
          <tbody>
            <tr><td className="tt-section-header" colSpan={4}>Material &amp; Weld</td></tr>
            <tr>
              <td><span className="tt-label">Material Type</span>{data.materialType || "—"}</td>
              <td><span className="tt-label">Surface</span>{data.surface || "—"}</td>
              <td><span className="tt-label">Groove/Geometry</span>{data.grooveGeometry || "—"}</td>
              <td><span className="tt-label">Welding Process</span>{data.weldingProcess || "—"}</td>
            </tr>
            <tr>
              <td><span className="tt-label">Welder's ID</span>{data.weldersId || "—"}</td>
              <td colSpan={3}><span className="tt-label">Object Temperature</span>{data.objectTemperature || "—"}</td>
            </tr>
            <tr><td className="tt-section-header" colSpan={4}>Equipment &amp; Probe Settings</td></tr>
            <tr>
              <td><span className="tt-label">Instrument Type / Model</span>{data.instrumentTypeModel || "—"}</td>
              <td><span className="tt-label">Instrument Serial No.</span>{data.instrumentSerialNo || "—"}</td>
              <td><span className="tt-label">Calibration Due Date</span>{fmtDate(data.calibrationDueDate)}</td>
              <td><span className="tt-label">Reference Standard/Block</span>{data.referenceStandardBlock || "—"}</td>
            </tr>
            <tr>
              <td><span className="tt-label">Probe Type</span>{data.probeType || "—"}</td>
              <td><span className="tt-label">Frequency (kHz)</span>{data.frequency || "—"}</td>
              <td><span className="tt-label">Gain (dB)</span>{data.gain || "—"}</td>
              <td><span className="tt-label">Phase Angle</span>{data.phaseAngle || "—"}</td>
            </tr>
            <tr>
              <td colSpan={2}><span className="tt-label">Scan Coverage (%)</span>{data.scanCoverage || "—"}</td>
              <td colSpan={2}><span className="tt-label">Scan Speed</span>{data.scanSpeed || "—"}</td>
            </tr>
          </tbody>
        </table>
        <NDTIndicationsGrid title="Indications / Test Result" columns={ET_INDICATION_PRINT_COLUMNS} rows={data.indications} />
        <NDTFooterGrid cert={cert} footer={data.footer} />
        <SignatureGrid cert={cert} masterLabel="Approved By" techLabel="Operator/Technician" hideFitForPurpose />
      </div>
    </CertPageFrame>
  );
}

function LoadTestPage({ cert, data }: { cert: InspectionCertificate; data: LoadTestData }) {
  return (
    <CertPageFrame cert={cert}>
      <div className="lg-compact tt-report">
        <div className="tt-title">Load Test Report</div>
        <div className="tt-subtitle">SOLAS Chapter III Regulation 20.11.1.3 / 20.11.2.3 — LSA Code Part 2, 6.1.5</div>
        <table className="tt-grid">
          <tbody>
            <tr>
              <td style={{ width: "25%" }}><span className="tt-label">Report No.</span>{cert.certNo}</td>
              <td style={{ width: "25%" }}><span className="tt-label">Date</span>{fmtDate(cert.dateOfServicing)}</td>
              <td style={{ width: "25%" }}><span className="tt-label">Vessel Name</span>{cert.vesselName || "—"}</td>
              <td style={{ width: "25%" }}><span className="tt-label">IMO</span>{cert.imoNo || "—"}</td>
            </tr>
            <tr>
              <td><span className="tt-label">Flag</span>{cert.flag || "—"}</td>
              <td colSpan={2}><span className="tt-label">Type of LSA Equipment</span>{data.typeOfLsaEquipment || "—"}</td>
              <td><span className="tt-label">LSA Location Onboard</span>{data.lsaLocationOnboard || "—"}</td>
            </tr>
          </tbody>
        </table>
        <div className="tt-note" style={{ margin: "6px 0" }}>
          From LSA Code: the boat loaded with its normal equipment and a distributed mass equal to that of the number of
          persons, each weighing the applicable weight + 10% of the working load.
        </div>
        <table className="tt-grid">
          <tbody>
            <tr>
              <td className="tt-section-header" style={{ width: "10%" }}></td>
              <td className="tt-section-header" colSpan={2}>Description</td>
              <td className="tt-section-header" style={{ width: "22%" }}>Kg / Lbs / Bar</td>
            </tr>
            {data.rows.map((row) => (
              <tr key={row.label}>
                <td style={{ fontWeight: 700, color: "var(--insp-navy)" }}>{row.label}</td>
                <td colSpan={2} style={{ fontSize: 10 }}>{row.description}</td>
                <td>{row.value || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="tt-note" style={{ margin: "6px 0" }}>Note: when using a test kit for the load test, apply the applicable pressure conversion table.</div>
        {data.remarks && <div className="insp-remarks-box">Remarks: {data.remarks}</div>}
        <LooseGearItemPhoto cert={cert} />
        <SignatureGrid cert={cert} masterLabel="RO/Class Witness" techLabel="Test Witness" hideFitForPurpose />
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
function SignatureGrid({ cert, masterLabel, techLabel, hideFitForPurpose }: { cert: InspectionCertificate; masterLabel: string; techLabel: string; hideFitForPurpose?: boolean }) {
  return (
    <>
    {/* Requested directly, reviewing a real CRALOG-issued certificate
        for comparison: their statements close with one unambiguous
        declaration — "The equipment remains FIT FOR PURPOSE: Yes/No" —
        separate from any individual checklist item's own result. See
        InspectionCertificate.fitForPurpose's own comment for which
        certificate kinds carry this and why — hideFitForPurpose is set
        for Loose Gear's Visual Certificate/Multiple Items pages, which
        already ask their own per-item pass/fail question(s). */}
    {!hideFitForPurpose && (
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--insp-navy)", marginTop: 12 }}>
        The equipment remains FIT FOR PURPOSE: {yesNoCheckboxes(cert.fitForPurpose || "")}
      </div>
    )}
    {/* Requested directly: "include this stamp to all certificate...
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
    // anything that has to survive pagination intact. */}
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
    </>
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
  // Requested directly, reviewing a real CRALOG-issued certificate for
  // comparison: their printed pages carry a software build + issue-time
  // stamp — useful to answer "was this PDF actually produced by our
  // system, unedited" if a certificate's authenticity is ever
  // questioned. Computed at render time (not read from the
  // certificate's own savedAt) so a reprint months later honestly shows
  // when THAT print happened, not when the certificate was last saved.
  const printedAt = new Date().toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return (
    <div style={{ borderTop: "1px solid #E4E7E9", marginTop: 16, paddingTop: 8 }}>
      <div style={{ fontSize: 8.5, color: "var(--insp-muted)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 5 }}>Approvals</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          {logos.map((logo) => (
            <img key={logo.alt} src={logo.src} alt={logo.alt} style={{ height: 24, objectFit: "contain" }} />
          ))}
        </div>
        <div style={{ fontSize: 7.5, color: "var(--insp-muted)" }}>
          Generated by HMZC-MICMS (v{APP_BUILD_VERSION}) &middot; Printed {printedAt}
        </div>
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
      {/* Requested directly: "the signature and stamp appears small,
          check if the size can be increased on all the certificate" —
          signature raised from 44px to 60px tall, stamp from 52 to 70
          (164 to 220 wide, keeping the source PNG's 327:104 aspect
          ratio). minHeight/offsets below are scaled the same ~1.35x so
          the stamp still overlaps the signature+name the same way and
          the Master/Technician boxes still line up (see this block's
          own comment above for why that alignment matters). */}
      <div style={{ minHeight: 86 }}>
        {sig && <img src={sig} alt={label} style={{ height: 60 }} />}
        {/* Requested directly: "the masters name when typed in should
            have same size as the technician name font size" — Master
            typically has no drawn signature (signs the printed page by
            hand later), so their typed name rendered here in this
            cursive fallback; Technician's typed name renders on the
            other line below, once they've actually signed. Different
            branches of the same box, so they'd drifted to different
            sizes over past edits — matched to the same 11px now. */}
        {!sig && name && <div style={{ fontFamily: "cursive", fontSize: 11, color: "var(--insp-navy)" }}>{name}</div>}
        {sig && name && <div style={{ fontSize: 11, color: "var(--insp-text)", marginTop: 2 }}>{name}</div>}
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
          derive one from the way an <img> does; 220x70 preserves the
          source PNG's own 327:104 aspect ratio at this height. */}
      {/* Requested directly: "shift the stamp away a bit from the
          signature as now it conflict with the signature" — the
          drawn/uploaded signature stroke sits in the upper-left of the
          60px-tall image above, so nudging the stamp down (top: -5 → 12)
          and right (left: 50% → 62%) moves its rotated body off the ink
          itself onto the lower-right area (over the printed name/label
          instead), while still visually overlapping the signature box
          enough to read as "stamped over" it — the look this overlay was
          built for in the first place (see this function's own top
          comment). */}
      {stamp && (
        <div
          role="img"
          aria-label="HMZC Official Stamp"
          style={{
            position: "absolute",
            left: "62%",
            top: 12,
            transform: "translateX(-50%) rotate(-7deg)",
            height: 70,
            width: 220,
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
      <PhotoGrid entries={entries} />
    </CertPageFrame>
  );
}

// Extracted from PhotoReportPage above — same photo grid markup, but
// without its own CertPageFrame, so PhotoReportCertificatePage (the
// dedicated "FFE Photo Report"/"Calibration Photo Report" type) can
// render it inside the SAME page frame as the vessel-info/comments/
// signature block above it, instead of always forcing photos onto
// their own separate physical page. Root-caused from a real report:
// that dedicated type's vessel-info page is nearly empty (just a
// 2-row ID table, a comments box, and a signature grid) — plenty of
// room left on page 1 — yet even a single uploaded photo always
// landed on page 2, because PhotoReportPage's own CertPageFrame
// forced a hard page break regardless of how little content came
// before it. Boat/crane's own use of PhotoReportPage (after a
// multi-page Statement/checklist/equipment-list run) keeps its own
// separate page, unaffected by this change.
function PhotoGrid({ entries, showHeading = true }: { entries: { key: string; photo: PhotoEvidence; index: number }[]; showHeading?: boolean }) {
  return (
    <>
      {/* Requested directly: "remove PHOTO REPORT written before the
          comment, as it appears twice now on report" — PhotoReportPage
          (boat/crane's own separate photo page, after a full Statement/
          checklist run) still wants this heading, since it's the only
          thing marking that a new page/section has started there.
          PhotoReportCertificatePage already has its own "Photo Report"
          title at the top of the same page frame this now renders
          inside — a second one immediately above the comment (which
          used to sit right where this heading is) was pure repetition. */}
      {showHeading && (
        <div className="insp-cert-title-row">
          <h2>Photo Report</h2>
          <span className="insp-badge">EVIDENCE</span>
        </div>
      )}
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
                  {/* Meaningful on PhotoReportPage's own use (boat/crane,
                      where photos from several different sections —
                      Davit Checklist, Boat Checklist — get merged onto
                      one page, so which section each came from is real
                      information). PhotoReportCertificatePage only ever
                      has "general"-keyed photos (see PhotoReportForm.tsx's
                      own PHOTO_KEY), so this always resolved to the same
                      "Photo Report" text repeated under every single
                      photo — the other half of "PHOTO REPORT... appears
                      twice," gated by the same showHeading flag as the
                      section title above. */}
                  {showHeading && (
                    <div style={{ fontSize: 9, color: "var(--insp-muted)", textTransform: "uppercase", marginTop: 4 }}>
                      {PHOTO_SECTION_LABELS[key] || key}
                    </div>
                  )}
                  <div style={{ fontSize: 11, marginTop: 2 }}>{photo.caption || "No description provided."}</div>
                </td>
              ))}
              {pair.length === 1 && <td style={{ width: "50%" }} />}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
