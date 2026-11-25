// Print/preview pages for the four LEEA report forms, laid out to match the
// LEEA originals (LEEA-030.1a4, 1b4, 1c4, 1d) cell for cell: same boxes in the
// same order, same wording, same YES/NO tick boxes. HMZC's own letterhead,
// QR code and approvals footer still come from CertFlow around these pages.
//
// What is deliberately NOT reproduced from the originals: the red italic
// "guidance only - remove before printing" notes (the originals say to remove
// them), and the blank placeholder logo box (HMZC's own letterhead sits there).
import { useEffect } from "react";
import type { ReactNode } from "react";
import type {
  InspectionCertificate,
  LooseGearDefectReportData,
  LooseGearMultipleItemsData,
  LooseGearStandardReportData,
  LooseGearYesNo,
} from "../types/inspection.types";
import { LOOSE_GEAR_STATUS_CODES } from "../data/inspectionHelpers";
import {
  LEEA_DOCS,
  LEEA_LOLER_STATEMENT,
  LEEA_MULTIPLE_STATEMENT,
  LEEA_REPORT_TITLE,
  LEEA_REASON_CODES,
  buildLeeaReportView,
  defectSheetAttached,
  isBlankRegisterRow,
  reasonCode,
  rowReason,
} from "../data/leeaReports";
import type { LeeaDocMeta } from "../data/leeaReports";

