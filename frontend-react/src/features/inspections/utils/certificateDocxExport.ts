// Requested directly: "let's see if we can give option to print, save
// in pdf or in word file" — Print already covers PDF (every browser's
// print dialog offers "Save as PDF" as a destination), so this adds
// the one genuinely missing option: a real .docx file.
//
// Built client-side with the `docx` package rather than converting the
// certificate's print HTML to Word — the print layout leans on several
// browser-only tricks (a <table> thead/tfoot standing in for a running
// header/footer, an absolutely-positioned rotated stamp overlay) that
// an HTML-to-DOCX converter would either drop or render incorrectly.
// Word has its own native repeating header/footer per section, so this
// builds the document directly against that instead: one Header/Footer
// for the whole file, real docx Tables for every data grid, and the
// same branching CertificatePreview.tsx uses (by cert.type/config.kind)
// so the content matches what's on screen.
//
// Deliberately not pixel-identical to the print/PDF output — same
// spirit as core/invoice_pdf.py's own reportlab-built PDF on the
// backend ("the same information in the same order... not a literal
// rendering of that component"). Two things dropped for that reason:
// the QR code (the cert number is already printed in the header/
// footer text) and the four approval-body logo images (named in the
// footer text instead) — and the stamp is embedded as a plain inline
// image under the signature rather than the rotated overlay the print
// CSS achieves, since replicating a floating rotated image reliably
// across Word versions wasn't worth the added complexity for a
// cosmetic effect.
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import {
  ChecklistSection,
  ChecklistStatus,
  EquipmentTypeConfig,
  EquipResult,
  FFEData,
  CalibrationData,
  InspectionCertificate,
  LooseGearData,
  LooseGearStatutoryAnswers,
  LooseGearYesNo,
} from "../types/inspection.types";
import { getFFEConfig } from "../data/ffeCertTypes";
import { getCalibrationConfig } from "../data/calibrationCertTypes";
import { HMZC_LOGO_DATA_URI } from "../assets/logo";
import { HMZC_STAMP_DATA_URI } from "../assets/stamp";

const NAVY = "1F3B5C";
const MUTED = "6B7480";
const LINE = "DCE1E5";
const LIGHT_FILL = "F1F3F4";

type Block = Paragraph | Table;

// ---- formatting helpers (mirror CertificatePreview.tsx's own) ----

function fmtDate(iso?: string | null): string {
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
function checklistResultLabel(r: string) {
  return { done: "Carried Out", not_done: "Not Carried Out", na: "N/A", "": "—" }[r] || r;
}
function yesNoLabel(v: LooseGearYesNo) {
  return { yes: "YES", no: "NO", "": "—" }[v] || v;
}

// ---- image helpers ----

function dataUriToBytes(dataUri: string): Uint8Array {
  const base64 = dataUri.split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function docxImageType(dataUri: string): "jpg" | "png" | "gif" | "bmp" | null {
  const m = dataUri.match(/^data:image\/(\w+);base64,/);
  if (!m) return null;
  const mime = m[1].toLowerCase();
  if (mime === "jpeg" || mime === "jpg") return "jpg";
  if (mime === "png" || mime === "gif" || mime === "bmp") return mime as "png" | "gif" | "bmp";
  return null;
}

function loadImageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

function docxImageTypeFromExtension(url: string): "jpg" | "png" | "gif" | "bmp" | null {
  const ext = url.split(/[?#]/)[0].split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "jpg";
  if (ext === "png" || ext === "gif" || ext === "bmp") return ext as "png" | "gif" | "bmp";
  return null;
}

// Photo evidence (PhotoEvidence.data — see inspection.types.ts) is a
// data: URI only until the certificate has been saved at least once;
// core/photo_storage.py's externalize_photos then replaces it with a
// real /api/photos/... URL, which is what a *finalized* certificate
// (the only state Save as Word is available for — see
// InspectionWorkspace.tsx's canExportWord) actually has. The
// signature/stamp/logo helpers below only ever dealt with data: URIs
// before photos existed here, so this fetches bytes over the network
// for anything that isn't one, rather than assuming every image src
// is inline.
async function loadImageBytes(src: string): Promise<{ bytes: Uint8Array; type: "jpg" | "png" | "gif" | "bmp" } | null> {
  if (src.startsWith("data:")) {
    const type = docxImageType(src);
    if (!type) return null;
    return { bytes: dataUriToBytes(src), type };
  }
  const type = docxImageTypeFromExtension(src);
  if (!type) return null;
  try {
    const resp = await fetch(src);
    if (!resp.ok) return null;
    return { bytes: new Uint8Array(await resp.arrayBuffer()), type };
  } catch {
    return null;
  }
}

// Signature/upload images can be any aspect ratio the user drew or
// uploaded (unlike the fixed logo/stamp assets) — scaled to a fixed
// display height, matching SignBox's own 60px-tall <img> in print.
async function imageRunAtHeight(src: string, targetHeight: number): Promise<ImageRun | null> {
  try {
    const [{ width, height }, loaded] = await Promise.all([loadImageSize(src), loadImageBytes(src)]);
    if (!loaded) return null;
    const scale = targetHeight / height;
    return new ImageRun({
      type: loaded.type,
      data: loaded.bytes,
      transformation: { width: Math.max(1, Math.round(width * scale)), height: targetHeight },
    } as ConstructorParameters<typeof ImageRun>[0]);
  } catch {
    return null;
  }
}

// Same idea as imageRunAtHeight but scaled to fit within a fixed
// width instead — used for the Photo Report's evidence photos, which
// (unlike a signature) should fill their table cell width rather than
// a fixed height regardless of how tall/wide the source photo is.
async function imageRunAtWidth(src: string, targetWidth: number): Promise<ImageRun | null> {
  try {
    const [{ width, height }, loaded] = await Promise.all([loadImageSize(src), loadImageBytes(src)]);
    if (!loaded) return null;
    const scale = targetWidth / width;
    return new ImageRun({
      type: loaded.type,
      data: loaded.bytes,
      transformation: { width: targetWidth, height: Math.max(1, Math.round(height * scale)) },
    } as ConstructorParameters<typeof ImageRun>[0]);
  } catch {
    return null;
  }
}

// ---- paragraph/table building blocks ----

function textP(text: string, opts: { bold?: boolean; color?: string; size?: number; italics?: boolean } = {}): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: opts.bold, color: opts.color, size: opts.size ?? 20, italics: opts.italics })],
  });
}

