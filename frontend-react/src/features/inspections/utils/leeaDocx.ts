// Word (.docx) versions of the four LEEA report forms - same boxes, order and
// wording as components/LeeaReportPages.tsx (the print/preview), built with
// the `docx` package. Like the rest of certificateDocxExport.ts this is not
// pixel-identical to the print: the red UNSAFE diagonal watermark becomes a red
// UNSAFE banner above the form (a floating rotated watermark isn't reliable
// across Word versions).
import {
  AlignmentType,
  BorderStyle,
  HeightRule,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TabStopType,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import type {
  InspectionCertificate,
  LooseGearDefectReportData,
  LooseGearMultipleItemsData,
  LooseGearStandardReportData,
  LooseGearYesNo,
} from "../types/inspection.types";
import { LOOSE_GEAR_STATUS_CODES } from "../data/inspectionHelpers";
import {
  HMZC_COMPANY_NAME_ADDRESS,
  HMZC_COMPANY_PHONE,
  LEEA_DOCS,
  LEEA_LOLER_STATEMENT,
  LEEA_MULTIPLE_STATEMENT,
  LEEA_REASON_CODES,
  LEEA_REPORT_TITLE,
  buildLeeaReportView,
  defectSheetAttached,
  isBlankRegisterRow,
  reasonCode,
  rowReason,
} from "../data/leeaReports";
import type { LeeaDocMeta } from "../data/leeaReports";

type Block = Paragraph | Table;

const SIDE = { style: BorderStyle.SINGLE, size: 4, color: "222222" };
const BOX = { top: SIDE, bottom: SIDE, left: SIDE, right: SIDE };
const FONT = "Calibri";
const SZ = 19; // half-points -> 9.5pt

function dateText(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function run(text: string, o: { bold?: boolean; size?: number; color?: string } = {}): TextRun {
  return new TextRun({ text, bold: o.bold, size: o.size ?? SZ, color: o.color, font: FONT });
}

function para(text: string, o: { bold?: boolean; size?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; color?: string; before?: number; after?: number } = {}): Paragraph {
  return new Paragraph({ alignment: o.align, spacing: { before: o.before ?? 0, after: o.after ?? 0 }, children: [run(text, o)] });
}

/** Free text with its own line breaks -> one paragraph per line. */
function lines(value: string | string[]): Paragraph[] {
  const list = Array.isArray(value) ? value : value.split("\n");
  const out = list.map((l) => para(l));
  return out.length ? out : [para("")];
}

function cap(text: string): Paragraph {
  return para(text);
}

interface CellOpts {
  w: number; // percent of the table width
  span?: number;
  rowSpan?: number;
  center?: boolean;
  vmid?: boolean;
  shade?: string;
  bold?: boolean;
}

function cell(content: Paragraph[] | string, o: CellOpts): TableCell {
  const children = typeof content === "string" ? [para(content, { bold: o.bold, align: o.center ? AlignmentType.CENTER : undefined })] : content;
  return new TableCell({
    width: { size: o.w, type: WidthType.PERCENTAGE },
    columnSpan: o.span,
    rowSpan: o.rowSpan,
    verticalAlign: o.vmid ? VerticalAlign.CENTER : VerticalAlign.TOP,
    shading: o.shade ? { fill: o.shade, type: ShadingType.CLEAR, color: "auto" } : undefined,
    borders: BOX,
    margins: { top: 40, bottom: 40, left: 90, right: 90 },
    children,
  });
}

function row(cells: TableCell[], minTwips?: number, header?: boolean): TableRow {
  return new TableRow({
    tableHeader: header,
    cantSplit: true,
    height: minTwips ? { value: minTwips, rule: HeightRule.ATLEAST } : undefined,
    children: cells,
  });
}

function table(rows: TableRow[], widthPct = 100): Table {
  return new Table({ width: { size: widthPct, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED, rows });
}

function gap(): Paragraph {
  return para("", { size: 12 });
}

/** YES [ ] NO [ ] as four cells whose widths come from the form's own grid. */
function yn(value: LooseGearYesNo, w: [number, number, number, number], rowSpan?: number): TableCell[] {
  return [
    cell("YES", { w: w[0], center: true, vmid: true, rowSpan }),
    cell(value === "yes" ? "✓" : "", { w: w[1], center: true, vmid: true, bold: true, rowSpan }),
    cell("NO", { w: w[2], center: true, vmid: true, rowSpan }),
    cell(value === "no" ? "✓" : "", { w: w[3], center: true, vmid: true, bold: true, rowSpan }),
  ];
}

function docHead(meta: LeeaDocMeta, extra?: string): Paragraph[] {
  const out: Paragraph[] = [];
  if (extra) out.push(para(extra, { size: 16, align: AlignmentType.RIGHT }));
  out.push(para(`Document Reference ${meta.reference}`, { size: 16, align: AlignmentType.RIGHT }));
  return out;
}

function docFoot(meta: LeeaDocMeta, widthTwips: number): Paragraph {
  return new Paragraph({
    spacing: { before: 160 },
    tabStops: [{ type: TabStopType.RIGHT, position: widthTwips }],
    children: [run(meta.version, { size: 15 }), run("\t", { size: 15 }), run(meta.originator, { size: 15 })],
  });
}

function issuedBy(cert: InspectionCertificate): Paragraph[] {
  if (!cert.issuedBy) return [];
  const when = cert.issuedAt ? ` — ${new Date(cert.issuedAt).toLocaleString()}` : "";
  return [para(`Issued by ${cert.issuedBy}${when}`, { size: 15, color: "555555", before: 60 })];
}

const PORTRAIT_WIDTH = 10100;
const LANDSCAPE_WIDTH = 15000;

// ---- LEEA-030.1a4 / 1b4 ----------------------------------------------------

export function buildLeeaReportBlocks(cert: InspectionCertificate, d: LooseGearStandardReportData, unsafe: boolean, signature: Paragraph[]): Block[] {
  const v = buildLeeaReportView(d, { vesselName: cert.vesselName, engineerName: cert.engineerName });
  const meta = unsafe ? LEEA_DOCS.unsafe : LEEA_DOCS.report;
  const blocks: Block[] = [...docHead(meta)];
  blocks.push(para(LEEA_REPORT_TITLE, { bold: true, size: 26, align: AlignmentType.CENTER, before: 80 }));
  blocks.push(para(LEEA_LOLER_STATEMENT, { size: 22, align: AlignmentType.CENTER, after: 120 }));
  if (unsafe) blocks.push(para("UNSAFE", { bold: true, size: 96, color: "FF0000", align: AlignmentType.CENTER }));

  blocks.push(table([row([
    cell(`Date of Thorough Examination: ${dateText(d.dateOfExamination)}`, { w: 32 }),
    cell(`Date of Report: ${dateText(d.dateOfReport)}`, { w: 34 }),
    cell(`Report number: ${cert.certNo}`, { w: 34 }),
  ], 330)]));
  blocks.push(table([row([
    cell([...lines(v.employer)], { w: 54.6 }),
    cell([...lines(v.premises)], { w: 45.4 }),
  ], 700)]));
  blocks.push(table([row([
    cell([...lines(v.identification)], { w: 54.6 }),
    cell([cap("Safe Working Load(s):"), ...lines(v.swl)], { w: 15 }),
    cell([cap("Date of manufacture if known:"), para(dateText(v.mfgDate))], { w: 15.2 }),
    cell([cap("Date of last thorough examination:"), para(dateText(v.prevExamDate))], { w: 15.2 }),
  ], 1150)]));

  // First-examination questions (left) and "was the examination carried out" (right).
  const L: [number, number, number, number] = [5.9, 3.8, 4.9, 4.8];
  const R: [number, number, number, number] = [7.2, 3.9, 5.4, 3.5];
  blocks.push(table([
    row([
      cell("Is this the first examination after installation or assembly at a new site or location?", { w: 32.2, rowSpan: 2, vmid: true }),
      ...yn(v.flags.firstExam, L, 2),
      cell("Was the examination carried out:", { w: 51.6, span: 5 }),
    ], 430),
    row([cell("Within an interval of 6 months?", { w: 28.5 }), ...yn(v.flags.within6Months, R)], 430),
    row([
      cell("If the answer to the above question is YES has the equipment been installed correctly?", { w: 32.2, rowSpan: 3, vmid: true }),
      ...yn(v.installedCorrectly, L, 3),
      cell("Within an interval of 12 months?", { w: 28.5 }), ...yn(v.flags.within12Months, R),
    ], 430),
    row([cell("In accordance with an examination scheme?", { w: 28.5 }), ...yn(v.flags.underScheme, R)], 430),
    row([cell("After the occurrence of exceptional circumstances?", { w: 28.5 }), ...yn(v.flags.exceptional, R)], 430),
  ]));

  blocks.push(table([row([
    cell([cap("Identification of any part found to have a defect which is or could become a danger to persons and a description of the defect:"), ...lines(v.defect)], { w: 100 }),
  ], 900)]));
  blocks.push(table([row([
    cell([new Paragraph({ children: [run("Is the above an existing or imminent danger to persons "), run("*Note", { bold: true }), run("-This is a reportable defect")] })], { w: 79.7 }),
    ...yn(v.imminentDanger, [6.5, 4.8, 4.6, 4.4]),
  ], 360)]));
  blocks.push(table([row([
    cell("Is the above a defect which is not yet but could become a danger to persons:", { w: 67.6 }),
    cell(`YES by: ${dateText(v.dangerByDate)}`, { w: 32.4 }),
  ], 440)]));
  blocks.push(table([row([cell([cap("Particulars of any repair, renewal or alteration required to remedy the defect identified above:"), ...lines(v.repair)], { w: 100 })], 720)]));
  blocks.push(table([row([cell([cap("Particulars of any tests carried out as part of the examination:"), ...lines(v.tests)], { w: 100 })], 720)]));

  blocks.push(gap());
  blocks.push(table([row([
    cell([new Paragraph({ children: [run("Observations / additional comments relative to this thorough examination", { bold: true })] }), ...lines(v.observations)], { w: 100 }),
  ], 900)]));
  blocks.push(gap());
  blocks.push(table([row([
    cell("IS THIS EQUIPMENT SAFE TO OPERATE?", { w: 79.7, bold: true, vmid: true }),
    ...yn(v.safeToOperate, [6.5, 4.8, 4.6, 4.4]),
  ], 520)]));
  blocks.push(table([
    row([
      cell([...lines(v.reporterNameQualifications)], { w: 31.5 }),
      cell([para(v.authenticatorName), ...signature], { w: 35.4 }),
      cell([para(dateText(v.nextExamDate))], { w: 33.1 }),
    ], 1000),
    row([cell([...lines(v.reporterEmployer)], { w: 100, span: 3 })], 720),
  ]));
  blocks.push(...issuedBy(cert), docFoot(meta, PORTRAIT_WIDTH));
  return blocks;
}

// ---- LEEA-030.1c4 (multiple items), landscape ---------------------------------

export function buildLeeaMultipleBlocks(cert: InspectionCertificate, d: LooseGearMultipleItemsData, signature: Paragraph[]): Block[] {
  const meta = LEEA_DOCS.multiple;
  const rows = d.rows.filter((r) => !isBlankRegisterRow(r));
  const attached = defectSheetAttached(d.rows);
  const blocks: Block[] = [...docHead(meta)];
  blocks.push(para("Report Of Thorough Examination", { bold: true, size: 26, align: AlignmentType.CENTER, before: 40 }));
  blocks.push(para(LEEA_MULTIPLE_STATEMENT, { bold: true, size: 20, align: AlignmentType.CENTER, after: 100 }));
  blocks.push(para(`Company Name & Address: ${HMZC_COMPANY_NAME_ADDRESS}    Phone: ${HMZC_COMPANY_PHONE}`, { size: 20 }));
  blocks.push(para(
    `Report No: ${cert.certNo}      Customer No: ${d.customerNo || ""}      Date of this Thorough Examination ${dateText(d.dateOfExamination)}      Date of Report: ${dateText(d.dateOfReport || cert.dateOfServicing)}      Colour code (if required): ${d.colourCode || ""}`,
    { size: 20, before: 80, after: 100 }
  ));

  blocks.push(table([row([
    cell([...lines(d.employerNameAddress || "")], { w: 39 }),
    cell([...lines([d.premisesAddress || "", cert.vesselName ? `Vessel: ${cert.vesselName}` : ""].filter(Boolean))], { w: 34.5 }),
    cell([para("Status:"), ...LOOSE_GEAR_STATUS_CODES.map((s) => para(`${s.label}${s.code === "ND" ? ":" : ""}`))], { w: 26.5 }),
  ], 900)]));
  blocks.push(gap());

  const widths = [9.2, 24.5, 4.5, 8.8, 8.8, 9.3, 8.5, 13.4, 7.2, 5.8];
  const heads = ["Identification Number", "Description", "WLL or SWL", "Date of Last Thorough Examination", "Date of Manufacture (if known)", "Latest Date of Next Thorough Examination", "Reason for Examination (See Below)", "Details of any Test", "Status (See above)", "Safe to Use Yes / No"];
  const headRow = row(heads.map((h, i) => cell([para(h, { bold: true, align: AlignmentType.CENTER })], { w: widths[i], vmid: true })), 600, true);
  const body = (rows.length ? rows : [null]).map((r) => {
    const vals = r
      ? [r.serialNo, r.description, r.swl, dateText(r.lastExamDate), dateText(r.mfgDate), dateText(r.nextInspectionDate), reasonCode(rowReason(r, d)), r.testDetails || "", r.result || "", r.safeToUse === "yes" ? "Yes" : r.safeToUse === "no" ? "No" : ""]
      : heads.map(() => "");
    return row(vals.map((t, i) => cell(t, { w: widths[i], center: i === 6 || i === 8 || i === 9 })), 330);
  });
  blocks.push(table([headRow, ...body]));
  blocks.push(gap());

  blocks.push(table([row([
    cell("Reason for Examination", { w: 17, bold: true }),
    ...LEEA_REASON_CODES.map((r) => cell([new Paragraph({ children: [run(`${r.label}: `), run(r.code, { bold: true })] })], { w: 16.6 })),
  ], 380)]));
  blocks.push(gap());
  blocks.push(table([row([
    cell([...lines([cert.engineerName, d.reportedByQualifications || ""].filter(Boolean))], { w: 47 }),
    cell([para(d.authenticatedByName || cert.engineerName), ...signature], { w: 53 }),
  ], 1000)]));
  blocks.push(gap());
  blocks.push(table([row([
    cell("Defect / Observation sheet attached?", { w: 56 }),
    cell("Yes", { w: 11, center: true }), cell(attached ? "✓" : "", { w: 10, center: true, bold: true }),
    cell("No", { w: 11, center: true }), cell(!attached && rows.length > 0 ? "✓" : "", { w: 12, center: true, bold: true }),
  ], 380)], 36));
  blocks.push(...issuedBy(cert), docFoot(meta, LANDSCAPE_WIDTH));
  return blocks;
}

// ---- LEEA-030.1d (defect report list), landscape --------------------------------

export function buildLeeaDefectBlocks(cert: InspectionCertificate, d: LooseGearDefectReportData): Block[] {
  const meta = LEEA_DOCS.defect;
  const defects = d.defects || [];
  const blocks: Block[] = [...docHead(meta, `Defect Report No: ${cert.certNo}`)];
  blocks.push(para("Report of Thorough Examination – Defect Report List", { bold: true, size: 30, align: AlignmentType.CENTER, before: 100, after: 140 }));
  blocks.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 140 },
    children: [run("This defect report refers to the equipment listed on the Thorough Examination report number: ", { size: 22 }), run(d.referencedReportNo || "", { size: 22, bold: true })],
  }));
  const widths = [9.7, 17.6, 22.4, 9.4, 13.2, 27.7];
  const heads = ["Equipment Identification Number", "Equipment Description", "Identification of Defective Parts", "Is the defect an existing or imminent danger *", "If not Immediate Danger, when will it become a danger without rectification", "Particulars of Any Repair, Renewal or Alteration to Remedy the Defects"];
  const headRow = row(heads.map((h, i) => cell([para(h, { bold: true, align: AlignmentType.CENTER })], { w: widths[i], vmid: true, shade: "D9D9D9" })), 600, true);
  const body = (defects.length ? defects : [null]).map((x) => {
    const vals = x
      ? [x.equipmentIdNo, x.equipmentDescription, x.defectiveParts, x.immediateDanger === "yes" ? "Yes" : x.immediateDanger === "no" ? "No" : "", x.immediateDanger === "yes" ? "N/A" : x.whenBecomesDanger, x.repairParticulars]
      : heads.map(() => "");
    return row(vals.map((t, i) => cell(t, { w: widths[i], center: i === 3 })), 330);
  });
  blocks.push(table([headRow, ...body]));
  blocks.push(para("*If yes must be reported to HSE", { bold: true, size: 22, before: 40, after: 160 }));
  blocks.push(table([row([
    cell([new Paragraph({ children: [run("Observations / additional comments relative to this thorough examination", { bold: true })] }), ...lines(d.defectObservations || "")], { w: 100 }),
  ], 1500)]));
  blocks.push(...issuedBy(cert), docFoot(meta, LANDSCAPE_WIDTH));
  return blocks;
}