/** "12 Mar 2026", or empty (not an em dash) so an unfilled box stays blank like the paper form. */
function dateText(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * The LEEA register (1c4) and defect list (1d) are landscape A4 forms. The
 * app's global print page is portrait A4, so while one of them is on screen
 * a later @page rule turns it landscape (removed again on unmount so it can't
 * leak onto other printouts - same approach as utils/printFooter.ts).
 */
function useLandscapePrint() {
  useEffect(() => {
    const el = document.createElement("style");
    el.setAttribute("data-hmzc-landscape", "true");
    el.textContent = "@page { size: A4 landscape; }";
    document.head.appendChild(el);
    return () => el.remove();
  }, []);
}

function Section({ landscape, children }: { landscape?: boolean; children: ReactNode }) {
  return <section className={`insp-flow-section leea${landscape ? " leea-landscape" : ""}`}>{children}</section>;
}

function DocRef({ meta, extra }: { meta: LeeaDocMeta; extra?: ReactNode }) {
  return (
    <div className="leea-docref">
      {extra && <div>{extra}</div>}
      <div>Document Reference {meta.reference}</div>
    </div>
  );
}

function DocFooter({ meta }: { meta: LeeaDocMeta }) {
  return (
    <div className="leea-docfooter">
      <span>{meta.version}</span>
      <span>{meta.originator}</span>
    </div>
  );
}

/** YES [ ] NO [ ] as four cells; the ticked box carries a tick. */
function YesNoCells({ value }: { value: LooseGearYesNo }) {
  return (
    <>
      <td className="leea-yn">YES</td>
      <td className="leea-box">{value === "yes" ? "✓" : ""}</td>
      <td className="leea-yn">NO</td>
      <td className="leea-box">{value === "no" ? "✓" : ""}</td>
    </>
  );
}

function Lines({ lines }: { lines: string[] }) {
  return <>{lines.map((l, i) => <div key={i}>{l}</div>)}</>;
}

/** Multi-line free text (defect description, comments) keeping the author's line breaks. */
function Text({ value }: { value: string }) {
  return <div className="leea-text">{value}</div>;
}

function SignatureWithStamp({ cert }: { cert: InspectionCertificate }) {
  return (
    <span className="leea-sig">
      {cert.engineerSig ? (
        <img src={cert.engineerSig} alt="Signature" style={{ height: 38 }} />
      ) : cert.engineerName ? (
        <span style={{ fontFamily: "cursive", fontSize: 18 }}>{cert.engineerName}</span>
      ) : null}
      {/* The HMZC stamp over the signature, same overlay the other
          certificates use (see SignBox in CertificatePreview.tsx). */}
      <span role="img" aria-label="HMZC Official Stamp" className="leea-stamp" />
    </span>
  );
}

function IssuedBy({ cert }: { cert: InspectionCertificate }) {
  if (!cert.issuedBy) return null;
  return (
    <div className="leea-issued">
      Issued by {cert.issuedBy}{cert.issuedAt ? ` — ${new Date(cert.issuedAt).toLocaleString()}` : ""}
    </div>
  );
}

// ============================================================================
// LEEA-030.1a4 (safe) and LEEA-030.1b4 (unsafe, red watermark)
// ============================================================================
export function LeeaReportPage({ cert, data, unsafe }: { cert: InspectionCertificate; data: LooseGearStandardReportData; unsafe: boolean }) {
  const v = buildLeeaReportView(data, { vesselName: cert.vesselName, engineerName: cert.engineerName });
  const meta = unsafe ? LEEA_DOCS.unsafe : LEEA_DOCS.report;
  return (
    <Section>
      <DocRef meta={meta} />
      <div className="leea-title">{LEEA_REPORT_TITLE}</div>
      <div className="leea-subtitle">{LEEA_LOLER_STATEMENT}</div>

      <div className="leea-wm-host">
        {unsafe && <div className="leea-watermark" aria-hidden="true">Unsafe</div>}

        <table className="leea-grid">
          <colgroup><col style={{ width: "32%" }} /><col style={{ width: "34%" }} /><col style={{ width: "34%" }} /></colgroup>
          <tbody>
            <tr className="leea-h22">
              <td>Date of Thorough Examination: {dateText(data.dateOfExamination)}</td>
              <td>Date of Report: {dateText(data.dateOfReport)}</td>
              <td>Report number: {cert.certNo}</td>
            </tr>
          </tbody>
        </table>

        <table className="leea-grid leea-stack">
          <colgroup><col style={{ width: "54.6%" }} /><col style={{ width: "45.4%" }} /></colgroup>
          <tbody>
            <tr className="leea-h46">
              <td>
                <Text value={v.employer} />
              </td>
              <td>
                <Lines lines={v.premises} />
              </td>
            </tr>
          </tbody>
        </table>

        <table className="leea-grid leea-stack">
          <colgroup><col style={{ width: "54.6%" }} /><col style={{ width: "15%" }} /><col style={{ width: "15.2%" }} /><col style={{ width: "15.2%" }} /></colgroup>
          <tbody>
            <tr className="leea-h80">
              <td>
                <Lines lines={v.identification} />
              </td>
              <td><div className="leea-cap">Safe Working Load(s):</div><Text value={v.swl} /></td>
              <td><div className="leea-cap">Date of manufacture if known:</div>{dateText(v.mfgDate)}</td>
              <td><div className="leea-cap">Date of last thorough examination:</div>{dateText(v.prevExamDate)}</td>
            </tr>
          </tbody>
        </table>

        {/* The examination-type block: first-examination questions on the
            left, "Was the examination carried out" on the right. */}
        <table className="leea-grid leea-stack">
          <colgroup>
            <col style={{ width: "32.2%" }} /><col style={{ width: "5.9%" }} /><col style={{ width: "3.8%" }} /><col style={{ width: "4.9%" }} /><col style={{ width: "4.8%" }} />
            <col style={{ width: "28.5%" }} /><col style={{ width: "7.2%" }} /><col style={{ width: "3.9%" }} /><col style={{ width: "5.4%" }} /><col style={{ width: "3.5%" }} />
          </colgroup>
          <tbody>
            <tr className="leea-h30">
              <td rowSpan={2} className="leea-vmid">Is this the first examination after installation or assembly at a new site or location?</td>
              <YesNoCellsRowSpan value={v.flags.firstExam} rows={2} />
              <td colSpan={5} className="leea-nobb">Was the examination carried out:</td>
            </tr>
            <tr className="leea-h30">
              <td>Within an interval of 6 months?</td>
              <YesNoCells value={v.flags.within6Months} />
            </tr>
            <tr className="leea-h30">
              <td rowSpan={3} className="leea-vmid">If the answer to the above question is YES has the equipment been installed correctly?</td>
              <YesNoCellsRowSpan value={v.installedCorrectly} rows={3} />
              <td>Within an interval of 12 months?</td>
              <YesNoCells value={v.flags.within12Months} />
            </tr>
            <tr className="leea-h30">
              <td>In accordance with an examination scheme?</td>
              <YesNoCells value={v.flags.underScheme} />
            </tr>
            <tr className="leea-h30">
              <td>After the occurrence of exceptional circumstances?</td>
              <YesNoCells value={v.flags.exceptional} />
            </tr>
          </tbody>
        </table>

        <table className="leea-grid leea-stack">
          <tbody>
            <tr className="leea-h62">
              <td>
                <div className="leea-cap">Identification of any part found to have a defect which is or could become a danger to persons and a description of the defect:</div>
                <Text value={v.defect} />
              </td>
            </tr>
          </tbody>
        </table>

        <table className="leea-grid leea-stack">
          <colgroup><col style={{ width: "79.7%" }} /><col style={{ width: "6.5%" }} /><col style={{ width: "4.8%" }} /><col style={{ width: "4.6%" }} /><col style={{ width: "4.4%" }} /></colgroup>
          <tbody>
            <tr className="leea-h24">
              <td>Is the above an existing or imminent danger to persons <strong>*Note</strong>-This is a reportable defect</td>
              <YesNoCells value={v.imminentDanger} />
            </tr>
          </tbody>
        </table>

        <table className="leea-grid leea-stack">
          <colgroup><col style={{ width: "67.6%" }} /><col style={{ width: "32.4%" }} /></colgroup>
          <tbody>
            <tr className="leea-h30">
              <td>Is the above a defect which is not yet but could become a danger to persons:</td>
              <td>YES by: {dateText(v.dangerByDate)}</td>
            </tr>
          </tbody>
        </table>

        <table className="leea-grid leea-stack">
          <tbody>
            <tr className="leea-h50">
              <td>
                <div className="leea-cap">Particulars of any repair, renewal or alteration required to remedy the defect identified above:</div>
                <Text value={v.repair} />
              </td>
            </tr>
          </tbody>
        </table>

        <table className="leea-grid leea-stack">
          <tbody>
            <tr className="leea-h50">
              <td>
                <div className="leea-cap">Particulars of any tests carried out as part of the examination:</div>
                <Text value={v.tests} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <table className="leea-grid leea-gap">
        <tbody>
          <tr className="leea-h62">
            <td>
              <div className="leea-cap"><strong>Observations / additional comments relative to this thorough examination</strong></div>
              <Text value={v.observations} />
            </td>
          </tr>
        </tbody>
      </table>

      <table className="leea-grid leea-gap leea-keep">
        <colgroup><col style={{ width: "79.7%" }} /><col style={{ width: "6.5%" }} /><col style={{ width: "4.8%" }} /><col style={{ width: "4.6%" }} /><col style={{ width: "4.4%" }} /></colgroup>
        <tbody>
          <tr className="leea-h36">
            <td className="leea-vmid"><strong>IS THIS EQUIPMENT SAFE TO OPERATE?</strong></td>
            <YesNoCells value={v.safeToOperate} />
          </tr>
        </tbody>
      </table>
      <table className="leea-grid leea-stack leea-keep">
        <colgroup><col style={{ width: "31.5%" }} /><col style={{ width: "35.4%" }} /><col style={{ width: "33.1%" }} /></colgroup>
        <tbody>
          <tr className="leea-h66">
            <td>
              <Lines lines={v.reporterNameQualifications} />
            </td>
            <td>
              <div>{v.authenticatorName}</div>
              <div className="leea-signline"><SignatureWithStamp cert={cert} /></div>
            </td>
            <td>
              {dateText(v.nextExamDate)}
            </td>
          </tr>
          <tr className="leea-h50">
            <td colSpan={3}>
              <Text value={v.reporterEmployer} />
            </td>
          </tr>
        </tbody>
      </table>
      <IssuedBy cert={cert} />
      <DocFooter meta={meta} />
    </Section>
  );
}

/** YES/NO for a question spanning several rows: the first two cells span, the rest are empty-free. */
function YesNoCellsRowSpan({ value, rows }: { value: LooseGearYesNo; rows: number }) {
  return (
    <>
      <td rowSpan={rows} className="leea-yn leea-vmid">YES</td>
      <td rowSpan={rows} className="leea-box leea-vmid">{value === "yes" ? "✓" : ""}</td>
      <td rowSpan={rows} className="leea-yn leea-vmid">NO</td>
      <td rowSpan={rows} className="leea-box leea-vmid">{value === "no" ? "✓" : ""}</td>
    </>
  );
}

// ============================================================================
// LEEA-030.1c4 - Report of Thorough Examination (multiple items), landscape
// ============================================================================
export function LeeaMultiplePage({ cert, data }: { cert: InspectionCertificate; data: LooseGearMultipleItemsData }) {
  useLandscapePrint();
  const meta = LEEA_DOCS.multiple;
  const rows = data.rows.filter((r) => !isBlankRegisterRow(r));
  const attached = defectSheetAttached(data.rows);
  return (
    <Section landscape>
      <DocRef meta={meta} />
      <div className="leea-title leea-title-sm">Report Of Thorough Examination</div>
      <div className="leea-subtitle leea-subtitle-b">{LEEA_MULTIPLE_STATEMENT}</div>

      <div className="leea-line leea-line-spread">
        <span>Report No: {cert.certNo}</span>
        <span>Customer No: {data.customerNo || ""}</span>
        <span>Date of this Thorough Examination {dateText(data.dateOfExamination)}</span>
        <span>Date of Report: {dateText(data.dateOfReport || cert.dateOfServicing)}</span>
        <span>Colour code (if required): {data.colourCode || ""}</span>
      </div>

      <table className="leea-grid">
        <colgroup><col style={{ width: "39%" }} /><col style={{ width: "34.5%" }} /><col style={{ width: "26.5%" }} /></colgroup>
        <tbody>
          <tr className="leea-h62">
            <td>
              <Text value={data.employerNameAddress || ""} />
            </td>
            <td>
              <Lines lines={[data.premisesAddress || "", cert.vesselName ? `Vessel: ${cert.vesselName}` : ""].filter(Boolean)} />
            </td>
            <td>
              <div>Status:</div>
              {LOOSE_GEAR_STATUS_CODES.map((s) => <div key={s.code}>{s.label}{s.code === "ND" ? ":" : ""}</div>)}
            </td>
          </tr>
        </tbody>
      </table>

      <table className="leea-grid leea-reg leea-gap">
        <colgroup>
          <col style={{ width: "9.2%" }} /><col style={{ width: "24.5%" }} /><col style={{ width: "4.5%" }} /><col style={{ width: "8.8%" }} /><col style={{ width: "8.8%" }} />
          <col style={{ width: "9.3%" }} /><col style={{ width: "8.5%" }} /><col style={{ width: "13.4%" }} /><col style={{ width: "7.2%" }} /><col style={{ width: "5.8%" }} />
        </colgroup>
        <thead>
          <tr>
            <th>Identification Number</th>
            <th>Description</th>
            <th>WLL<br />or<br />SWL</th>
            <th>Date of Last Thorough Examination</th>
            <th>Date of Manufacture (if known)</th>
            <th>Latest Date of Next Thorough Examination</th>
            <th>Reason for Examination (See Below)</th>
            <th>Details of any Test</th>
            <th>Status (See above)</th>
            <th>Safe to Use<br />Yes / No</th>
          </tr>
        </thead>
        <tbody>
          {(rows.length ? rows : [null]).map((r, i) => (
            <tr key={i} className="leea-datarow">
              <td>{r?.serialNo || ""}</td>
              <td>{r?.description || ""}</td>
              <td>{r?.swl || ""}</td>
              <td>{dateText(r?.lastExamDate)}</td>
              <td>{dateText(r?.mfgDate)}</td>
              <td>{dateText(r?.nextInspectionDate)}</td>
              <td className="leea-center">{r ? reasonCode(rowReason(r, data)) : ""}</td>
              <td>{r?.testDetails || ""}</td>
              <td className="leea-center">{r?.result || ""}</td>
              <td className="leea-center">{r?.safeToUse === "yes" ? "Yes" : r?.safeToUse === "no" ? "No" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="leea-grid leea-gap leea-keep">
        <tbody>
          <tr className="leea-h24">
            <td style={{ width: "17%" }}><strong>Reason for Examination</strong></td>
            {LEEA_REASON_CODES.map((r) => (
              <td key={r.value}>{r.label}: <strong>{r.code}</strong></td>
            ))}
          </tr>
        </tbody>
      </table>

      <table className="leea-grid leea-gap leea-keep">
        <colgroup><col style={{ width: "47%" }} /><col style={{ width: "53%" }} /></colgroup>
        <tbody>
          <tr className="leea-h66">
            <td>
              <Lines lines={[cert.engineerName, data.reportedByQualifications || ""].filter(Boolean)} />
            </td>
            <td>
              <div>{data.authenticatedByName || cert.engineerName}</div>
              <div className="leea-signline"><SignatureWithStamp cert={cert} /></div>
            </td>
          </tr>
        </tbody>
      </table>

      <table className="leea-grid leea-gap leea-keep" style={{ width: "36%" }}>
        <tbody>
          <tr className="leea-h24">
            <td>Defect / Observation sheet attached?</td>
            <td className="leea-yn" style={{ width: 34 }}>Yes</td>
            <td className="leea-box">{attached ? "✓" : ""}</td>
            <td className="leea-yn" style={{ width: 28 }}>No</td>
            <td className="leea-box">{!attached && rows.length > 0 ? "✓" : ""}</td>
          </tr>
        </tbody>
      </table>
      <IssuedBy cert={cert} />
      <DocFooter meta={meta} />
    </Section>
  );
}

// ============================================================================
// LEEA-030.1d - Defect Report List, landscape
// ============================================================================
export function LeeaDefectPage({ cert, data }: { cert: InspectionCertificate; data: LooseGearDefectReportData }) {
  useLandscapePrint();
  const meta = LEEA_DOCS.defect;
  const defects = data.defects || [];
  return (
    <Section landscape>
      <DocRef meta={meta} extra={`Defect Report No: ${cert.certNo}`} />
      <div className="leea-title leea-title-lg">Report of Thorough Examination – Defect Report List</div>
      <div className="leea-center leea-intro">
        This defect report refers to the equipment listed on the Thorough Examination report number: <strong>{data.referencedReportNo || ""}</strong>
      </div>

      <table className="leea-grid leea-reg leea-defects">
        <colgroup>
          <col style={{ width: "9.7%" }} /><col style={{ width: "17.6%" }} /><col style={{ width: "22.4%" }} />
          <col style={{ width: "9.4%" }} /><col style={{ width: "13.2%" }} /><col style={{ width: "27.7%" }} />
        </colgroup>
        <thead>
          <tr className="leea-grey">
            <th>Equipment Identification Number</th>
            <th>Equipment Description</th>
            <th>Identification of Defective Parts</th>
            <th>Is the defect an existing or imminent danger *</th>
            <th>If not Immediate Danger, when will it become a danger without rectification</th>
            <th>Particulars of Any Repair, Renewal or Alteration to Remedy the Defects</th>
          </tr>
        </thead>
        <tbody>
          {(defects.length ? defects : [null]).map((d, i) => (
            <tr key={i} className="leea-datarow">
              <td>{d?.equipmentIdNo || ""}</td>
              <td>{d?.equipmentDescription || ""}</td>
              <td>{d?.defectiveParts || ""}</td>
              <td className="leea-center">{d?.immediateDanger === "yes" ? "Yes" : d?.immediateDanger === "no" ? "No" : ""}</td>
              <td>{d ? (d.immediateDanger === "yes" ? "N/A" : d.whenBecomesDanger) : ""}</td>
              <td>{d?.repairParticulars || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="leea-hse">*If yes must be reported to HSE</div>

      <table className="leea-grid leea-gap leea-keep">
        <tbody>
          <tr className="leea-h110">
            <td>
              <div className="leea-cap"><strong>Observations / additional comments relative to this thorough examination</strong></div>
              <Text value={data.defectObservations || ""} />
            </td>
          </tr>
        </tbody>
      </table>
      <IssuedBy cert={cert} />
      <DocFooter meta={meta} />
    </Section>
  );
}