function heading(text: string, pageBreakBefore = false): Paragraph {
  return new Paragraph({
    pageBreakBefore,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, color: NAVY, size: 22 })],
  });
}

function badgeLine(title: string, badge: string): Paragraph {
  return new Paragraph({
    spacing: { after: 160 },
    children: [
      new TextRun({ text: title, bold: true, color: NAVY, size: 28 }),
      new TextRun({ text: `   [${badge}]`, bold: true, color: MUTED, size: 18 }),
    ],
  });
}

function cell(text: string, opts: { bold?: boolean; shaded?: boolean; widthPct?: number; colSpan?: number } = {}): TableCell {
  return new TableCell({
    width: opts.widthPct ? { size: opts.widthPct, type: WidthType.PERCENTAGE } : undefined,
    columnSpan: opts.colSpan,
    shading: opts.shaded ? { fill: LIGHT_FILL, type: ShadingType.CLEAR, color: "auto" } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [textP(text, { bold: opts.bold, size: 18 })],
  });
}

const THIN_BORDER = { style: BorderStyle.SINGLE, size: 2, color: LINE };
const TABLE_BORDERS = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER, insideHorizontal: THIN_BORDER, insideVertical: THIN_BORDER };

// A simple label:value grid — one row per pair, label column shaded and
// bold. Flattened to 2 columns rather than CertificatePreview.tsx's own
// 4-column (label/value/label/value) grids — same content, simpler to
// generate and to read as a Word table.
function kvTable(pairs: Array<[string, string]>): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TABLE_BORDERS,
    rows: pairs.map(
      ([label, value]) =>
        new TableRow({
          children: [cell(label, { bold: true, shaded: true, widthPct: 32 }), cell(value || "—", { widthPct: 68 })],
        })
    ),
  });
}

function dataTable(headers: string[], rows: string[][]): Table {
  const widthPct = 100 / headers.length;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TABLE_BORDERS,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((h) => cell(h, { bold: true, shaded: true, widthPct })),
      }),
      ...rows.map((r) => new TableRow({ children: r.map((v) => cell(v || "—", { widthPct })) })),
    ],
  });
}

function remarksBox(label: string, text: string): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TABLE_BORDERS,
    rows: [new TableRow({ children: [cell(`${label}: ${text || "None"}`, { shaded: true })] })],
  });
}

// Certificate No. row repeated at the top of every data table in the
// print version (CertNoTheadRow) exists there because a <thead> is the
// only thing that reliably repeats across physical printed pages. Word
// doesn't need that trick — the certificate number is already in this
// document's own repeating header/footer (see exportCertificateDocx) —
// so no equivalent is built here.
function checklistTable(certNo: string, sections: ChecklistSection[]): Table {
  const rows: TableRow[] = [
    new TableRow({ tableHeader: true, children: [cell("Item", { bold: true, shaded: true, widthPct: 55 }), cell("Result", { bold: true, shaded: true, widthPct: 20 }), cell("Remarks", { bold: true, shaded: true, widthPct: 25 })] }),
  ];
  for (const sec of sections) {
    rows.push(new TableRow({ children: [cell(`${sec.code}. ${sec.name}`, { bold: true, shaded: true, colSpan: 3 })] }));
    for (const it of sec.items) {
      rows.push(new TableRow({ children: [cell(it.label, { widthPct: 55 }), cell(statusLabel(it.status), { widthPct: 20 }), cell(it.remark || "—", { widthPct: 25 })] }));
    }
    for (const it of sec.special) {
      rows.push(new TableRow({ children: [cell(`${it.label} (${it.presetRemark})`, { widthPct: 55 }), cell(statusLabel(it.status), { widthPct: 20 }), cell(it.remark || "—", { widthPct: 25 })] }));
    }
  }
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: TABLE_BORDERS, rows });
}

// ---- signature block (shared by every certificate kind) ----

async function signCellContent(label: string, name: string, sig: string, stamp: boolean): Promise<Paragraph[]> {
  const out: Paragraph[] = [];
  const sigRun = sig ? await imageRunAtHeight(sig, 68) : null;
  if (sigRun) {
    out.push(new Paragraph({ children: [sigRun] }));
  } else if (name) {
    out.push(new Paragraph({ children: [new TextRun({ text: name, italics: true, color: NAVY, size: 26 })] }));
  }
  if (sig && name) out.push(textP(name, { size: 16 }));
  out.push(new Paragraph({ children: [new TextRun({ text: label.toUpperCase(), color: MUTED, size: 14 })] }));
  if (stamp) {
    const stampRun = await imageRunAtHeight(HMZC_STAMP_DATA_URI, 54);
    if (stampRun) out.push(new Paragraph({ spacing: { before: 80 }, children: [stampRun] }));
  }
  return out;
}

