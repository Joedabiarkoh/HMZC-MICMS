import { useState } from "react";
import {
  LOOSE_GEAR_STATUS_CODES,
  LOOSE_GEAR_SUB_TYPES,
  freshLooseGearDefectRow,
  freshLooseGearRegisterRow,
  freshLooseGearState,
  freshRTIndicationRow,
  freshUTIndicationRow,
  freshVTObservationRow,
  freshETIndicationRow,
  generateCertNo,
} from "../data/inspectionHelpers";
import {
  InspectionCertificate,
  LooseGearData,
  LooseGearDefectRow,
  LooseGearExaminationType,
  LooseGearMultipleItemsData,
  LooseGearReasonForInspection,
  LooseGearRegisterRow,
  LooseGearStandardReportData,
  LooseGearStatutoryAnswers,
  LooseGearVisualCertData,
  LooseGearYesNo,
  NDTCommonData,
  NDTFooterData,
  MPIData,
  PTData,
  RTData,
  UTData,
  VTData,
  ETData,
  LoadTestData,
} from "../types/inspection.types";
import VesselLookupPanel from "./VesselLookupPanel";
import SignatureCanvas from "./SignatureCanvas";
import PhotoUpload from "./PhotoUpload";
import { PhotoEvidence } from "../types/inspection.types";

// The 6 NDT method sub-types (everything except Load Test, which has
// its own structurally different form/sign-off) — used to decide when
// to show the shared photo slot and the "Approved By"/"Operator" sign-off
// labels in VesselLookupAndSignatures below.
const NDT_METHOD_SUBTYPES: LooseGearData["subType"][] = ["mpi", "pt", "rt", "ut", "vt", "et"];

// Requested directly: "for the lifting gear crane report can be like
// the lifeboat, but do not put limit on the photo required" — no
// minimum (no minRequired passed to PhotoUpload below, unlike boat's
// per-section minimums).
//
// Requested directly, next round: "the lose gear report appears to be
// two pages, make it one... just one photo." A dedicated Photo Report
// page (see CertificatePreview.tsx's own history) added a whole extra
// physical page whenever any photo existed — replaced with a single
// photo shown inline in the certificate's own content instead (see
// LooseGearItemPhoto in CertificatePreview.tsx), so a MAXIMUM of 1 is
// what's actually enforced now (maxPhotos below) — the "no limit" from
// the first request was about the minimum, not an unbounded count.
const PHOTO_KEY = "looseGear";

interface Props {
  current: InspectionCertificate;
  updateField: <K extends keyof InspectionCertificate>(key: K, value: InspectionCertificate[K]) => void;
  openCertificate: (certNo: string) => void;
  // Used to tell a brand-new, never-saved certificate apart from one
  // reopened for editing (see needsJobPicker below) — threaded down
  // from useInspections() in InspectionWorkspace.tsx.
  certificates: Record<string, InspectionCertificate>;
  // Requested directly: "create individual thorough report based on
  // multiple items filled for the subject... grouping should be done
  // base on Description, SWL, Location" — only used by
  // MultipleItemsForm below (see its own comment), threaded through
  // this shared Props for the same reason `certificates` is: every
  // loosegear sub-form shares one prop shape rather than each having
  // its own bespoke one.
  onGenerateStandardReports?: (rows: LooseGearRegisterRow[]) => Promise<{ certNo: string; description: string; swl: string; itemLocation: string; serialNos: string[] }[]>;
  // Requested directly: give the Load Test/NDT report types their own
  // certNo prefix instead of sharing "LG" — see changeSubType below and
  // generateCertNo's own comment in inspectionHelpers.ts. Threaded down
  // from useInspections() the same way `certificates` already is.
  allCertNos: Set<string>;
}

/**
 * Requested directly: put HMZC's real LOLER 1998 "Report of Thorough
 * Examination" templates into the Loose Gear & Lifting Equipment
 * division AS PROVIDED — each its own sub-type with its own field
 * layout, the same pattern FFE uses for its ~20 sub-types (see
 * ffeCertTypes.ts), rather than merged into one shape.
 *
 * Originally three sub-types; requested directly, later: "change the
 * thorough examination report to this [Test & Tag reference] type and
 * style, keep only this and the multiple items" — Standard Report was
 * redesigned to that reference's simpler style (see
 * StandardReportForm's own comment) and Visual Certificate dropped
 * from LOOSE_GEAR_SUB_TYPES (inspectionHelpers.ts), so only two are
 * selectable now. Visual Certificate's own form/type/print code stays
 * in place — not deleted — purely so a certificate already saved with
 * it still opens and edits correctly.
 */