// Requested directly, reviewing a real CRALOG-issued certificate for
// comparison: their statements close with one unambiguous declaration —
// "The equipment remains FIT FOR PURPOSE: Yes/No" — separate from any
// individual checklist item's own result. Matches CertificatePreview.tsx's
// SignatureGrid (see InspectionCertificate.fitForPurpose's own comment
// for which certificate kinds carry this and why). hideFitForPurpose
// mirrors that same component's prop for Loose Gear's Visual
// Certificate/Multiple Items sections, which already ask their own
// per-item pass/fail question(s).
async function signatureBlock(cert: InspectionCertificate, masterLabel: string, techLabel: string, hideFitForPurpose?: boolean): Promise<Block[]> {
  const [masterContent, techContent] = await Promise.all([
    signCellContent(masterLabel, cert.captainName, cert.captainSig, false),
    signCellContent(techLabel, cert.engineerName, cert.engineerSig, true),
  ]);
  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: THIN_BORDER, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
    rows: [
      new TableRow({
        children: [
          new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, margins: { top: 120, right: 200 }, children: masterContent }),
          new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, margins: { top: 120, left: 200 }, children: techContent }),
        ],
      }),
    ],
  });
  if (hideFitForPurpose) return [table];
  const declaration = new Paragraph({
    spacing: { before: 120 },
    children: [
      new TextRun({ text: "The equipment remains FIT FOR PURPOSE: ", bold: true, color: NAVY, size: 18 }),
      new TextRun({ text: yesNoLabel(cert.fitForPurpose || ""), bold: true, size: 18 }),
    ],
  });
  return [declaration, table];
}

// Requested directly: "make the examiner sign of section just as in
// the pdf loaded... remove the previous examiner sign and master sign
// section on the lose gear" — matches the reference's own
// "Examination Carried Out By / Examiner Details" grid (Name,
// Signature) rather than the shared Master+Technician
// signatureBlock() every other certificate kind uses; there is no
// Master/Captain row here at all, matching StandardReportPage's print
// layout in CertificatePreview.tsx. Position and LEEA ID Number were
// removed on later request.
async function examinerDetailsTable(cert: InspectionCertificate): Promise<Table> {
  const [sigRun, stampRun] = await Promise.all([
    cert.engineerSig ? imageRunAtHeight(cert.engineerSig, 54) : Promise.resolve(null),
    imageRunAtHeight(HMZC_STAMP_DATA_URI, 46),
  ]);
  const sigContent: Paragraph[] = sigRun
    ? [new Paragraph({ children: [sigRun] })]
    : cert.engineerName
    ? [new Paragraph({ children: [new TextRun({ text: cert.engineerName, italics: true, color: NAVY, size: 22 })] })]
    : [textP("—")];
  // Requested directly: "the stamp is removed from the Lose gear
  // certificate, you need to bring it back" — this report doesn't use
  // the shared signatureBlock()/signCellContent() (see this function's
  // own top comment for why), so the stamp that would normally come
  // from signCellContent's own `stamp` branch is added here instead,
  // directly under the Examiner's signature.
  if (stampRun) sigContent.push(new Paragraph({ spacing: { before: 40 }, children: [stampRun] }));

  function fieldCell(label: string, content: string | Paragraph[], opts: { rowSpan?: number; widthPct?: number } = {}): TableCell {
    const body = Array.isArray(content) ? content : [textP(content || "—", { size: 18 })];
    return new TableCell({
      rowSpan: opts.rowSpan,
      width: opts.widthPct ? { size: opts.widthPct, type: WidthType.PERCENTAGE } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [textP(label.toUpperCase(), { bold: true, size: 14, color: MUTED }), ...body],
    });
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TABLE_BORDERS,
    rows: [
      new TableRow({
        children: [
          fieldCell("Examination Carried Out By", "", { rowSpan: 2, widthPct: 28 }),
          fieldCell("Name", cert.engineerName || "—", { widthPct: 72 }),
        ],
      }),
      new TableRow({ children: [fieldCell("Signature", sigContent)] }),
    ],
  });
}

function issuedByLine(cert: InspectionCertificate): Paragraph[] {
  if (!cert.issuedBy) return [];
  const when = cert.issuedAt ? ` — ${new Date(cert.issuedAt).toLocaleString()}` : "";
  return [textP(`Issued by ${cert.issuedBy}${when}`, { color: MUTED, size: 16 })];
}

// ---- per-kind section builders ----

async function buildStatementSection(cert: InspectionCertificate, config: EquipmentTypeConfig): Promise<Block[]> {
  const isBoat = config.kind === "boat";
  const blocks: Block[] = [
    badgeLine("Statement", config.typeName.toUpperCase()),
    textP(config.statementIntro || "", { size: 18 }),
    new Paragraph({ text: "" }),
  ];

  const pairs: Array<[string, string]> = [
    ["Certificate No", cert.certNo],
    ["Date of Servicing", fmtDate(cert.dateOfServicing)],
    ["Name of Ship", cert.vesselName || "—"],
    ["IMO No.", cert.imoNo || "—"],
    ["Flag", cert.flag || "—"],
    [isBoat ? "Location on Board" : "Crane Location", cert.location || "—"],
  ];
  if (isBoat) {
    pairs.push(
      [config.label, `Type: ${cert.boat?.typeName || "—"} | Mfg: ${cert.boat?.mfgDate || "—"}`],
      ["Serial No. / Capacity", `${cert.boat?.serial || "—"} / ${cert.capacity || "—"}`],
      ["Manufacturer", cert.boat?.manufacturer || "—"],
      ["Release Mechanism", `Type: ${cert.release?.typeName || "—"} | Mfg: ${cert.release?.mfgDate || "—"}`],
      ["Release — Serial / Manufacturer", `${cert.release?.serial || "—"} / ${cert.release?.manufacturer || "—"}`],
      ["Davit", `Type: ${cert.davit?.typeName || "—"} | Mfg: ${cert.davit?.mfgDate || "—"}`],
      ["Davit — Serial / Manufacturer", `${cert.davit?.serial || "—"} / ${cert.davit?.manufacturer || "—"}`],
      ["Winch", `Type: ${cert.winch?.typeName || "—"} | Mfg: ${cert.winch?.mfgDate || "—"}`],
      ["Winch — Serial / Manufacturer", `${cert.winch?.serial || "—"} / ${cert.winch?.manufacturer || "—"}`]
    );
  } else {
    pairs.push(
      ["Crane", `Type: ${cert.crane?.typeName || "—"}`],
      ["SWL", cert.crane?.swl || "—"],
      ["Wire Rope", `Type: ${cert.wireRope?.typeName || "—"}`],
      ["Diameter", cert.wireRope?.diameter || "—"]
    );
  }
  pairs.push(["Last Serviced", fmtDate(cert.lastServicing)], ["Port", cert.portServicing || "—"], ["Kind of Servicing", cert.kindOfServicing]);

  blocks.push(kvTable(pairs), new Paragraph({ text: "" }), remarksBox("Remarks", cert.remarks), new Paragraph({ text: "" }), ...issuedByLine(cert));
  blocks.push(...(await signatureBlock(cert, "Captain Signature", "Service Engineer")));
  return blocks;
}

async function buildChecklistSection(title: string, cert: InspectionCertificate, sections: ChecklistSection[], outstandingKey: string): Promise<Block[]> {
  const blocks: Block[] = [heading(title, true), checklistTable(cert.certNo, sections), new Paragraph({ text: "" })];
  const outstanding = (cert.outstanding && cert.outstanding[outstandingKey]) || "None";
  blocks.push(remarksBox("Outstanding Issues / Defects Raised", outstanding), new Paragraph({ text: "" }));
  blocks.push(...(await signatureBlock(cert, "Captain Signature", "Service Engineer")));
  return blocks;
}

// Requested directly, reviewing a real CRALOG-issued certificate for
// comparison: theirs closes with an "Explanatory remarks" page defining
// exactly what each result column means, plus the regulatory basis —
// see CertificatePreview.tsx's identical ExplanatoryNotesPage for the
// full reasoning on why this is a general glossary, not a fabricated
// per-item paragraph citation. Boat/crane types only, matching that
// component's own scoping.
function buildExplanatoryNotesSection(config: EquipmentTypeConfig): Block[] {
  return [
    heading("Explanatory Notes", true),
    textP(config.statementIntro || "", { size: 18 }),
    new Paragraph({ text: "" }),
    heading("Checklist Result Key"),
    kvTable([
      ["Good", "Item inspected and found in satisfactory condition — no action required."],
      ["Part-Ex", "Partially exceptions taken — item is usable but has a noted defect or wear that should be monitored or addressed at the next opportunity."],
      ["Repair", "Item requires repair, adjustment, or replacement before it can be considered satisfactory."],
      ["N/A", "Not applicable to this particular installation or configuration."],
    ]),
    new Paragraph({ text: "" }),
    textP(
      "This inspection was carried out in accordance with the regulatory basis stated in this certificate's Statement page. Individual checklist item results and any remarks recorded above reflect the condition found at the time of this inspection.",
      { size: 14, color: MUTED }
    ),
  ];
}

async function buildEquipmentListSection(cert: InspectionCertificate, config: EquipmentTypeConfig): Promise<Block[]> {
  const rows = (cert.equip || []).map((e) => [e.n, e.qty, e.unit, equipLabel(e.result), e.remark || "—"]);
  const blocks: Block[] = [heading(config.equipListTitle || "Equipment List", true), dataTable(["Item", "Qty", "Unit", "Result", "Remarks"], rows), new Paragraph({ text: "" })];
  blocks.push(...(await signatureBlock(cert, "Captain Signature", "Service Engineer")));
  return blocks;
}