export default function LooseGearForm({ current, updateField, openCertificate, certificates, onGenerateStandardReports, allCertNos }: Props) {
  const looseGear = current.looseGear || freshLooseGearState();

  // Regenerates certNo alongside the sub-type's data whenever the new
  // sub-type carries its own numbering prefix (Load Test/NDT — see
  // LOOSE_GEAR_SUBTYPE_TAGS in inspectionHelpers.ts) — consistent with
  // switching sub-type already discarding all of the old sub-type's
  // data; a certificate that hasn't been saved yet has nothing tying
  // its old number to anything real. Certificates already saved under
  // the old number are unaffected — this only ever runs on the
  // in-progress draft still being built.
  function changeSubType(id: LooseGearData["subType"]) {
    const fresh = freshLooseGearState(id);
    updateField("looseGear", fresh);
    updateField("certNo", generateCertNo("loosegear", allCertNos, id));
  }

  function updateVisualCert(patch: Partial<LooseGearVisualCertData>) {
    const data = looseGear.visualCert;
    if (!data) return;
    updateField("looseGear", { ...looseGear, visualCert: { ...data, ...patch } });
  }

  function updateStandardReport(patch: Partial<LooseGearStandardReportData>) {
    const data = looseGear.standardReport;
    if (!data) return;
    updateField("looseGear", { ...looseGear, standardReport: { ...data, ...patch } });
  }

  function updateMultipleItems(patch: Partial<LooseGearMultipleItemsData>) {
    const data = looseGear.multipleItems;
    if (!data) return;
    updateField("looseGear", { ...looseGear, multipleItems: { ...data, ...patch } });
  }

  function updateMPI(patch: Partial<MPIData>) {
    const data = looseGear.mpi;
    if (!data) return;
    updateField("looseGear", { ...looseGear, mpi: { ...data, ...patch } });
  }
  function updatePT(patch: Partial<PTData>) {
    const data = looseGear.pt;
    if (!data) return;
    updateField("looseGear", { ...looseGear, pt: { ...data, ...patch } });
  }
  function updateRT(patch: Partial<RTData>) {
    const data = looseGear.rt;
    if (!data) return;
    updateField("looseGear", { ...looseGear, rt: { ...data, ...patch } });
  }
  function updateUT(patch: Partial<UTData>) {
    const data = looseGear.ut;
    if (!data) return;
    updateField("looseGear", { ...looseGear, ut: { ...data, ...patch } });
  }
  function updateVT(patch: Partial<VTData>) {
    const data = looseGear.vt;
    if (!data) return;
    updateField("looseGear", { ...looseGear, vt: { ...data, ...patch } });
  }
  function updateET(patch: Partial<ETData>) {
    const data = looseGear.et;
    if (!data) return;
    updateField("looseGear", { ...looseGear, et: { ...data, ...patch } });
  }
  function updateLoadTest(patch: Partial<LoadTestData>) {
    const data = looseGear.loadTest;
    if (!data) return;
    updateField("looseGear", { ...looseGear, loadTest: { ...data, ...patch } });
  }

  // Requested directly: "the job creation number should be for all
  // the certificate" — the Job gate (see needsJobPicker,
  // InspectionWorkspace.tsx) now runs one level up, before this form
  // even mounts, since it applies to every equipment type, not just
  // Loose Gear. By the time this component renders, current.jobRef is
  // already set (or this is a pre-Job-feature legacy certificate).

  return (
    <>
      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Certificate Template</legend>
        <div className="insp-field">
          <label htmlFor="lg-subtype">Report Type</label>
          <select id="lg-subtype" value={looseGear.subType} onChange={(e) => changeSubType(e.target.value as LooseGearData["subType"])}>
            {LOOSE_GEAR_SUB_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
      </fieldset>

      <>
        {looseGear.subType === "visual_certificate" && looseGear.visualCert && (
          <VisualCertForm data={looseGear.visualCert} onChange={updateVisualCert} current={current} updateField={updateField} openCertificate={openCertificate} certificates={certificates} allCertNos={allCertNos} />
        )}
        {looseGear.subType === "standard_report" && looseGear.standardReport && (
          <StandardReportForm data={looseGear.standardReport} onChange={updateStandardReport} current={current} updateField={updateField} openCertificate={openCertificate} certificates={certificates} allCertNos={allCertNos} />
        )}
        {looseGear.subType === "multiple_items" && looseGear.multipleItems && (
          <MultipleItemsForm data={looseGear.multipleItems} onChange={updateMultipleItems} current={current} updateField={updateField} openCertificate={openCertificate} certificates={certificates} onGenerateStandardReports={onGenerateStandardReports} allCertNos={allCertNos} />
        )}
        {looseGear.subType === "mpi" && looseGear.mpi && (
          <MPIForm data={looseGear.mpi} onChange={updateMPI} current={current} updateField={updateField} openCertificate={openCertificate} certificates={certificates} allCertNos={allCertNos} />
        )}
        {looseGear.subType === "pt" && looseGear.pt && (
          <PTForm data={looseGear.pt} onChange={updatePT} current={current} updateField={updateField} openCertificate={openCertificate} certificates={certificates} allCertNos={allCertNos} />
        )}
        {looseGear.subType === "rt" && looseGear.rt && (
          <RTForm data={looseGear.rt} onChange={updateRT} current={current} updateField={updateField} openCertificate={openCertificate} certificates={certificates} allCertNos={allCertNos} />
        )}
        {looseGear.subType === "ut" && looseGear.ut && (
          <UTForm data={looseGear.ut} onChange={updateUT} current={current} updateField={updateField} openCertificate={openCertificate} certificates={certificates} allCertNos={allCertNos} />
        )}
        {looseGear.subType === "vt" && looseGear.vt && (
          <VTForm data={looseGear.vt} onChange={updateVT} current={current} updateField={updateField} openCertificate={openCertificate} certificates={certificates} allCertNos={allCertNos} />
        )}
        {looseGear.subType === "et" && looseGear.et && (
          <ETForm data={looseGear.et} onChange={updateET} current={current} updateField={updateField} openCertificate={openCertificate} certificates={certificates} allCertNos={allCertNos} />
        )}
        {looseGear.subType === "load_test" && looseGear.loadTest && (
          <LoadTestForm data={looseGear.loadTest} onChange={updateLoadTest} current={current} updateField={updateField} openCertificate={openCertificate} certificates={certificates} allCertNos={allCertNos} />
        )}
      </>
    </>
  );
}

// The source LOLER forms show every yes/no answer as a literal checkbox
// pair ("YES [x] NO [ ]"), not a dropdown — requested directly, to keep
// this looking like the actual statutory form rather than a generic app
// field. Clicking the already-selected box clears it back to unanswered,
// same as the print rendering's blank-box state for a genuinely
// unanswered question (see yesNoCheckboxes in CertificatePreview.tsx).
function YesNoField({ id, label, value, onChange }: { id: string; label: string; value: LooseGearYesNo; onChange: (v: LooseGearYesNo) => void }) {
  return (
    <div className="insp-field">
      <span id={`${id}-label`} style={{ display: "block", fontSize: 11, color: "var(--insp-muted)", marginBottom: 3, fontWeight: 600 }}>{label}</span>
      <div className="insp-yesno-toggle" role="group" aria-labelledby={`${id}-label`}>
        <button
          type="button"
          id={id}
          className={value === "yes" ? "selected" : ""}
          aria-pressed={value === "yes"}
          onClick={() => onChange(value === "yes" ? "" : "yes")}
        >
          <span aria-hidden="true">{value === "yes" ? "☒" : "☐"}</span> YES
        </button>
        <button
          type="button"
          className={value === "no" ? "selected" : ""}
          aria-pressed={value === "no"}
          onClick={() => onChange(value === "no" ? "" : "no")}
        >
          <span aria-hidden="true">{value === "no" ? "☒" : "☐"}</span> NO
        </button>
      </div>
    </div>
  );
}

function VesselLookupAndSignatures({ current, updateField, openCertificate }: Pick<Props, "current" | "updateField" | "openCertificate">) {
  function addPhotos(newPhotos: PhotoEvidence[]) {
    updateField("photos", { ...current.photos, [PHOTO_KEY]: [...(current.photos[PHOTO_KEY] || []), ...newPhotos] });
  }
  function removePhoto(index: number) {
    const list = [...(current.photos[PHOTO_KEY] || [])];
    list.splice(index, 1);
    updateField("photos", { ...current.photos, [PHOTO_KEY]: list });
  }
  function updateCaption(index: number, caption: string) {
    const list = [...(current.photos[PHOTO_KEY] || [])];
    if (!list[index]) return;
    list[index] = { ...list[index], caption };
    updateField("photos", { ...current.photos, [PHOTO_KEY]: list });
  }

  return (
    <>
      <VesselLookupPanel
        vesselName={current.vesselName}
        imoNo={current.imoNo}
        onOpenCertificate={(certNo, equipmentType) => {
          if (equipmentType === current.type) openCertificate(certNo);
          else window.location.href = `/inspections?type=${equipmentType}&open=${encodeURIComponent(certNo)}`;
        }}
      />
      {/* Requested directly: "remove the photo from the multiple items
          report", then, redesigning Standard Report to the Test & Tag
          reference style: "do not imbed the photo." Neither of the two
          selectable sub-types wants it anymore — only the legacy
          Visual Certificate template (not selectable for new
          certificates, only reachable if an existing one already has
          it — see LOOSE_GEAR_SUB_TYPES in inspectionHelpers.ts) still
          shows it, rather than an upload control that silently went
          nowhere. The 6 NDT methods and Load Test (requested directly:
          "the NDT documents test result section should accept photo")
          all want it, attached to their own Test Result/Remarks
          section — same shared PHOTO_KEY slot, rendered here since
          this component sits directly below that section in every one
          of their forms. */}
      {(current.looseGear?.subType === "visual_certificate" || current.looseGear?.subType === "load_test" || (current.looseGear?.subType && NDT_METHOD_SUBTYPES.includes(current.looseGear.subType))) && (
        <PhotoUpload
          photos={current.photos[PHOTO_KEY] || []}
          onAdd={addPhotos}
          onRemove={removePhoto}
          onCaptionChange={updateCaption}
          maxPhotos={1}
        />
      )}
      {/* "Examiner" for the redesigned Standard Report (matches its own
          "Examiner Details" section and the reference template's own
          wording), "Inspector" for Multiple Items/the legacy Visual
          Certificate, "Approved By"/"Operator/Technician" for the 6 NDT
          methods, "RO/Class Witness"/"Test Witness" for Load Test — same
          shared cert.captainName/captainSig + engineerName/engineerSig
          fields throughout, just the labels shown.
          Requested directly: "remove the previous examiner sign and
          master sign section on the lose gear[,] make the whole
          document layout just as the pdf loaded" — the reference has
          only one signer block ("Examination Carried Out By /
          Examiner Details"), no separate Master/Captain row, so that
          field pair is hidden for standard_report only (every other
          sub-type still uses both — see the print-side
          StandardReportPage/SignatureGrid in CertificatePreview.tsx for
          the matching change). */}
      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Signatures</legend>
        {(() => {
          const subType = current.looseGear?.subType;
          if (subType === "standard_report") {
            return (
              <>
                <div className="insp-field"><label htmlFor="lg-technician-name">Examiner Name</label><input id="lg-technician-name" value={current.engineerName} onChange={(e) => updateField("engineerName", e.target.value)} /></div>
                <div className="insp-row2">
                  <SignatureCanvas label="Examiner Signature" value={current.engineerSig} onChange={(v) => updateField("engineerSig", v)} allowSavedDefault />
                </div>
              </>
            );
          }
          const masterLabel = subType === "load_test" ? "RO/Class Witness" : subType && NDT_METHOD_SUBTYPES.includes(subType) ? "Approved By" : "Master";
          const technicianLabel = subType === "load_test" ? "Test Witness" : subType && NDT_METHOD_SUBTYPES.includes(subType) ? "Operator/Technician" : "Inspector";
          return (
            <>
              <div className="insp-row2">
                <div className="insp-field"><label htmlFor="lg-master-name">{masterLabel} Name{masterLabel === "Master" ? " (optional)" : ""}</label><input id="lg-master-name" value={current.captainName} onChange={(e) => updateField("captainName", e.target.value)} /></div>
                <div className="insp-field"><label htmlFor="lg-technician-name">{technicianLabel} Name</label><input id="lg-technician-name" value={current.engineerName} onChange={(e) => updateField("engineerName", e.target.value)} /></div>
              </div>
              <div className="insp-row2">
                <SignatureCanvas label={`${masterLabel} Signature`} value={current.captainSig} onChange={(v) => updateField("captainSig", v)} />
                <SignatureCanvas label={`${technicianLabel} Signature`} value={current.engineerSig} onChange={(v) => updateField("engineerSig", v)} allowSavedDefault />
              </div>
            </>
          );
        })()}
      </fieldset>
    </>
  );
}

function StatutoryQuestionsBlock({ id, data, onChange }: { id: string; data: LooseGearStatutoryAnswers; onChange: (patch: Partial<LooseGearStatutoryAnswers>) => void }) {
  return (
    <>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--insp-navy)", margin: "8px 0 4px", textTransform: "uppercase" }}>LOLER 1998 Statutory Questions</div>
      <div className="insp-row2">
        <YesNoField id={`${id}-first-exam`} label="First examination after install/assembly at a new site?" value={data.firstExaminationAfterInstall} onChange={(v) => onChange({ firstExaminationAfterInstall: v })} />
        <YesNoField id={`${id}-installed-ok`} label="If YES above — installed correctly?" value={data.installedCorrectly} onChange={(v) => onChange({ installedCorrectly: v })} />
      </div>
      <div className="insp-row2">
        <YesNoField id={`${id}-within-6`} label="Examined within an interval of 6 months?" value={data.examinedWithin6Months} onChange={(v) => onChange({ examinedWithin6Months: v })} />
        <YesNoField id={`${id}-within-12`} label="Examined within an interval of 12 months?" value={data.examinedWithin12Months} onChange={(v) => onChange({ examinedWithin12Months: v })} />
      </div>
      <div className="insp-row2">
        <YesNoField id={`${id}-scheme`} label="In accordance with an examination scheme?" value={data.inAccordanceWithScheme} onChange={(v) => onChange({ inAccordanceWithScheme: v })} />
        <YesNoField id={`${id}-exceptional`} label="After the occurrence of exceptional circumstances?" value={data.afterExceptionalCircumstances} onChange={(v) => onChange({ afterExceptionalCircumstances: v })} />
      </div>
      <div className="insp-field">
        <label htmlFor={`${id}-defect`}>Identification of any defect (if none, state NONE)</label>
        <textarea id={`${id}-defect`} rows={2} value={data.defectDescription} onChange={(e) => onChange({ defectDescription: e.target.value })} />
      </div>
      <div className="insp-row2">
        <YesNoField id={`${id}-danger`} label="Existing or imminent danger to persons? (reportable defect)" value={data.existingOrImminentDanger} onChange={(v) => onChange({ existingOrImminentDanger: v })} />
        <div className="insp-field"><label htmlFor={`${id}-danger-by`}>Could become a danger by (date)</label><input id={`${id}-danger-by`} type="date" value={data.couldBecomeDangerBy} onChange={(e) => onChange({ couldBecomeDangerBy: e.target.value })} /></div>
      </div>
      <div className="insp-field">
        <label htmlFor={`${id}-repair`}>Particulars of any repair/renewal/alteration required</label>
        <textarea id={`${id}-repair`} rows={2} value={data.repairParticulars} onChange={(e) => onChange({ repairParticulars: e.target.value })} />
      </div>
      <div className="insp-field">
        <label htmlFor={`${id}-tests`}>Particulars of any tests carried out (if none, state NONE)</label>
        <textarea id={`${id}-tests`} rows={2} value={data.testsCarriedOut} onChange={(e) => onChange({ testsCarriedOut: e.target.value })} />
      </div>
      <div className="insp-field">
        <label htmlFor={`${id}-observations`}>Observations / additional comments</label>
        <textarea id={`${id}-observations`} rows={2} value={data.observations} onChange={(e) => onChange({ observations: e.target.value })} />
      </div>
      <YesNoField id={`${id}-safe`} label="Is this equipment safe to operate?" value={data.safeToOperate} onChange={(v) => onChange({ safeToOperate: v })} />
    </>
  );
}