async function buildFFESection(cert: InspectionCertificate, ffe: FFEData): Promise<Block[]> {
  const cfg = getFFEConfig(ffe.subType);
  const blocks: Block[] = [badgeLine("Certificate & Checklist", cfg.label.toUpperCase())];
  blocks.push(
    kvTable([
      ["Vessel", cert.vesselName || "—"],
      ["Certificate No", cert.certNo],
      ["IMO No", cert.imoNo || "—"],
      ["Date", fmtDate(cert.dateOfServicing)],
      ["Class/Flag", ffe.certClass || "—"],
      ["Place of Service", ffe.placeOfService || "—"],
    ])
  );
  if (cfg.technicalFields?.length) {
    blocks.push(heading("Technical Description"), kvTable(cfg.technicalFields.map((f) => [f.label, ffe.technicalValues[f.key] || "—"] as [string, string])));
  }
  // Requested directly: the reference-standard note (e.g. Air Quality
  // Test's "Reference limits per EN 12021 and DIN-3188.") was already
  // shown on-screen (FFEForm.tsx) and in the print preview
  // (CertificatePreview.tsx) but missing from the actual Word-exported
  // certificate — the document that's really handed to a client.
  if (cfg.note) {
    blocks.push(textP(cfg.note, { size: 16, color: MUTED }));
  }
  function pushItemTables() {
    if (cfg.itemColumns?.length) {
      blocks.push(heading(cfg.itemTableLabel || "Items"), dataTable(["#", ...cfg.itemColumns.map((c) => c.label)], ffe.items.map((row, i) => [String(i + 1), ...cfg.itemColumns!.map((c) => row[c.key] || "—")])));
    }
    if (cfg.items2Columns?.length) {
      blocks.push(heading(cfg.items2Label || "Items"), dataTable(["#", ...cfg.items2Columns.map((c) => c.label)], ffe.items2.map((row, i) => [String(i + 1), ...cfg.items2Columns!.map((c) => row[c.key] || "—")])));
    }
  }
  // Requested directly: "move the cylinder details below the
  // description of inspection for CO2, novec, wet chemical" — see
  // ffeCertTypes.ts's itemsAfterChecklist.
  if (!cfg.itemsAfterChecklist) pushItemTables();
  if (cfg.checklistItems?.length) {
    blocks.push(
      heading("Description of Inspection/Tests"),
      dataTable(["No", "Description", "Result", "Comment"], ffe.checklist.map((r) => [r.no, r.description, checklistResultLabel(r.result), r.comment || "—"]))
    );
  }
  if (cfg.itemsAfterChecklist) pushItemTables();
  if (cfg.readingsRows?.length) {
    blocks.push(
      heading("Readings"),
      dataTable(["Type of Vapor/Gas", "Measured Value", "Maximum Allowed", "Remarks"], cfg.readingsRows.map((r) => [r.label, ffe.technicalValues[`reading_${r.key}`] || "—", r.maxAllowed, ffe.technicalValues[`remarks_${r.key}`] || "—"]))
    );
  }
  blocks.push(new Paragraph({ text: "" }), remarksBox("Comments", ffe.comments || "None"), new Paragraph({ text: "" }));
  blocks.push(textP(`This Certificate is valid for ${cfg.validityYears === 2 ? "Two Years" : "One Year"} from the date of issue.`, { size: 16, color: MUTED }));
  blocks.push(...issuedByLine(cert));
  blocks.push(...(await signatureBlock(cert, "Master", "Technician")));
  return blocks;
}

async function buildCalibrationSection(cert: InspectionCertificate, calibration: CalibrationData): Promise<Block[]> {
  const cfg = getCalibrationConfig(calibration.subType);
  const blocks: Block[] = [badgeLine("Calibration Certificate", cfg.label.toUpperCase())];
  blocks.push(
    kvTable([
      ["Vessel", cert.vesselName || "—"],
      ["Certificate No", cert.certNo],
      ["IMO No", cert.imoNo || "—"],
      ["Date", fmtDate(cert.dateOfServicing)],
      ["Class/Flag", calibration.certClass || "—"],
      ["Place of Service", calibration.placeOfService || "—"],
    ])
  );
  if (cfg.technicalFields.length) {
    blocks.push(heading("Calibration Reference"), kvTable(cfg.technicalFields.map((f) => [f.label, calibration.technicalValues[f.key] || "—"] as [string, string])));
  }
  blocks.push(heading(cfg.itemTableLabel), dataTable(["#", ...cfg.itemColumns.map((c) => c.label)], calibration.items.map((row, i) => [String(i + 1), ...cfg.itemColumns.map((c) => row[c.key] || "—")])));
  blocks.push(heading(cfg.items2Label), dataTable(["#", ...cfg.items2Columns.map((c) => c.label)], calibration.items2.map((row, i) => [String(i + 1), ...cfg.items2Columns.map((c) => row[c.key] || "—")])));
  blocks.push(new Paragraph({ text: "" }), remarksBox("Comments", calibration.comments || "None"), new Paragraph({ text: "" }));
  blocks.push(textP(`This Certificate is valid for ${cfg.validityYears === 2 ? "Two Years" : "One Year"} from the date of issue.`, { size: 16, color: MUTED }));
  blocks.push(...issuedByLine(cert));
  blocks.push(...(await signatureBlock(cert, "Master", "Checked/Approved By")));
  return blocks;
}

function statutoryPairs(data: LooseGearStatutoryAnswers): Array<[string, string]> {
  return [
    ["First Exam After Install", yesNoLabel(data.firstExaminationAfterInstall)],
    ["Installed Correctly", yesNoLabel(data.installedCorrectly)],
    ["Within 6 Months", yesNoLabel(data.examinedWithin6Months)],
    ["Within 12 Months", yesNoLabel(data.examinedWithin12Months)],
    ["Per Examination Scheme", yesNoLabel(data.inAccordanceWithScheme)],
    ["After Exceptional Circumstances", yesNoLabel(data.afterExceptionalCircumstances)],
    ["Defect", data.defectDescription || "NONE"],
    ["Existing/Imminent Danger", yesNoLabel(data.existingOrImminentDanger)],
    ["Could Become Danger By", fmtDate(data.couldBecomeDangerBy)],
    ["Repair/Renewal Required", data.repairParticulars || "—"],
    ["Tests Carried Out", data.testsCarriedOut || "—"],
    ["Observations", data.observations || "—"],
    ["Safe to Operate", yesNoLabel(data.safeToOperate)],
  ];
}

// Requested directly: "the lose gear report appears to be two pages,
// make it one, and create a section inside the report where we can
// put a picture of the item inspected, instead of the photo report
// section imbed the photo inside the report for the lose gear, just
// one photo." Matches LooseGearItemPhoto in CertificatePreview.tsx —
// a single inline photo (never more; see PhotoUpload's maxPhotos in
// LooseGearForm.tsx) rather than a separate Photo Report section.
// Only called from the visual_certificate/standard_report branches
// below — requested directly: "remove the photo from the multiple
// items report" (a register of several different items, not one
// single item the way the other two templates are).
async function buildLooseGearItemPhotoBlocks(cert: InspectionCertificate): Promise<Block[]> {
  const photo = cert.photos?.looseGear?.[0];
  if (!photo) return [];
  // Requested directly: "reduce size of the photo in lose gears" —
  // matches the same shrink applied to the print/PDF version
  // (LooseGearItemPhoto in CertificatePreview.tsx, down from 260 to
  // a small inline thumbnail there); down from 260 to 120 here too.
  const run = await imageRunAtWidth(photo.data, 120);
  if (!run) return [];
  return [
    heading("Photo of Item Inspected"),
    new Paragraph({ children: [run] }),
    ...(photo.caption ? [textP(photo.caption, { size: 16, color: MUTED })] : []),
  ];
}