function VisualCertForm({
  data, onChange, current, updateField, openCertificate,
}: { data: LooseGearVisualCertData; onChange: (patch: Partial<LooseGearVisualCertData>) => void } & Props) {
  function updateStatutory(patch: Partial<LooseGearStatutoryAnswers>) {
    onChange({ statutory: { ...data.statutory, ...patch } });
  }

  return (
    <>
      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Visual Certificate of Thorough Examination</legend>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="vc-client">Client/Owner</label><input id="vc-client" value={data.clientOwner} onChange={(e) => onChange({ clientOwner: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="vc-certno">Certificate No</label><input id="vc-certno" value={current.certNo} readOnly /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="vc-site">Site</label><input id="vc-site" value={data.site} onChange={(e) => onChange({ site: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="vc-charge">Charge Code/Order No.</label><input id="vc-charge" value={data.chargeCodeOrderNo} onChange={(e) => onChange({ chargeCodeOrderNo: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="vc-sitelocation">Site Location</label><input id="vc-sitelocation" value={data.siteLocation} onChange={(e) => onChange({ siteLocation: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="vc-issuedate">Issue Date</label><input id="vc-issuedate" type="date" value={current.dateOfServicing} onChange={(e) => updateField("dateOfServicing", e.target.value)} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="vc-pojob">PO/Job No.</label><input id="vc-pojob" value={data.poJobNo} onChange={(e) => onChange({ poJobNo: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="vc-colorcode">Color Code</label><input id="vc-colorcode" value={data.colorCode} onChange={(e) => onChange({ colorCode: e.target.value })} placeholder="e.g. Blue" /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="vc-inspectiontype">Inspection Type</label><input id="vc-inspectiontype" value={data.inspectionType} onChange={(e) => onChange({ inspectionType: e.target.value })} placeholder="e.g. Visual and Function Test" /></div>
          <div className="insp-field"><label htmlFor="vc-standard">Standard</label><input id="vc-standard" value={data.standard} onChange={(e) => onChange({ standard: e.target.value })} placeholder="e.g. BS EN 14492, EN12385 LOLER 1998 S.I.2307" /></div>
        </div>
        <div className="insp-field"><label htmlFor="vc-vessel">Vessel</label><input id="vc-vessel" value={current.vesselName} onChange={(e) => updateField("vesselName", e.target.value)} /></div>
      </fieldset>

      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Details of Examination</legend>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="vc-item-serial">Item Serial No.</label><input id="vc-item-serial" value={data.itemSerialNo} onChange={(e) => onChange({ itemSerialNo: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="vc-item-desc">Item Description</label><input id="vc-item-desc" value={data.itemDescription} onChange={(e) => onChange({ itemDescription: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="vc-swl">SWL as Stated on Item</label><input id="vc-swl" value={data.swl} onChange={(e) => onChange({ swl: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="vc-item-location">Item Location</label><input id="vc-item-location" value={data.itemLocation} onChange={(e) => onChange({ itemLocation: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="vc-prevcert">Previous Certificate No.</label><input id="vc-prevcert" value={data.previousCertificateNo} onChange={(e) => onChange({ previousCertificateNo: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="vc-manufacturer">Manufacturer</label><input id="vc-manufacturer" value={data.manufacturer} onChange={(e) => onChange({ manufacturer: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="vc-prevdate">Previous Inspection Date</label><input id="vc-prevdate" type="date" value={data.previousInspectionDate} onChange={(e) => onChange({ previousInspectionDate: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="vc-testdate">Test Date</label><input id="vc-testdate" type="date" value={data.testDate} onChange={(e) => onChange({ testDate: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <YesNoField id="vc-ec" label="EC Declaration Available?" value={data.ecDeclarationAvailable} onChange={(v) => onChange({ ecDeclarationAvailable: v })} />
          <YesNoField id="vc-ce" label="CE Mark Clearly Visible?" value={data.ceMarkVisible} onChange={(v) => onChange({ ceMarkVisible: v })} />
        </div>
      </fieldset>

      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Statutory Declaration</legend>
        <StatutoryQuestionsBlock id="vc" data={data.statutory} onChange={updateStatutory} />
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="vc-reported-by">Name &amp; Qualifications of person making this report</label><input id="vc-reported-by" value={data.reportedByNameAndQualifications} onChange={(e) => onChange({ reportedByNameAndQualifications: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="vc-authenticated">Name of person signing/authenticating this report</label><input id="vc-authenticated" value={data.authenticatedByName} onChange={(e) => onChange({ authenticatedByName: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="vc-next-exam">Next Thorough Examination Must Be Carried Out On</label><input id="vc-next-exam" type="date" value={data.nextExaminationDue} onChange={(e) => onChange({ nextExaminationDue: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="vc-employer">Name &amp; Address of Employer (of persons making/authenticating report)</label><input id="vc-employer" value={data.employerNameAddress} onChange={(e) => onChange({ employerNameAddress: e.target.value })} /></div>
        </div>
      </fieldset>

      <VesselLookupAndSignatures current={current} updateField={updateField} openCertificate={openCertificate} />
    </>
  );
}

const EXAMINATION_TYPE_LABELS: Record<Exclude<LooseGearExaminationType, "">, string> = {
  initial: "Initial",
  standard: "Standard",
  under_scheme: "Under A Scheme",
  exceptional: "After Exceptional Circumstances",
};

// Requested directly: "change the thorough examination report to this
// type and style" — restructured to match the attached reference
// ("Test & Tag" branded "Report of Thorough Examination of Lifting
// Equipment", LOLER 1998): customer/site/examination-type header,
// equipment identification block, free-text examination details, and
// a PASS/FAIL result — no LOLER statutory yes/no questions section
// (that stays on the legacy Visual Certificate template only). "Do
// not imbed the photo" — no PhotoUpload rendered for this sub-type
// either now (see the exclusion in VesselLookupAndSignatures below).
function StandardReportForm({
  data, onChange, current, updateField, openCertificate,
}: { data: LooseGearStandardReportData; onChange: (patch: Partial<LooseGearStandardReportData>) => void } & Props) {
  // Requested directly: "is there a way we can arrange all these
  // process and work flow to make it simple and less complicated" —
  // Date of Report, MBL, and Factor of Safety are real LOLER/BDA
  // fields (see their own comments further down) but the least
  // frequently needed of the ~30 on this form, so they're tucked
  // behind one toggle instead of always taking up space. Starts
  // expanded if any of them already have a value (reopening a
  // certificate that used them shouldn't hide that data by default).
  const [showAdditional, setShowAdditional] = useState(!!(data.dateOfReport || data.mbl || data.factorOfSafety));
  // Requested directly: "collapse the ID section" — same collapsible
  // idea as showAdditional above, but for the whole "Description and
  // Identification of the Equipment Item Examined" fieldset rather
  // than a handful of rarely-used fields within it. Defaults open
  // (unlike showAdditional's fields, these are ones a technician
  // fills in on every report) — collapsing is for reducing clutter
  // once they're done, not for hiding required fields from a
  // first-time flow.
  const [idSectionOpen, setIdSectionOpen] = useState(true);
  return (
    <>
      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Report of Thorough Examination</legend>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="sr-customer">Customer Details</label><input id="sr-customer" value={data.customerDetails} onChange={(e) => onChange({ customerDetails: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="sr-site-address">Site Address</label><input id="sr-site-address" value={data.siteAddress} onChange={(e) => onChange({ siteAddress: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="sr-certno">Report No.</label><input id="sr-certno" value={current.certNo} readOnly /></div>
          <div className="insp-field"><label htmlFor="sr-date-exam">Date of Examination</label><input id="sr-date-exam" type="date" value={data.dateOfExamination} onChange={(e) => onChange({ dateOfExamination: e.target.value })} /></div>
        </div>
        <button
          type="button"
          className="insp-btn insp-btn-outline"
          style={{ padding: "3px 10px", fontSize: 11, marginBottom: 8 }}
          onClick={() => setShowAdditional((v) => !v)}
        >
          {showAdditional ? "− Hide Additional Details" : "+ Additional Details (Date of Report, MBL, Factor of Safety)"}
        </button>
        {/* Requested directly: "look at this [BDA Technical Guide] at
            the report section and include section where needed" —
            LOLER Schedule 1 item 11 requires its own "date of the
            report", distinct from the date the examination itself was
            carried out above (the BDA's own example RTE shows these
            as two separate fields). */}
        {showAdditional && (
          <div className="insp-field"><label htmlFor="sr-date-report">Date of Report</label><input id="sr-date-report" type="date" value={data.dateOfReport} onChange={(e) => onChange({ dateOfReport: e.target.value })} /></div>
        )}
        <div className="insp-row2">
          <div className="insp-field">
            <label htmlFor="sr-exam-type">Examination Type</label>
            <select id="sr-exam-type" value={data.examinationType} onChange={(e) => onChange({ examinationType: e.target.value as LooseGearExaminationType })}>
              <option value="">—</option>
              {(Object.keys(EXAMINATION_TYPE_LABELS) as Exclude<LooseGearExaminationType, "">[]).map((k) => (
                <option key={k} value={k}>{EXAMINATION_TYPE_LABELS[k]}</option>
              ))}
            </select>
          </div>
          <div className="insp-field"><label htmlFor="sr-jobno">Job No</label><input id="sr-jobno" value={current.jobRef || data.jobNo} readOnly /></div>
        </div>
        {/* LOLER Schedule 1 item 6(b) — only applies "in relation to
            the first thorough examination... after installation or
            after assembly at a new site", i.e. when Examination Type
            above is "Initial"; shown only then rather than as an
            always-visible field that's meaningless the rest of the
            time. */}
        {data.examinationType === "initial" && (
          <YesNoField id="sr-installed-correctly" label="Installed Correctly (and safe to operate)?" value={data.installedCorrectly} onChange={(v) => onChange({ installedCorrectly: v })} />
        )}
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="sr-prev-exam">Prev. Exam Date</label><input id="sr-prev-exam" type="date" value={data.prevExamDate} onChange={(e) => onChange({ prevExamDate: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="sr-next-exam">Next Exam Date</label><input id="sr-next-exam" type="date" value={data.nextExamDate} onChange={(e) => onChange({ nextExamDate: e.target.value })} /></div>
        </div>
        {/* Read-only — set once, by the Job Picker, when this
            certificate was first created (see LooseGearForm.tsx's
            handleJobSelected). Every item under the same Job must
            share its vessel, so this can't drift from it mid-form. */}
        <div className="insp-field"><label htmlFor="sr-vessel">Vessel</label><input id="sr-vessel" value={current.vesselName} readOnly /></div>
      </fieldset>

      <fieldset className="insp-fieldset">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <legend className="insp-legend">Description and Identification of the Equipment Item Examined</legend>
          <button
            type="button"
            className="insp-btn insp-btn-outline"
            style={{ padding: "3px 10px", fontSize: 11 }}
            onClick={() => setIdSectionOpen((v) => !v)}
          >
            {idSectionOpen ? "− Collapse" : "+ Expand"}
          </button>
        </div>
        {idSectionOpen && (
          <>
            <div className="insp-row2">
              <div className="insp-field"><label htmlFor="sr-idno">I.D. No</label><input id="sr-idno" value={data.idNo} onChange={(e) => onChange({ idNo: e.target.value })} /></div>
              <div className="insp-field"><label htmlFor="sr-desc">Description</label><input id="sr-desc" value={data.description} onChange={(e) => onChange({ description: e.target.value })} /></div>
            </div>
            <div className="insp-row2">
              <div className="insp-field"><label htmlFor="sr-model">Model Details</label><input id="sr-model" value={data.modelDetails} onChange={(e) => onChange({ modelDetails: e.target.value })} /></div>
              <div className="insp-field"><label htmlFor="sr-manufacturer">Manufacturer</label><input id="sr-manufacturer" value={data.manufacturer} onChange={(e) => onChange({ manufacturer: e.target.value })} /></div>
            </div>
            {/* Requested directly: "the items serial number can be about 20
                for 1 set of certificate" — one report can cover a whole
                batch of identical items (same description/model/
                manufacturer/SWL/EWL below, examined together), each with
                its own serial number, rather than always exactly one item
                per report — so this is a growable list, not a single
                field. */}
            <div className="insp-field">
              <label>Serial Number(s)</label>
              {data.serialNos.map((sn, i) => (
                <div key={i} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                  <input
                    aria-label={`Serial No ${i + 1}`}
                    value={sn}
                    onChange={(e) => {
                      const next = [...data.serialNos];
                      next[i] = e.target.value;
                      onChange({ serialNos: next });
                    }}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="insp-btn insp-btn-outline"
                    style={{ padding: "3px 10px" }}
                    onClick={() => {
                      const next = [...data.serialNos];
                      next.splice(i, 1);
                      onChange({ serialNos: next.length ? next : [""] });
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="insp-btn insp-btn-outline"
                style={{ padding: "3px 10px", fontSize: 11 }}
                onClick={() => onChange({ serialNos: [...data.serialNos, ""] })}
              >
                + Add Serial Number
              </button>
            </div>
            <YesNoField id="sr-prv" label="P.R.V. Fitted" value={data.prvFitted} onChange={(v) => onChange({ prvFitted: v })} />
            <div className="insp-row2">
              <div className="insp-field"><label htmlFor="sr-mfgdate">Mfg. Date</label><input id="sr-mfgdate" type="date" value={data.mfgDate} onChange={(e) => onChange({ mfgDate: e.target.value })} /></div>
              <div className="insp-field"><label htmlFor="sr-itemlocation">Location</label><input id="sr-itemlocation" value={data.itemLocation} onChange={(e) => onChange({ itemLocation: e.target.value })} /></div>
            </div>
            <div className="insp-row2">
              <div className="insp-field"><label htmlFor="sr-swl">S.W.L</label><input id="sr-swl" value={data.swl} onChange={(e) => onChange({ swl: e.target.value })} /></div>
              <div className="insp-field"><label htmlFor="sr-ewl">WLL</label><input id="sr-ewl" value={data.ewl} onChange={(e) => onChange({ ewl: e.target.value })} /></div>
            </div>
            {/* Requested directly, from the BDA Technical Guide (Thorough
                Examinations: Steel wire ropes, lifting accessories and
                certification): "The BDA further recommends that the
                Factor of Safety used to calculate WLLs... is added to the
                certificate" — MBL (Minimum Breaking Load) is the figure
                SWL/WLL is calculated FROM (WLL = MBL / FoS), and the
                guide's own example RTE records both alongside SWL for
                that reason. Gated by the same "Additional Details" toggle
                as Date of Report above — see showAdditional's own comment. */}
            {showAdditional && (
              <div className="insp-row2">
                <div className="insp-field"><label htmlFor="sr-mbl">MBL (Minimum Breaking Load)</label><input id="sr-mbl" value={data.mbl} onChange={(e) => onChange({ mbl: e.target.value })} placeholder="e.g. 7.12t" /></div>
                <div className="insp-field"><label htmlFor="sr-fos">Factor of Safety</label><input id="sr-fos" value={data.factorOfSafety} onChange={(e) => onChange({ factorOfSafety: e.target.value })} placeholder="e.g. 5:1" /></div>
              </div>
            )}
          </>
        )}
      </fieldset>

      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Examination Details</legend>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="sr-exam-carried-out">Type of Examination/Test Carried Out</label><input id="sr-exam-carried-out" value={data.examinationCarriedOut} onChange={(e) => onChange({ examinationCarriedOut: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="sr-exam-result">Examination Result / Equipment Status</label><input id="sr-exam-result" value={data.examinationResult} onChange={(e) => onChange({ examinationResult: e.target.value })} placeholder="e.g. Satisfactory" /></div>
        </div>
        <YesNoField id="sr-safe" label="Safe For Use" value={data.safeForUse} onChange={(v) => onChange({ safeForUse: v })} />
        <div className="insp-row2">
          <div className="insp-field">
            <label htmlFor="sr-defects-a">(A) Defects In Need of Attention To Prevent Immediate Failure &amp; Details of Action Required</label>
            <textarea id="sr-defects-a" rows={3} value={data.defectsImmediate} onChange={(e) => onChange({ defectsImmediate: e.target.value })} placeholder="If none, state NONE" />
          </div>
          <div className="insp-field">
            <label htmlFor="sr-defects-b">(B) Defects to be Kept Under Observation, Date When Must Be Rectified By and Parts Required</label>
            <textarea id="sr-defects-b" rows={3} value={data.defectsObservation} onChange={(e) => onChange({ defectsObservation: e.target.value })} placeholder="If none, state NONE" />
          </div>
        </div>
        {/* LOLER Schedule 1 item 8(a)'s own sub-question, flagged
            explicitly in the BDA guide: a defect that IS an immediate
            danger to persons has a materially different consequence
            (must be reported to the enforcing authority) than one
            merely kept under observation — needs its own explicit
            Yes/No rather than being inferred from the free text
            above. */}
        <YesNoField id="sr-defect-danger" label="Is defect (A) an immediate danger to persons?" value={data.defectImmediateDanger} onChange={(v) => onChange({ defectImmediateDanger: v })} />
        <div className="insp-row2">
          <div className="insp-field">
            <label htmlFor="sr-tests">Particulars of Any Tests Carried Out as Part of the Examination</label>
            <textarea id="sr-tests" rows={3} value={data.testsCarriedOut} onChange={(e) => onChange({ testsCarriedOut: e.target.value })} placeholder="If none, state NONE" />
          </div>
          <div className="insp-field">
            <label htmlFor="sr-comments">Additional Comments Made As Part of This Examination</label>
            <textarea id="sr-comments" rows={3} value={data.additionalComments} onChange={(e) => onChange({ additionalComments: e.target.value })} />
          </div>
        </div>
      </fieldset>

      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Result</legend>
        <div className="insp-yesno-toggle" role="group" aria-label="Result">
          <button
            type="button"
            className={data.result === "pass" ? "selected" : ""}
            aria-pressed={data.result === "pass"}
            onClick={() => onChange({ result: data.result === "pass" ? "" : "pass" })}
            style={{ color: data.result === "pass" ? undefined : "var(--insp-green)" }}
          >
            <span aria-hidden="true">{data.result === "pass" ? "☒" : "☐"}</span> PASS
          </button>
          <button
            type="button"
            className={data.result === "fail" ? "selected" : ""}
            aria-pressed={data.result === "fail"}
            onClick={() => onChange({ result: data.result === "fail" ? "" : "fail" })}
            style={{ color: data.result === "fail" ? undefined : "var(--insp-red)" }}
          >
            <span aria-hidden="true">{data.result === "fail" ? "☒" : "☐"}</span> FAIL
          </button>
        </div>
      </fieldset>

      <VesselLookupAndSignatures current={current} updateField={updateField} openCertificate={openCertificate} />
    </>
  );
}

const REASON_LABELS: Record<Exclude<LooseGearReasonForInspection, "">, string> = {
  installation: "Installation (A)",
  "6monthly": "6 Monthly (B)",
  "12monthly": "12 Monthly (C)",
  written_scheme: "Written Scheme (D)",
  exceptional: "Exceptional Circumstance (E)",
};

function MultipleItemsForm({
  data, onChange, current, updateField, openCertificate, onGenerateStandardReports,
}: { data: LooseGearMultipleItemsData; onChange: (patch: Partial<LooseGearMultipleItemsData>) => void } & Props) {
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<{ certNo: string; description: string; swl: string; itemLocation: string; serialNos: string[] }[] | null>(null);

  function addRow() {
    onChange({ rows: [...data.rows, freshLooseGearRegisterRow()] });
  }
  function removeRow(i: number) {
    const next = [...data.rows];
    next.splice(i, 1);
    onChange({ rows: next });
  }
  // Requested directly: "coping items across and pasting them below
  // for the next item is not possible now... one cell at a time" —
  // same reasoning as FFEForm.tsx's duplicateItemRow, except Serial
  // No. resets blank here (like "+ Add Next Item to This Job" already
  // does for Standard Report) since it's this register's one field
  // that must stay unique per physical item — everything else
  // (Description, SWL, Manufacturer, Location, etc.) usually IS
  // identical for the next item, which is the whole point of copying.
  function duplicateRow(i: number) {
    const next = [...data.rows];
    next.splice(i + 1, 0, { ...next[i], serialNo: "" });
    onChange({ rows: next });
  }
  function updateRow(i: number, patch: Partial<LooseGearRegisterRow>) {
    const next = [...data.rows];
    next[i] = { ...next[i], ...patch };
    onChange({ rows: next });
  }

  async function handleGenerate() {
    if (!onGenerateStandardReports) return;
    setGenerating(true);
    try {
      const results = await onGenerateStandardReports(data.rows);
      setGenerated(results);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Report of Thorough Examination (Multiple Items)</legend>
        {/* Read-only — set once, by the Job Picker, when this
            certificate was first created (see LooseGearForm.tsx's
            handleJobSelected). Distinct from Job/PO No. below, which
            is the CLIENT's own PO reference, not HMZC's internal job
            grouping. */}
        <div className="insp-field"><label htmlFor="mi-hmzc-job">HMZC Job No</label><input id="mi-hmzc-job" value={current.jobRef || "—"} readOnly /></div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="mi-jobpo">Job/PO No.</label><input id="mi-jobpo" value={data.jobPoNo} onChange={(e) => onChange({ jobPoNo: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="mi-inspectedby">Inspected By</label><input id="mi-inspectedby" value={data.inspectedBy} onChange={(e) => onChange({ inspectedBy: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="mi-vessel">Vessel Name</label><input id="mi-vessel" value={current.vesselName} readOnly /></div>
          <div className="insp-field"><label htmlFor="mi-colour">Colour Code</label><input id="mi-colour" value={data.colourCode} onChange={(e) => onChange({ colourCode: e.target.value })} placeholder="e.g. Blue" /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="mi-location">Location/Port</label><input id="mi-location" value={current.location} onChange={(e) => updateField("location", e.target.value)} /></div>
          <div className="insp-field"><label htmlFor="mi-date-report">Date of Report</label><input id="mi-date-report" type="date" value={current.dateOfServicing} onChange={(e) => updateField("dateOfServicing", e.target.value)} /></div>
        </div>
        <div className="insp-field">
          <label htmlFor="mi-reason">Reason for Inspection</label>
          <select id="mi-reason" value={data.reasonForInspection} onChange={(e) => onChange({ reasonForInspection: e.target.value as LooseGearReasonForInspection })}>
            <option value="">—</option>
            {(Object.keys(REASON_LABELS) as Exclude<LooseGearReasonForInspection, "">[]).map((k) => (
              <option key={k} value={k}>{REASON_LABELS[k]}</option>
            ))}
          </select>
        </div>
      </fieldset>

      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Item Register</legend>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", minWidth: 1100 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #DCE1E5" }}>
                <th style={{ padding: "4px 6px", width: 30 }}>#</th>
                <th style={{ padding: "4px 6px" }}>Serial No.</th>
                <th style={{ padding: "4px 6px" }}>Description</th>
                <th style={{ padding: "4px 6px" }}>SWL</th>
                <th style={{ padding: "4px 6px" }}>Manufacturer</th>
                <th style={{ padding: "4px 6px" }}>Cert No./Test Date</th>
                <th style={{ padding: "4px 6px" }}>Item Location</th>
                <th style={{ padding: "4px 6px" }}>Type of Inspection</th>
                <th style={{ padding: "4px 6px" }}>Next Inspection Date</th>
                {/* Requested directly: "change result to (status) and
                    move it to the end close to safe to use" — was right
                    after Manufacturer; now sits right before Safe to
                    Use so the two read together (this item's condition,
                    then whether it's safe to use because of it). */}
                <th style={{ padding: "4px 6px" }}>Status</th>
                <th style={{ padding: "4px 6px" }}>Safe to Use</th>
                <th style={{ width: 62 }}></th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <tr key={i} style={{ borderTop: "1px solid #EEF1F3" }}>
                  <td style={{ padding: "4px 6px", color: "var(--insp-muted)" }}>{i + 1}</td>
                  <td style={{ padding: "4px 6px" }}><input value={row.serialNo} onChange={(e) => updateRow(i, { serialNo: e.target.value })} style={{ width: "100%" }} /></td>
                  <td style={{ padding: "4px 6px" }}><input value={row.description} onChange={(e) => updateRow(i, { description: e.target.value })} style={{ width: "100%" }} /></td>
                  <td style={{ padding: "4px 6px" }}><input value={row.swl} onChange={(e) => updateRow(i, { swl: e.target.value })} style={{ width: "100%" }} /></td>
                  <td style={{ padding: "4px 6px" }}><input value={row.manufacturer} onChange={(e) => updateRow(i, { manufacturer: e.target.value })} style={{ width: "100%" }} /></td>
                  <td style={{ padding: "4px 6px" }}><input value={row.certNoTestDate} onChange={(e) => updateRow(i, { certNoTestDate: e.target.value })} style={{ width: "100%" }} /></td>
                  <td style={{ padding: "4px 6px" }}><input value={row.itemLocation} onChange={(e) => updateRow(i, { itemLocation: e.target.value })} style={{ width: "100%" }} /></td>
                  <td style={{ padding: "4px 6px" }}><input value={row.typeOfInspection} onChange={(e) => updateRow(i, { typeOfInspection: e.target.value })} style={{ width: "100%" }} placeholder="Visual" /></td>
                  <td style={{ padding: "4px 6px" }}><input type="date" value={row.nextInspectionDate} onChange={(e) => updateRow(i, { nextInspectionDate: e.target.value })} style={{ width: "100%" }} /></td>
                  <td style={{ padding: "4px 6px" }}>
                    <select value={row.result} onChange={(e) => updateRow(i, { result: e.target.value })}>
                      <option value="">—</option>
                      {LOOSE_GEAR_STATUS_CODES.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: "4px 6px" }}>
                    <select value={row.safeToUse} onChange={(e) => updateRow(i, { safeToUse: e.target.value as LooseGearYesNo })}>
                      <option value="">—</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </td>
                  <td style={{ padding: "4px 6px", display: "flex", gap: 4 }}>
                    <button type="button" className="insp-btn insp-btn-outline" style={{ padding: "2px 8px", fontSize: 11 }} title="Duplicate this row (Serial No. left blank)" onClick={() => duplicateRow(i)}>⧉</button>
                    <button type="button" className="insp-btn insp-btn-outline" style={{ padding: "2px 8px", fontSize: 11, color: "var(--insp-red)" }} title="Remove this row" onClick={() => removeRow(i)}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className="insp-btn insp-btn-outline" style={{ marginTop: 8, width: "auto", padding: "5px 14px", fontSize: 12 }} onClick={addRow}>
          + Add Row
        </button>
      </fieldset>

      <DefectReportForm data={data} onChange={onChange} certNo={current.certNo} />

      {/* Requested directly: "create individual thorough report based
          on multiple items filled for the subject by using the
          description, SWL and location of items to create report for
          items of same details and others... for faster issuance of
          standard report for individual items instead of doing them
          one by one." Rows sharing the same Description/SWL/Location
          become one Standard Report with all their serial numbers
          together; each generated report is a real, independent draft
          the technician opens, reviews, and edits before printing —
          this panel never prints or finalizes anything itself. */}
      {!!onGenerateStandardReports && (
        <fieldset className="insp-fieldset">
          <legend className="insp-legend">Generate Individual Reports</legend>
          <p className="insp-help-note">
            Groups the rows above by matching Description, SWL, and Location — each group becomes its own Standard
            Report draft (all matching Serial Numbers on one report), ready to open, check, and edit before printing.
          </p>
          <button
            type="button"
            className="insp-btn insp-btn-primary"
            onClick={handleGenerate}
            disabled={generating || data.rows.length === 0 || !current.jobRef}
            title={!current.jobRef ? "This certificate needs a Job attached first." : undefined}
          >
            {generating ? "Generating..." : "Generate Individual Reports"}
          </button>
          {generated !== null && (
            <div style={{ marginTop: 10 }}>
              {generated.length === 0 ? (
                <p className="insp-help-note">No reports generated — every row was blank.</p>
              ) : (
                <>
                  <p className="insp-help-note" style={{ marginBottom: 6 }}>
                    {generated.length} draft report{generated.length === 1 ? "" : "s"} generated. Open each to review, sign, and print.
                  </p>
                  {generated.map((r) => (
                    <div key={r.certNo} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid #DCE1E5", borderRadius: 6, padding: "6px 10px", marginBottom: 6, fontSize: 11.5 }}>
                      <span>
                        <strong>{r.certNo}</strong> — {r.description || "(no description)"}
                        {r.swl && ` · SWL ${r.swl}`}
                        {r.itemLocation && ` · ${r.itemLocation}`}
                        {" · "}{r.serialNos.length} item{r.serialNos.length === 1 ? "" : "s"}
                      </span>
                      <button type="button" className="insp-btn insp-btn-outline" style={{ padding: "2px 10px", fontSize: 11 }} onClick={() => openCertificate(r.certNo)}>
                        Open
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </fieldset>
      )}

      <VesselLookupAndSignatures current={current} updateField={updateField} openCertificate={openCertificate} />
    </>
  );
}

// Requested directly, from a real reference form (LEEA-030.1d "Report of
// Thorough Examination — Defect Report List", Version 3, May 2023): an
// attachment for any Item Register row whose Status is SDR/OBS. Same
// add/remove/# convention as the Item Register above; deliberately its
// own small add/remove pair (not shared with the register's) since the
// two arrays (data.rows vs data.defects) are independent. Print/preview
// and the Word export only render this section at all when there's at
// least one defect row — see MultipleItemsPage's own comment.
function DefectReportForm({ data, onChange, certNo }: { data: LooseGearMultipleItemsData; onChange: (patch: Partial<LooseGearMultipleItemsData>) => void; certNo: string }) {
  // Root-caused from a real report: opening a Multiple Items
  // certificate saved before this feature existed showed a blank white
  // page — `data.defects` simply isn't present in that older
  // certificate's stored JSON, so spreading/mapping it below threw.
  // See CertificatePreview.tsx's MultipleItemsPage for the matching fix.
  const defects = data.defects || [];
  function addDefect() {
    onChange({ defects: [...defects, freshLooseGearDefectRow()] });
  }
  function removeDefect(i: number) {
    const next = [...defects];
    next.splice(i, 1);
    onChange({ defects: next });
  }
  function updateDefect(i: number, patch: Partial<LooseGearDefectRow>) {
    const next = [...defects];
    next[i] = { ...next[i], ...patch };
    onChange({ defects: next });
  }

  return (
    <fieldset className="insp-fieldset">
      <legend className="insp-legend">Defect Report</legend>
      <p className="insp-help-note">
        This defect report refers to the equipment listed on the Thorough Examination report number: <strong>{certNo || "—"}</strong>. Add
        one row per item whose Status above is marked SDR or OBS.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", minWidth: 1100 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #DCE1E5" }}>
              <th style={{ padding: "4px 6px", width: 30 }}>#</th>
              <th style={{ padding: "4px 6px" }}>Equipment ID No.</th>
              <th style={{ padding: "4px 6px" }}>Equipment Description</th>
              <th style={{ padding: "4px 6px" }}>Defective Parts</th>
              <th style={{ padding: "4px 6px" }}>Immediate Danger *</th>
              <th style={{ padding: "4px 6px" }}>When Will It Become a Danger</th>
              <th style={{ padding: "4px 6px" }}>Repair/Renewal/Alteration Particulars</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {defects.map((row, i) => (
              <tr key={i} style={{ borderTop: "1px solid #EEF1F3" }}>
                <td style={{ padding: "4px 6px", color: "var(--insp-muted)" }}>{i + 1}</td>
                <td style={{ padding: "4px 6px" }}><input value={row.equipmentIdNo} onChange={(e) => updateDefect(i, { equipmentIdNo: e.target.value })} style={{ width: "100%" }} /></td>
                <td style={{ padding: "4px 6px" }}><input value={row.equipmentDescription} onChange={(e) => updateDefect(i, { equipmentDescription: e.target.value })} style={{ width: "100%" }} /></td>
                <td style={{ padding: "4px 6px" }}><input value={row.defectiveParts} onChange={(e) => updateDefect(i, { defectiveParts: e.target.value })} style={{ width: "100%" }} /></td>
                <td style={{ padding: "4px 6px" }}>
                  <select value={row.immediateDanger} onChange={(e) => updateDefect(i, { immediateDanger: e.target.value as LooseGearYesNo })}>
                    <option value="">—</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </td>
                <td style={{ padding: "4px 6px" }}><input value={row.whenBecomesDanger} onChange={(e) => updateDefect(i, { whenBecomesDanger: e.target.value })} style={{ width: "100%" }} disabled={row.immediateDanger === "yes"} placeholder={row.immediateDanger === "yes" ? "N/A — immediate danger" : ""} /></td>
                <td style={{ padding: "4px 6px" }}><input value={row.repairParticulars} onChange={(e) => updateDefect(i, { repairParticulars: e.target.value })} style={{ width: "100%" }} /></td>
                <td style={{ padding: "4px 6px" }}>
                  <button type="button" className="insp-btn insp-btn-outline" style={{ padding: "2px 8px", fontSize: 11, color: "var(--insp-red)" }} title="Remove this row" onClick={() => removeDefect(i)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="insp-help-note" style={{ color: "var(--insp-red)" }}>* If yes, must be reported to HSE.</p>
      <button type="button" className="insp-btn insp-btn-outline" style={{ marginTop: 4, width: "auto", padding: "5px 14px", fontSize: 12 }} onClick={addDefect}>
        + Add Defect
      </button>
      <div className="insp-field" style={{ marginTop: 10 }}>
        <label htmlFor="mi-defect-observations">Observations / Additional Comments Relative to This Thorough Examination</label>
        <textarea id="mi-defect-observations" rows={3} value={data.defectObservations || ""} onChange={(e) => onChange({ defectObservations: e.target.value })} />
      </div>
    </fieldset>
  );
}

// ============================================================
// Load Test / NDT report types (MPI, PT, RT, UT, VT, ET) — requested
// directly: put HMZC's Load Test Report and 6 NDT method templates
// into Loose Gear & Lifting Equipment, based on the MPI/PT templates'
// own format, styled after a real reference report. NDTCommonFieldsForm/
// NDTFooterFieldsForm are shared across all 6 NDT methods (the identical
// top header block and the identical footer — see NDTCommonData/
// NDTFooterData's own comments in inspection.types.ts); NDTIndicationsTable
// is a generic add/remove-row editor shared by the 4 methods that have a
// repeating indications/observations table (RT/UT/VT/ET — MPI/PT don't,
// per their own templates).
// ============================================================

function NDTCommonFieldsForm({
  idPrefix, data, onChange, current, updateField,
}: { idPrefix: string; data: NDTCommonData; onChange: (patch: Partial<NDTCommonData>) => void; current: InspectionCertificate; updateField: Props["updateField"] }) {
  return (
    <fieldset className="insp-fieldset">
      <legend className="insp-legend">Report Details</legend>
      <div className="insp-row2">
        <div className="insp-field"><label htmlFor={`${idPrefix}-certno`}>Report No.</label><input id={`${idPrefix}-certno`} value={current.certNo} readOnly /></div>
        <div className="insp-field"><label htmlFor={`${idPrefix}-date`}>Date of Testing</label><input id={`${idPrefix}-date`} type="date" value={current.dateOfServicing} onChange={(e) => updateField("dateOfServicing", e.target.value)} /></div>
      </div>
      <div className="insp-row2">
        <div className="insp-field"><label htmlFor={`${idPrefix}-vessel`}>Vessel</label><input id={`${idPrefix}-vessel`} value={current.vesselName} onChange={(e) => updateField("vesselName", e.target.value)} /></div>
        <div className="insp-field"><label htmlFor={`${idPrefix}-imo`}>IMO No.</label><input id={`${idPrefix}-imo`} value={current.imoNo} onChange={(e) => updateField("imoNo", e.target.value)} /></div>
      </div>
      <div className="insp-row2">
        <div className="insp-field"><label htmlFor={`${idPrefix}-client`}>Client</label><input id={`${idPrefix}-client`} value={data.client} onChange={(e) => onChange({ client: e.target.value })} /></div>
        <div className="insp-field"><label htmlFor={`${idPrefix}-manufacturer`}>Manufacturer</label><input id={`${idPrefix}-manufacturer`} value={data.manufacturer} onChange={(e) => onChange({ manufacturer: e.target.value })} /></div>
      </div>
      <div className="insp-field"><label htmlFor={`${idPrefix}-object`}>Object of Control</label><input id={`${idPrefix}-object`} value={data.objectOfControl} onChange={(e) => onChange({ objectOfControl: e.target.value })} placeholder="e.g. Life boat davit / crane structural welds" /></div>
      <div className="insp-row2">
        <div className="insp-field"><label htmlFor={`${idPrefix}-po`}>PO No.</label><input id={`${idPrefix}-po`} value={data.poNo} onChange={(e) => onChange({ poNo: e.target.value })} /></div>
        <div className="insp-field"><label htmlFor={`${idPrefix}-procedure`}>Procedure Reference</label><input id={`${idPrefix}-procedure`} value={data.procedureReference} onChange={(e) => onChange({ procedureReference: e.target.value })} /></div>
      </div>
      <div className="insp-row2">
        <div className="insp-field"><label htmlFor={`${idPrefix}-drawing`}>Drawing No.</label><input id={`${idPrefix}-drawing`} value={data.drawingNo} onChange={(e) => onChange({ drawingNo: e.target.value })} /></div>
        <div className="insp-field"><label htmlFor={`${idPrefix}-extent`}>Extent of Testing</label><input id={`${idPrefix}-extent`} value={data.extentOfTesting} onChange={(e) => onChange({ extentOfTesting: e.target.value })} /></div>
      </div>
      <div className="insp-row2">
        <div className="insp-field"><label htmlFor={`${idPrefix}-standard`}>Acceptance Standard</label><input id={`${idPrefix}-standard`} value={data.acceptanceStandard} onChange={(e) => onChange({ acceptanceStandard: e.target.value })} placeholder="e.g. ISO 5817 / DNV Rules for Certification of Lifting Appliances" /></div>
        <div className="insp-field"><label htmlFor={`${idPrefix}-operator`}>Operator</label><input id={`${idPrefix}-operator`} value={data.operator} onChange={(e) => onChange({ operator: e.target.value })} /></div>
      </div>
    </fieldset>
  );
}

function NDTFooterFieldsForm({ idPrefix, data, onChange }: { idPrefix: string; data: NDTFooterData; onChange: (patch: Partial<NDTFooterData>) => void }) {
  return (
    <fieldset className="insp-fieldset">
      <legend className="insp-legend">Test Result</legend>
      <div className="insp-field">
        <label htmlFor={`${idPrefix}-findings`}>Findings / Result Statement</label>
        <textarea id={`${idPrefix}-findings`} rows={3} value={data.findingsStatement} onChange={(e) => onChange({ findingsStatement: e.target.value })} />
      </div>
      <div className="insp-field"><label htmlFor={`${idPrefix}-serial`}>Serial No.</label><input id={`${idPrefix}-serial`} value={data.serialNo} onChange={(e) => onChange({ serialNo: e.target.value })} /></div>
      <div className="insp-field">
        <label>Repairs Marked On</label>
        <div style={{ display: "flex", gap: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontWeight: 400 }}>
            <input type="checkbox" checked={data.repairsMarkedOnObject} onChange={(e) => onChange({ repairsMarkedOnObject: e.target.checked })} /> Object
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontWeight: 400 }}>
            <input type="checkbox" checked={data.repairsMarkedOnSketch} onChange={(e) => onChange({ repairsMarkedOnSketch: e.target.checked })} /> Sketch
          </label>
        </div>
      </div>
    </fieldset>
  );
}

// Generic add/remove-row editor for the indications/observations tables
// — same shape as CalibrationForm.tsx's ItemTable, reused here rather
// than four near-identical bespoke tables for RT/UT/VT/ET.
function NDTIndicationsTable({
  title, columns, rows, onChange,
}: { title: string; columns: { key: string; label: string }[]; rows: Record<string, string>[]; onChange: (rows: Record<string, string>[]) => void }) {
  function addRow() {
    const blank: Record<string, string> = {};
    for (const c of columns) blank[c.key] = "";
    onChange([...rows, blank]);
  }
  function removeRow(i: number) {
    const next = [...rows];
    next.splice(i, 1);
    onChange(next);
  }
  function updateCell(i: number, key: string, value: string) {
    const next = [...rows];
    next[i] = { ...next[i], [key]: value };
    onChange(next);
  }
  return (
    <fieldset className="insp-fieldset">
      <legend className="insp-legend">{title}</legend>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", minWidth: columns.length * 130 }}>
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
                    <input value={row[c.key] || ""} onChange={(e) => updateCell(i, c.key, e.target.value)} style={{ width: "100%" }} />
                  </td>
                ))}
                <td style={{ padding: "4px 6px" }}>
                  <button type="button" className="insp-btn insp-btn-outline" style={{ padding: "2px 8px", fontSize: 11, color: "var(--insp-red)" }} onClick={() => removeRow(i)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="insp-btn insp-btn-outline" style={{ marginTop: 8, width: "auto", padding: "5px 14px", fontSize: 12 }} onClick={addRow}>
        + Add Row
      </button>
    </fieldset>
  );
}

function MPIForm({ data, onChange, current, updateField, openCertificate }: { data: MPIData; onChange: (patch: Partial<MPIData>) => void } & Props) {
  function updateCommon(patch: Partial<NDTCommonData>) { onChange({ common: { ...data.common, ...patch } }); }
  function updateFooter(patch: Partial<NDTFooterData>) { onChange({ footer: { ...data.footer, ...patch } }); }
  return (
    <>
      <NDTCommonFieldsForm idPrefix="mpi" data={data.common} onChange={updateCommon} current={current} updateField={updateField} />
      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Material &amp; Method</legend>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="mpi-material">Material Type</label><input id="mpi-material" value={data.materialType} onChange={(e) => onChange({ materialType: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="mpi-surface">Surface</label><input id="mpi-surface" value={data.surface} onChange={(e) => onChange({ surface: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="mpi-groove">Groove/Geometry</label><input id="mpi-groove" value={data.grooveGeometry} onChange={(e) => onChange({ grooveGeometry: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="mpi-welding">Welding Process</label><input id="mpi-welding" value={data.weldingProcess} onChange={(e) => onChange({ weldingProcess: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="mpi-welder">Welder's ID</label><input id="mpi-welder" value={data.weldersId} onChange={(e) => onChange({ weldersId: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="mpi-temp">Object Temperature</label><input id="mpi-temp" value={data.objectTemperature} onChange={(e) => onChange({ objectTemperature: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field">
            <label htmlFor="mpi-method">Method</label>
            <select id="mpi-method" value={data.method} onChange={(e) => onChange({ method: e.target.value as MPIData["method"] })}>
              <option value="">—</option>
              <option value="prods">Prods</option>
              <option value="yoke">Yoke</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="insp-field"><label htmlFor="mpi-smax">S max (mm)</label><input id="mpi-smax" value={data.methodSMax} onChange={(e) => onChange({ methodSMax: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field">
            <label htmlFor="mpi-current">Current</label>
            <select id="mpi-current" value={data.current} onChange={(e) => onChange({ current: e.target.value as MPIData["current"] })}>
              <option value="">—</option>
              <option value="ac">AC</option>
              <option value="dc">DC</option>
            </select>
          </div>
          <div className="insp-field"><label htmlFor="mpi-field-strength">Field Strength</label><input id="mpi-field-strength" value={data.fieldStrength} onChange={(e) => onChange({ fieldStrength: e.target.value })} /></div>
        </div>
      </fieldset>
      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Medium &amp; Magnetization</legend>
        <div className="insp-row2">
          <div className="insp-field">
            <label htmlFor="mpi-medium-wetdry">Medium</label>
            <select id="mpi-medium-wetdry" value={data.mediumWetDry} onChange={(e) => onChange({ mediumWetDry: e.target.value as MPIData["mediumWetDry"] })}>
              <option value="">—</option>
              <option value="wet">Wet</option>
              <option value="dry">Dry</option>
            </select>
          </div>
          <div className="insp-field">
            <label htmlFor="mpi-medium-type">Contrast</label>
            <select id="mpi-medium-type" value={data.mediumType} onChange={(e) => onChange({ mediumType: e.target.value as MPIData["mediumType"] })}>
              <option value="">—</option>
              <option value="black">Black</option>
              <option value="fluorescent">Fluorescent</option>
            </select>
          </div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="mpi-contrast-colour">Contrast Colour</label><input id="mpi-contrast-colour" value={data.contrastColour} onChange={(e) => onChange({ contrastColour: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="mpi-field-indicator">Field Indicator</label><input id="mpi-field-indicator" value={data.fieldIndicator} onChange={(e) => onChange({ fieldIndicator: e.target.value })} /></div>
        </div>
        <div className="insp-field">
          <label htmlFor="mpi-magnetized">Magnetized For</label>
          <select id="mpi-magnetized" value={data.magnetizedFor} onChange={(e) => onChange({ magnetizedFor: e.target.value as MPIData["magnetizedFor"] })}>
            <option value="">—</option>
            <option value="longitudinal">Longitudinal Defects</option>
            <option value="transverse">Transverse Defects</option>
            <option value="both">Longitudinal + Transverse Defects</option>
          </select>
        </div>
      </fieldset>
      <NDTFooterFieldsForm idPrefix="mpi" data={data.footer} onChange={updateFooter} />
      <VesselLookupAndSignatures current={current} updateField={updateField} openCertificate={openCertificate} />
    </>
  );
}

function PTForm({ data, onChange, current, updateField, openCertificate }: { data: PTData; onChange: (patch: Partial<PTData>) => void } & Props) {
  function updateCommon(patch: Partial<NDTCommonData>) { onChange({ common: { ...data.common, ...patch } }); }
  function updateFooter(patch: Partial<NDTFooterData>) { onChange({ footer: { ...data.footer, ...patch } }); }
  return (
    <>
      <NDTCommonFieldsForm idPrefix="pt" data={data.common} onChange={updateCommon} current={current} updateField={updateField} />
      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Material &amp; Surface</legend>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="pt-material">Material Type</label><input id="pt-material" value={data.materialType} onChange={(e) => onChange({ materialType: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="pt-surface">Surface</label><input id="pt-surface" value={data.surface} onChange={(e) => onChange({ surface: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="pt-groove">Groove/Geometry</label><input id="pt-groove" value={data.grooveGeometry} onChange={(e) => onChange({ grooveGeometry: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="pt-welding">Welding Process</label><input id="pt-welding" value={data.weldingProcess} onChange={(e) => onChange({ weldingProcess: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="pt-welder">Welder's ID</label><input id="pt-welder" value={data.weldersId} onChange={(e) => onChange({ weldersId: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="pt-temp">Object Temperature</label><input id="pt-temp" value={data.objectTemperature} onChange={(e) => onChange({ objectTemperature: e.target.value })} /></div>
        </div>
      </fieldset>
      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Penetrant</legend>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="pt-penetrant-type">Penetrant Type</label><input id="pt-penetrant-type" value={data.penetrantType} onChange={(e) => onChange({ penetrantType: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="pt-application">Application Method</label><input id="pt-application" value={data.applicationMethod} onChange={(e) => onChange({ applicationMethod: e.target.value })} /></div>
        </div>
        <YesNoField id="pt-fluorescent" label="Fluorescent" value={data.fluorescent} onChange={(v) => onChange({ fluorescent: v })} />
        <div className="insp-field">
          <label htmlFor="pt-remover">Penetrant Remover</label>
          <select id="pt-remover" value={data.penetrantRemover} onChange={(e) => onChange({ penetrantRemover: e.target.value as PTData["penetrantRemover"] })}>
            <option value="">—</option>
            <option value="water">Water</option>
            <option value="emulsifier">Emulsifier</option>
            <option value="solvent">Solvent</option>
          </select>
        </div>
        <div className="insp-field">
          <label htmlFor="pt-developer">Developer</label>
          <select id="pt-developer" value={data.developer} onChange={(e) => onChange({ developer: e.target.value as PTData["developer"] })}>
            <option value="">—</option>
            <option value="dry_powder">1. Dry Powder</option>
            <option value="solution_water">2. Solution in Water</option>
            <option value="suspension_water">3. Suspension in Water</option>
            <option value="powder_solvent">4. Powder in Volatile Solvent (Spray)</option>
          </select>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="pt-pen-time">Penetration Time</label><input id="pt-pen-time" value={data.penetrationTime} onChange={(e) => onChange({ penetrationTime: e.target.value })} placeholder="e.g. 20 min" /></div>
          <div className="insp-field"><label htmlFor="pt-dev-time">Developing Time</label><input id="pt-dev-time" value={data.developingTime} onChange={(e) => onChange({ developingTime: e.target.value })} placeholder="e.g. 20 min" /></div>
        </div>
      </fieldset>
      <NDTFooterFieldsForm idPrefix="pt" data={data.footer} onChange={updateFooter} />
      <VesselLookupAndSignatures current={current} updateField={updateField} openCertificate={openCertificate} />
    </>
  );
}

const RT_INDICATION_COLUMNS = [
  { key: "filmImageNo", label: "Film/Image No." },
  { key: "weldLocation", label: "Weld/Location" },
  { key: "indicationType", label: "Indication Type" },
  { key: "size", label: "Size (mm)" },
  { key: "evaluation", label: "Evaluation" },
];

function RTForm({ data, onChange, current, updateField, openCertificate }: { data: RTData; onChange: (patch: Partial<RTData>) => void } & Props) {
  function updateCommon(patch: Partial<NDTCommonData>) { onChange({ common: { ...data.common, ...patch } }); }
  function updateFooter(patch: Partial<NDTFooterData>) { onChange({ footer: { ...data.footer, ...patch } }); }
  return (
    <>
      <NDTCommonFieldsForm idPrefix="rt" data={data.common} onChange={updateCommon} current={current} updateField={updateField} />
      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Material &amp; Joint</legend>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="rt-material">Material Type</label><input id="rt-material" value={data.materialType} onChange={(e) => onChange({ materialType: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="rt-thickness">Thickness (mm)</label><input id="rt-thickness" value={data.thickness} onChange={(e) => onChange({ thickness: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="rt-joint">Joint/Weld Type</label><input id="rt-joint" value={data.jointWeldType} onChange={(e) => onChange({ jointWeldType: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="rt-welding">Welding Process</label><input id="rt-welding" value={data.weldingProcess} onChange={(e) => onChange({ weldingProcess: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="rt-welder">Welder's ID</label><input id="rt-welder" value={data.weldersId} onChange={(e) => onChange({ weldersId: e.target.value })} /></div>
          <div className="insp-field">
            <label htmlFor="rt-technique">Technique</label>
            <select id="rt-technique" value={data.technique} onChange={(e) => onChange({ technique: e.target.value as RTData["technique"] })}>
              <option value="">—</option>
              <option value="swsi">SWSI</option>
              <option value="dwsi">DWSI</option>
              <option value="dwdi">DWDI</option>
            </select>
          </div>
        </div>
      </fieldset>
      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Exposure Parameters</legend>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="rt-source">Source Type</label><input id="rt-source" value={data.sourceType} onChange={(e) => onChange({ sourceType: e.target.value })} placeholder="X-ray / Ir-192 / Co-60" /></div>
          <div className="insp-field"><label htmlFor="rt-focal">Focal Spot Size</label><input id="rt-focal" value={data.focalSpotSize} onChange={(e) => onChange({ focalSpotSize: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="rt-kv">kV / Curie (Ci)</label><input id="rt-kv" value={data.kvOrCurie} onChange={(e) => onChange({ kvOrCurie: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="rt-ma">mA / Exposure Time</label><input id="rt-ma" value={data.maOrExposureTime} onChange={(e) => onChange({ maOrExposureTime: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="rt-sfd">Source-to-Film Distance</label><input id="rt-sfd" value={data.sourceToFilmDistance} onChange={(e) => onChange({ sourceToFilmDistance: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="rt-screens">Screens (Front/Back)</label><input id="rt-screens" value={data.screens} onChange={(e) => onChange({ screens: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="rt-film">Film Type / Digital Detector</label><input id="rt-film" value={data.filmTypeOrDetector} onChange={(e) => onChange({ filmTypeOrDetector: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="rt-density">Density Range</label><input id="rt-density" value={data.densityRange} onChange={(e) => onChange({ densityRange: e.target.value })} /></div>
        </div>
      </fieldset>
      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Image Quality</legend>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="rt-iqi">IQI Type</label><input id="rt-iqi" value={data.iqiType} onChange={(e) => onChange({ iqiType: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="rt-sensitivity">Sensitivity Achieved (%)</label><input id="rt-sensitivity" value={data.sensitivityAchieved} onChange={(e) => onChange({ sensitivityAchieved: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="rt-exposures">No. of Exposures</label><input id="rt-exposures" value={data.numberOfExposures} onChange={(e) => onChange({ numberOfExposures: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="rt-viewing">Viewing Conditions</label><input id="rt-viewing" value={data.viewingConditions} onChange={(e) => onChange({ viewingConditions: e.target.value })} /></div>
        </div>
      </fieldset>
      <NDTIndicationsTable title="Indications / Test Result" columns={RT_INDICATION_COLUMNS} rows={data.indications} onChange={(rows) => onChange({ indications: rows })} />
      <NDTFooterFieldsForm idPrefix="rt" data={data.footer} onChange={updateFooter} />
      <VesselLookupAndSignatures current={current} updateField={updateField} openCertificate={openCertificate} />
    </>
  );
}

const UT_INDICATION_COLUMNS = [
  { key: "indNo", label: "Ind. No." },
  { key: "weldLocation", label: "Weld/Location" },
  { key: "length", label: "Length (mm)" },
  { key: "amplitude", label: "Amplitude (dB)" },
  { key: "depth", label: "Depth (mm)" },
  { key: "evaluation", label: "Evaluation" },
];

function UTForm({ data, onChange, current, updateField, openCertificate }: { data: UTData; onChange: (patch: Partial<UTData>) => void } & Props) {
  function updateCommon(patch: Partial<NDTCommonData>) { onChange({ common: { ...data.common, ...patch } }); }
  function updateFooter(patch: Partial<NDTFooterData>) { onChange({ footer: { ...data.footer, ...patch } }); }
  return (
    <>
      <NDTCommonFieldsForm idPrefix="ut" data={data.common} onChange={updateCommon} current={current} updateField={updateField} />
      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Material &amp; Weld</legend>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="ut-material">Material Type</label><input id="ut-material" value={data.materialType} onChange={(e) => onChange({ materialType: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="ut-surface">Surface</label><input id="ut-surface" value={data.surface} onChange={(e) => onChange({ surface: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="ut-groove">Groove/Geometry</label><input id="ut-groove" value={data.grooveGeometry} onChange={(e) => onChange({ grooveGeometry: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="ut-welding">Welding Process</label><input id="ut-welding" value={data.weldingProcess} onChange={(e) => onChange({ weldingProcess: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="ut-welder">Welder's ID</label><input id="ut-welder" value={data.weldersId} onChange={(e) => onChange({ weldersId: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="ut-temp">Object Temperature</label><input id="ut-temp" value={data.objectTemperature} onChange={(e) => onChange({ objectTemperature: e.target.value })} /></div>
        </div>
      </fieldset>
      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Equipment &amp; Probe</legend>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="ut-instrument">Instrument Type / Model</label><input id="ut-instrument" value={data.instrumentTypeModel} onChange={(e) => onChange({ instrumentTypeModel: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="ut-instrument-serial">Instrument Serial No.</label><input id="ut-instrument-serial" value={data.instrumentSerialNo} onChange={(e) => onChange({ instrumentSerialNo: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="ut-calib-due">Calibration Due Date</label><input id="ut-calib-due" type="date" value={data.calibrationDueDate} onChange={(e) => onChange({ calibrationDueDate: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="ut-ref-block">Reference/Calibration Block</label><input id="ut-ref-block" value={data.referenceBlock} onChange={(e) => onChange({ referenceBlock: e.target.value })} placeholder="e.g. IIW V1 / V2" /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="ut-probe-type">Probe Type</label><input id="ut-probe-type" value={data.probeType} onChange={(e) => onChange({ probeType: e.target.value })} placeholder="Angle / Straight beam" /></div>
          <div className="insp-field"><label htmlFor="ut-probe-freq">Frequency (MHz)</label><input id="ut-probe-freq" value={data.probeFrequency} onChange={(e) => onChange({ probeFrequency: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="ut-probe-angle">Angle</label><input id="ut-probe-angle" value={data.probeAngle} onChange={(e) => onChange({ probeAngle: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="ut-probe-size">Size</label><input id="ut-probe-size" value={data.probeSize} onChange={(e) => onChange({ probeSize: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="ut-couplant">Couplant</label><input id="ut-couplant" value={data.couplant} onChange={(e) => onChange({ couplant: e.target.value })} /></div>
          <div className="insp-field">
            <label htmlFor="ut-scanning">Scanning Technique</label>
            <select id="ut-scanning" value={data.scanningTechnique} onChange={(e) => onChange({ scanningTechnique: e.target.value as UTData["scanningTechnique"] })}>
              <option value="">—</option>
              <option value="contact">Contact</option>
              <option value="immersion">Immersion</option>
            </select>
          </div>
        </div>
      </fieldset>
      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Calibration &amp; Sensitivity</legend>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="ut-ref-level">Reference Level (dB)</label><input id="ut-ref-level" value={data.referenceLevel} onChange={(e) => onChange({ referenceLevel: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="ut-scan-sens">Scanning Sensitivity (dB)</label><input id="ut-scan-sens" value={data.scanningSensitivity} onChange={(e) => onChange({ scanningSensitivity: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="ut-rec-level">Recording Level (DAC/dB)</label><input id="ut-rec-level" value={data.recordingLevel} onChange={(e) => onChange({ recordingLevel: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="ut-report-level">Reporting Level (dB)</label><input id="ut-report-level" value={data.reportingLevel} onChange={(e) => onChange({ reportingLevel: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="ut-scan-coverage">Scan Coverage (%)</label><input id="ut-scan-coverage" value={data.scanCoverage} onChange={(e) => onChange({ scanCoverage: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="ut-beam-angle">Beam Angle Check</label><input id="ut-beam-angle" value={data.beamAngleCheck} onChange={(e) => onChange({ beamAngleCheck: e.target.value })} /></div>
        </div>
      </fieldset>
      <NDTIndicationsTable title="Indications / Test Result" columns={UT_INDICATION_COLUMNS} rows={data.indications} onChange={(rows) => onChange({ indications: rows })} />
      <NDTFooterFieldsForm idPrefix="ut" data={data.footer} onChange={updateFooter} />
      <VesselLookupAndSignatures current={current} updateField={updateField} openCertificate={openCertificate} />
    </>
  );
}

const VT_OBSERVATION_COLUMNS = [
  { key: "itemNo", label: "Item No." },
  { key: "locationWeld", label: "Location/Weld" },
  { key: "observation", label: "Observation" },
  { key: "evaluation", label: "Evaluation" },
];

function VTForm({ data, onChange, current, updateField, openCertificate }: { data: VTData; onChange: (patch: Partial<VTData>) => void } & Props) {
  function updateCommon(patch: Partial<NDTCommonData>) { onChange({ common: { ...data.common, ...patch } }); }
  function updateFooter(patch: Partial<NDTFooterData>) { onChange({ footer: { ...data.footer, ...patch } }); }
  return (
    <>
      <NDTCommonFieldsForm idPrefix="vt" data={data.common} onChange={updateCommon} current={current} updateField={updateField} />
      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Material &amp; Weld</legend>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="vt-material">Material Type</label><input id="vt-material" value={data.materialType} onChange={(e) => onChange({ materialType: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="vt-joint">Joint/Weld Type</label><input id="vt-joint" value={data.jointWeldType} onChange={(e) => onChange({ jointWeldType: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="vt-surface-cond">Surface Condition</label><input id="vt-surface-cond" value={data.surfaceCondition} onChange={(e) => onChange({ surfaceCondition: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="vt-welding">Welding Process</label><input id="vt-welding" value={data.weldingProcess} onChange={(e) => onChange({ weldingProcess: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="vt-welder">Welder's ID</label><input id="vt-welder" value={data.weldersId} onChange={(e) => onChange({ weldersId: e.target.value })} /></div>
          <div className="insp-field">
            <label htmlFor="vt-stage">Stage of Inspection</label>
            <select id="vt-stage" value={data.stageOfInspection} onChange={(e) => onChange({ stageOfInspection: e.target.value as VTData["stageOfInspection"] })}>
              <option value="">—</option>
              <option value="pre_weld">Pre-Weld</option>
              <option value="in_process">In-Process</option>
              <option value="final">Final</option>
            </select>
          </div>
        </div>
      </fieldset>
      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Inspection Conditions</legend>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="vt-illumination">Illumination Level (lux)</label><input id="vt-illumination" value={data.illuminationLevel} onChange={(e) => onChange({ illuminationLevel: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="vt-viewing">Viewing Distance/Angle</label><input id="vt-viewing" value={data.viewingDistanceAngle} onChange={(e) => onChange({ viewingDistanceAngle: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="vt-aids">Aids Used</label><input id="vt-aids" value={data.aidsUsed} onChange={(e) => onChange({ aidsUsed: e.target.value })} placeholder="Mirror / borescope / magnifier / weld gauge" /></div>
          <div className="insp-field">
            <label htmlFor="vt-direct">Direct or Remote Visual</label>
            <select id="vt-direct" value={data.directOrRemote} onChange={(e) => onChange({ directOrRemote: e.target.value as VTData["directOrRemote"] })}>
              <option value="">—</option>
              <option value="direct">Direct</option>
              <option value="remote">Remote</option>
            </select>
          </div>
        </div>
      </fieldset>
      <NDTIndicationsTable title="Observations / Test Result" columns={VT_OBSERVATION_COLUMNS} rows={data.observations} onChange={(rows) => onChange({ observations: rows })} />
      <NDTFooterFieldsForm idPrefix="vt" data={data.footer} onChange={updateFooter} />
      <VesselLookupAndSignatures current={current} updateField={updateField} openCertificate={openCertificate} />
    </>
  );
}

const ET_INDICATION_COLUMNS = [
  { key: "indNo", label: "Ind. No." },
  { key: "weldLocation", label: "Weld/Location" },
  { key: "signalAmplitude", label: "Signal Amplitude" },
  { key: "phaseAngle", label: "Phase Angle" },
  { key: "evaluation", label: "Evaluation" },
];

function ETForm({ data, onChange, current, updateField, openCertificate }: { data: ETData; onChange: (patch: Partial<ETData>) => void } & Props) {
  function updateCommon(patch: Partial<NDTCommonData>) { onChange({ common: { ...data.common, ...patch } }); }
  function updateFooter(patch: Partial<NDTFooterData>) { onChange({ footer: { ...data.footer, ...patch } }); }
  return (
    <>
      <NDTCommonFieldsForm idPrefix="et" data={data.common} onChange={updateCommon} current={current} updateField={updateField} />
      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Material &amp; Weld</legend>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="et-material">Material Type</label><input id="et-material" value={data.materialType} onChange={(e) => onChange({ materialType: e.target.value })} placeholder="Non-ferromagnetic preferred" /></div>
          <div className="insp-field"><label htmlFor="et-surface">Surface</label><input id="et-surface" value={data.surface} onChange={(e) => onChange({ surface: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="et-groove">Groove/Geometry</label><input id="et-groove" value={data.grooveGeometry} onChange={(e) => onChange({ grooveGeometry: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="et-welding">Welding Process</label><input id="et-welding" value={data.weldingProcess} onChange={(e) => onChange({ weldingProcess: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="et-welder">Welder's ID</label><input id="et-welder" value={data.weldersId} onChange={(e) => onChange({ weldersId: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="et-temp">Object Temperature</label><input id="et-temp" value={data.objectTemperature} onChange={(e) => onChange({ objectTemperature: e.target.value })} /></div>
        </div>
      </fieldset>
      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Equipment</legend>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="et-instrument">Instrument Type / Model</label><input id="et-instrument" value={data.instrumentTypeModel} onChange={(e) => onChange({ instrumentTypeModel: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="et-instrument-serial">Instrument Serial No.</label><input id="et-instrument-serial" value={data.instrumentSerialNo} onChange={(e) => onChange({ instrumentSerialNo: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="et-calib-due">Calibration Due Date</label><input id="et-calib-due" type="date" value={data.calibrationDueDate} onChange={(e) => onChange({ calibrationDueDate: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="et-ref-standard">Reference Standard/Block</label><input id="et-ref-standard" value={data.referenceStandardBlock} onChange={(e) => onChange({ referenceStandardBlock: e.target.value })} placeholder="Artificial notch depth/size" /></div>
        </div>
      </fieldset>
      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Probe &amp; Settings</legend>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="et-probe-type">Probe Type</label><input id="et-probe-type" value={data.probeType} onChange={(e) => onChange({ probeType: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="et-frequency">Frequency (kHz)</label><input id="et-frequency" value={data.frequency} onChange={(e) => onChange({ frequency: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="et-gain">Gain (dB)</label><input id="et-gain" value={data.gain} onChange={(e) => onChange({ gain: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="et-phase">Phase Angle</label><input id="et-phase" value={data.phaseAngle} onChange={(e) => onChange({ phaseAngle: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="et-scan-coverage">Scan Coverage (%)</label><input id="et-scan-coverage" value={data.scanCoverage} onChange={(e) => onChange({ scanCoverage: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="et-scan-speed">Scan Speed</label><input id="et-scan-speed" value={data.scanSpeed} onChange={(e) => onChange({ scanSpeed: e.target.value })} /></div>
        </div>
      </fieldset>
      <NDTIndicationsTable title="Indications / Test Result" columns={ET_INDICATION_COLUMNS} rows={data.indications} onChange={(rows) => onChange({ indications: rows })} />
      <NDTFooterFieldsForm idPrefix="et" data={data.footer} onChange={updateFooter} />
      <VesselLookupAndSignatures current={current} updateField={updateField} openCertificate={openCertificate} />
    </>
  );
}

function LoadTestForm({ data, onChange, current, updateField, openCertificate }: { data: LoadTestData; onChange: (patch: Partial<LoadTestData>) => void } & Props) {
  function updateRow(i: number, value: string) {
    const next = [...data.rows];
    next[i] = { ...next[i], value };
    onChange({ rows: next });
  }
  return (
    <>
      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Load Test Report</legend>
        <p className="insp-help-note">
          Report in accordance with SOLAS Chapter III Regulation 20.11.1.3, SOLAS Chapter III Regulation 20.11.2.3, and LSA Code
          Part 2, Production and Installation Tests, 6.1.5.
        </p>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="lt-certno">Report No.</label><input id="lt-certno" value={current.certNo} readOnly /></div>
          <div className="insp-field"><label htmlFor="lt-date">Date</label><input id="lt-date" type="date" value={current.dateOfServicing} onChange={(e) => updateField("dateOfServicing", e.target.value)} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="lt-vessel">Vessel Name</label><input id="lt-vessel" value={current.vesselName} onChange={(e) => updateField("vesselName", e.target.value)} /></div>
          <div className="insp-field"><label htmlFor="lt-imo">IMO</label><input id="lt-imo" value={current.imoNo} onChange={(e) => updateField("imoNo", e.target.value)} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="lt-flag">Flag</label><input id="lt-flag" value={current.flag} onChange={(e) => updateField("flag", e.target.value)} /></div>
          <div className="insp-field"><label htmlFor="lt-lsatype">Type of LSA Equipment</label><input id="lt-lsatype" value={data.typeOfLsaEquipment} onChange={(e) => onChange({ typeOfLsaEquipment: e.target.value })} /></div>
        </div>
        <div className="insp-field"><label htmlFor="lt-lsalocation">LSA Location Onboard</label><input id="lt-lsalocation" value={data.lsaLocationOnboard} onChange={(e) => onChange({ lsaLocationOnboard: e.target.value })} /></div>
      </fieldset>

      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Load Calculation</legend>
        <p className="insp-help-note">
          From LSA Code: the boat loaded with its normal equipment and a distributed mass equal to that of the number of
          persons, each weighing the applicable weight + 10% of the working load.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", minWidth: 700 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #DCE1E5" }}>
                <th style={{ padding: "4px 6px", width: 30 }}></th>
                <th style={{ padding: "4px 6px" }}>Description</th>
                <th style={{ padding: "4px 6px", width: 140 }}>Kg / Lbs / Bar</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <tr key={row.label} style={{ borderTop: "1px solid #EEF1F3" }}>
                  <td style={{ padding: "4px 6px", fontWeight: 700, color: "var(--insp-navy)" }}>{row.label}</td>
                  <td style={{ padding: "4px 6px", fontSize: 11 }}>{row.description}</td>
                  <td style={{ padding: "4px 6px" }}><input value={row.value} onChange={(e) => updateRow(i, e.target.value)} style={{ width: "100%" }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="insp-help-note" style={{ marginTop: 6 }}>Note: when using a test kit for the load test, apply the applicable pressure conversion table.</p>
      </fieldset>

      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Remarks</legend>
        <textarea rows={3} value={data.remarks} onChange={(e) => onChange({ remarks: e.target.value })} />
      </fieldset>

      <VesselLookupAndSignatures current={current} updateField={updateField} openCertificate={openCertificate} />
    </>
  );
}