async function buildLooseGearSection(cert: InspectionCertificate, looseGear: LooseGearData): Promise<Block[]> {
  if (looseGear.subType === "visual_certificate" && looseGear.visualCert) {
    const d = looseGear.visualCert;
    const blocks: Block[] = [badgeLine("Visual Certificate of Thorough Examination", "LOOSE GEAR & LIFTING EQUIPMENT")];
    blocks.push(
      kvTable([
        ["Client/Owner", d.clientOwner || "—"],
        ["Certificate No", cert.certNo],
        ["Site", d.site || "—"],
        ["Charge Code/Order No.", d.chargeCodeOrderNo || "—"],
        ["Site Location", d.siteLocation || "—"],
        ["Issue Date", fmtDate(cert.dateOfServicing)],
        ["PO/Job No.", d.poJobNo || "—"],
        ["Color Code", d.colorCode || "—"],
        ["Inspection Type", d.inspectionType || "—"],
        ["Standard", d.standard || "—"],
        ["Vessel", cert.vesselName || "—"],
      ])
    );
    blocks.push(
      heading("Details of Examination"),
      kvTable([
        ["Item Serial No.", d.itemSerialNo || "—"],
        ["Item Description", d.itemDescription || "—"],
        ["SWL", d.swl || "—"],
        ["Item Location", d.itemLocation || "—"],
        ["Previous Cert No.", d.previousCertificateNo || "—"],
        ["Manufacturer", d.manufacturer || "—"],
        ["Previous Inspection", fmtDate(d.previousInspectionDate)],
        ["Test Date", fmtDate(d.testDate)],
        ["EC Declaration Available", yesNoLabel(d.ecDeclarationAvailable)],
        ["CE Mark Visible", yesNoLabel(d.ceMarkVisible)],
      ])
    );
    blocks.push(...(await buildLooseGearItemPhotoBlocks(cert)));
    blocks.push(heading("LOLER 1998 Statutory Declaration"), kvTable(statutoryPairs(d.statutory)));
    blocks.push(
      kvTable([
        ["Reported By", d.reportedByNameAndQualifications || "—"],
        ["Authenticated By", d.authenticatedByName || "—"],
        ["Next Exam Due", fmtDate(d.nextExaminationDue)],
        ["Employer", d.employerNameAddress || "—"],
      ])
    );
    blocks.push(new Paragraph({ text: "" }), ...issuedByLine(cert));
    blocks.push(...(await signatureBlock(cert, "Master", "Inspector", true)));
    return blocks;
  }

  if (looseGear.subType === "standard_report" && looseGear.standardReport) {
    const d = looseGear.standardReport;
    // Requested directly: "change the thorough examination report to
    // this type and style" — matches StandardReportPage's own print
    // layout (CertificatePreview.tsx) and its own comment for the
    // full reasoning: restructured to the attached Test & Tag
    // reference's simpler customer/site/examination-type header,
    // equipment ID block, free-text examination details, and a
    // PASS/FAIL result — no LOLER statutory declaration, no photo
    // ("do not imbed the photo" — no buildLooseGearItemPhotoBlocks
    // call here either now).
    const examinationTypeLabels: Record<string, string> = {
      initial: "Initial", standard: "Standard", under_scheme: "Under A Scheme", exceptional: "After Exceptional Circumstances", "": "—",
    };
    const blocks: Block[] = [badgeLine("Report of Thorough Examination", "LOOSE GEAR & LIFTING EQUIPMENT")];
    blocks.push(
      kvTable([
        ["Customer Details", d.customerDetails || "—"],
        ["Site Address", d.siteAddress || "—"],
        ["Report No.", cert.certNo],
        ["Date of Examination", fmtDate(d.dateOfExamination)],
        ["Date of Report", fmtDate(d.dateOfReport)],
        ["Examination Type", examinationTypeLabels[d.examinationType] || "—"],
        ["Job No", d.jobNo || "—"],
        ...(d.examinationType === "initial" ? [["Installed Correctly?", yesNoLabel(d.installedCorrectly)] as [string, string]] : []),
        ["Prev. Exam Date", fmtDate(d.prevExamDate)],
        ["Next Exam Date", fmtDate(d.nextExamDate)],
        ["Vessel", cert.vesselName || "—"],
      ])
    );
    blocks.push(
      heading("Description and Identification of the Equipment Item Examined"),
      kvTable([
        ["I.D. No", d.idNo || "—"],
        ["Description", d.description || "—"],
        ["Serial No(s)", d.serialNos.filter((s) => s.trim()).join(", ") || "—"],
        ["Model Details", d.modelDetails || "—"],
        ["Manufacturer", d.manufacturer || "—"],
        ["P.R.V. Fitted", yesNoLabel(d.prvFitted)],
        ["Mfg. Date", fmtDate(d.mfgDate)],
        ["Location", d.itemLocation || "—"],
        ["S.W.L", d.swl || "—"],
        ["WLL", d.ewl || "—"],
        ["MBL (Minimum Breaking Load)", d.mbl || "—"],
        ["Factor of Safety", d.factorOfSafety || "—"],
      ])
    );
    blocks.push(
      heading("Examination Details"),
      kvTable([
        ["Type of Examination/Test Carried Out", d.examinationCarriedOut || "—"],
        ["Examination Result / Equipment Status", d.examinationResult || "—"],
        ["Safe For Use", yesNoLabel(d.safeForUse)],
      ])
    );
    blocks.push(
      new Paragraph({ text: "" }),
      remarksBox("(A) Defects Needing Immediate Attention", d.defectsImmediate || "NONE"),
      new Paragraph({ text: "" }),
      remarksBox("Is Defect (A) an Immediate Danger to Persons?", yesNoLabel(d.defectImmediateDanger)),
      new Paragraph({ text: "" }),
      remarksBox("(B) Defects Under Observation / Parts Required", d.defectsObservation || "NONE"),
      new Paragraph({ text: "" }),
      remarksBox("Particulars of Any Tests Carried Out", d.testsCarriedOut || "NONE"),
      new Paragraph({ text: "" }),
      remarksBox("Additional Comments", d.additionalComments || "None"),
      new Paragraph({ text: "" })
    );
    blocks.push(
      new Paragraph({
        children: [
          new TextRun({ text: "RESULT: ", bold: true, color: NAVY, size: 20 }),
          new TextRun({
            text: d.result ? d.result.toUpperCase() : "—",
            bold: true,
            color: d.result === "pass" ? "1E7A34" : d.result === "fail" ? "B3261E" : MUTED,
            size: 20,
          }),
        ],
      }),
      new Paragraph({ text: "" })
    );
    blocks.push(new Paragraph({ text: "" }), ...issuedByLine(cert));
    blocks.push(await examinerDetailsTable(cert));
    return blocks;
  }

  if (looseGear.subType === "multiple_items" && looseGear.multipleItems) {
    const d = looseGear.multipleItems;
    const reasonLabels: Record<string, string> = {
      installation: "Installation (A)",
      "6monthly": "6 Monthly (B)",
      "12monthly": "12 Monthly (C)",
      written_scheme: "Written Scheme (D)",
      exceptional: "Exceptional Circumstance (E)",
      "": "—",
    };
    const blocks: Block[] = [badgeLine("Report of Thorough Examination (Multiple Items)", "LOOSE GEAR & LIFTING EQUIPMENT")];
    blocks.push(
      kvTable([
        ["Certificate No", cert.certNo],
        ["Job/PO No.", d.jobPoNo || "—"],
        ["Inspected By", d.inspectedBy || "—"],
        ["Vessel Name", cert.vesselName || "—"],
        ["Colour Code", d.colourCode || "—"],
        ["Location/Port", cert.location || "—"],
        ["Date of Report", fmtDate(cert.dateOfServicing)],
        ["Reason for Inspection", reasonLabels[d.reasonForInspection] || "—"],
      ])
    );
    blocks.push(
      dataTable(
        ["Serial No.", "Description", "SWL", "Manufacturer", "Result", "Cert No./Test Date", "Location", "Type of Inspection", "Next Inspection", "Safe to Use"],
        d.rows.map((r) => [
          r.serialNo || "—",
          r.description || "—",
          r.swl || "—",
          r.manufacturer || "—",
          r.result || "—",
          r.certNoTestDate || "—",
          r.itemLocation || "—",
          r.typeOfInspection || "—",
          fmtDate(r.nextInspectionDate),
          yesNoLabel(r.safeToUse),
        ])
      )
    );
    blocks.push(new Paragraph({ text: "" }), ...issuedByLine(cert));
    blocks.push(...(await signatureBlock(cert, "Master", "Inspector", true)));
    return blocks;
  }

  return [];
}

const PHOTO_SECTION_LABELS: Record<string, string> = {
  boatChecklist: "Boat Checklist",
  davitChecklist: "Davit Checklist",
  checklist: "Inspection Checklist",
  looseGear: "Loose Gear Inspection",
  general: "Photo Report",
};

// The combined FFE/Calibration vessel Photo Report (kind: "photoreport"
// — see inspectionChecklists.ts's photo_report entry and
// PhotoReportForm.tsx's own comment for why it's a standalone
// certificate type). Unlike every other Word section above, this
// one's whole point IS the photos, so — unlike the print/PDF path's
// own scope cut on embedding arbitrary evidence photos — these are
// embedded for real: fetched via imageRunAtWidth (photo.data is a
// data: URI only until first save; a finalized certificate — the
// only state Save as Word is even available for — has it as a real
// /api/photos/... URL by then, see that function's own comment).
async function buildPhotoReportSection(cert: InspectionCertificate, config: EquipmentTypeConfig): Promise<Block[]> {
  const blocks: Block[] = [
    badgeLine("Photo Report", config.typeName.toUpperCase()),
    kvTable([
      ["Certificate No", cert.certNo],
      ["Name of Ship", cert.vesselName || "—"],
      ["IMO No.", cert.imoNo || "—"],
      ["Date", fmtDate(cert.dateOfServicing)],
    ]),
    new Paragraph({ text: "" }),
    remarksBox("Comments", cert.remarks || "None"),
    new Paragraph({ text: "" }),
  ];

  const entries = Object.entries(cert.photos || {}).flatMap(([key, photos]) => (photos || []).map((photo) => ({ key, photo })));
  if (entries.length > 0) {
    blocks.push(heading("Photo Evidence"));
    const photoRuns = await Promise.all(entries.map((e) => imageRunAtWidth(e.photo.data, 260)));
    const rows: TableRow[] = [];
    for (let i = 0; i < entries.length; i += 2) {
      const pair = [entries[i], entries[i + 1]];
      const cells = pair.map((entry, ci) => {
        if (!entry) return new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: "" })] });
        const run = photoRuns[i + ci];
        return new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
          children: [
            new Paragraph({ alignment: AlignmentType.CENTER, children: run ? [run] : [new TextRun({ text: "[Photo unavailable]", italics: true, color: MUTED, size: 16 })] }),
            textP(PHOTO_SECTION_LABELS[entry.key] || entry.key, { color: MUTED, size: 14 }),
            textP(entry.photo.caption || "No description provided.", { size: 16 }),
          ],
        });
      });
      rows.push(new TableRow({ children: cells }));
    }
    blocks.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: TABLE_BORDERS, rows }));
    blocks.push(new Paragraph({ text: "" }));
  }

  blocks.push(...issuedByLine(cert));
  blocks.push(...(await signatureBlock(cert, "Captain Signature", "Service Engineer")));
  return blocks;
}

// ---- document assembly ----

async function buildHeader(): Promise<Header> {
  const logo = await imageRunAtHeight(HMZC_LOGO_DATA_URI, 40);
  const logoCell = new TableCell({
    width: { size: 30, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ children: logo ? [logo] : [new TextRun({ text: "HMZC LTD", bold: true, color: NAVY })] })],
  });
  const addressCell = new TableCell({
    width: { size: 70, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({ alignment: AlignmentType.END, children: [new TextRun({ text: "HMZC LTD — Marine Engineering Services", size: 16 })] }),
      new Paragraph({ alignment: AlignmentType.END, children: [new TextRun({ text: "Cabinda HQ: Urbanização 4 De Abril, Cabinda, Angola · Luanda, Benfica Rua Bento Raimundo.", size: 14, color: MUTED })] }),
      new Paragraph({ alignment: AlignmentType.END, children: [new TextRun({ text: "admin@hmzchealthinmarine.com | +244 972 320 300", size: 14, color: MUTED })] }),
    ],
  });
  return new Header({
    children: [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.SINGLE, size: 6, color: NAVY }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
        rows: [new TableRow({ children: [logoCell, addressCell] })],
      }),
    ],
  });
}

function buildFooter(certNo: string): Footer {
  return new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 4 } },
        children: [
          new TextRun({ text: `Certificate No: ${certNo}   |   Approvals: ABS · DNV · Bureau Veritas · CRALOG`, size: 14, color: MUTED }),
        ],
      }),
    ],
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportCertificateDocx(cert: InspectionCertificate, config: EquipmentTypeConfig): Promise<void> {
  const children: Block[] = [];

  if (config.kind === "ffe" && cert.ffe) {
    children.push(...(await buildFFESection(cert, cert.ffe)));
  } else if (config.kind === "loosegear" && cert.looseGear) {
    children.push(...(await buildLooseGearSection(cert, cert.looseGear)));
  } else if (config.kind === "calibration" && cert.calibration) {
    children.push(...(await buildCalibrationSection(cert, cert.calibration)));
  } else if (config.kind === "photoreport") {
    children.push(...(await buildPhotoReportSection(cert, config)));
  } else {
    const isBoat = config.kind === "boat";
    children.push(...(await buildStatementSection(cert, config)));
    if (isBoat && cert.boatChecklist) children.push(...(await buildChecklistSection(config.boatTitle || "Checklist", cert, cert.boatChecklist, "boatChecklist")));
    if (isBoat && cert.davitChecklist) children.push(...(await buildChecklistSection(config.davitTitle || "Davit Checklist", cert, cert.davitChecklist, "davitChecklist")));
    if (isBoat && cert.equip) children.push(...(await buildEquipmentListSection(cert, config)));
    if (!isBoat && cert.checklist) children.push(...(await buildChecklistSection(config.checklistTitle || "Inspection Checklist", cert, cert.checklist, "checklist")));
    children.push(...buildExplanatoryNotesSection(config));
  }

  const doc = new Document({
    sections: [
      {
        properties: { page: { margin: { top: 1000, bottom: 900, left: 900, right: 900 } } },
        headers: { default: await buildHeader() },
        footers: { default: buildFooter(cert.certNo) },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${cert.certNo || "certificate"}.docx`);
}
