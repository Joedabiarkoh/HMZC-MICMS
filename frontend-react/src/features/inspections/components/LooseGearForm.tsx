import {
  LOOSE_GEAR_SUB_TYPES,
  freshLooseGearRegisterRow,
  freshLooseGearState,
} from "../data/inspectionHelpers";
import LooseGearJobPicker from "./LooseGearJobPicker";
import {
  InspectionCertificate,
  LooseGearData,
  LooseGearExaminationType,
  LooseGearMultipleItemsData,
  LooseGearReasonForInspection,
  LooseGearRegisterRow,
  LooseGearStandardReportData,
  LooseGearStatutoryAnswers,
  LooseGearVisualCertData,
  LooseGearYesNo,
} from "../types/inspection.types";
import VesselLookupPanel from "./VesselLookupPanel";
import SignatureCanvas from "./SignatureCanvas";
import PhotoUpload from "./PhotoUpload";
import { PhotoEvidence } from "../types/inspection.types";

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
export default function LooseGearForm({ current, updateField, openCertificate, certificates }: Props) {
  const looseGear = current.looseGear || freshLooseGearState();

  function changeSubType(id: LooseGearData["subType"]) {
    updateField("looseGear", freshLooseGearState(id));
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

  // Requested directly: "before you create a certificate job number
  // must be created for you" — a brand-new (never-saved) Standard
  // Report or Multiple Items certificate with no Job attached yet
  // shows the Job Picker instead of the normal form; certificates
  // already saved (existing in `certificates`, including ones that
  // predate this feature and so have no jobRef at all) skip it
  // entirely — this only ever gates the moment a NEW item is created,
  // never re-blocks an already-issued one.
  const needsJobPicker =
    (looseGear.subType === "standard_report" || looseGear.subType === "multiple_items") &&
    !looseGear.jobRef &&
    !certificates[current.certNo];

  function handleJobSelected({ jobNo, certNo }: { jobNo: string; certNo: string }) {
    updateField("certNo", certNo);
    const nextLooseGear = { ...looseGear, jobRef: jobNo };
    if (nextLooseGear.standardReport) nextLooseGear.standardReport = { ...nextLooseGear.standardReport, jobNo };
    updateField("looseGear", nextLooseGear);
  }

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

      {needsJobPicker ? (
        <LooseGearJobPicker
          vesselName={current.vesselName}
          imoNo={current.imoNo}
          onVesselChange={(v) => updateField("vesselName", v)}
          onImoChange={(v) => updateField("imoNo", v)}
          onJobSelected={handleJobSelected}
        />
      ) : (
        <>
          {looseGear.subType === "visual_certificate" && looseGear.visualCert && (
            <VisualCertForm data={looseGear.visualCert} onChange={updateVisualCert} current={current} updateField={updateField} openCertificate={openCertificate} certificates={certificates} />
          )}
          {looseGear.subType === "standard_report" && looseGear.standardReport && (
            <StandardReportForm data={looseGear.standardReport} onChange={updateStandardReport} current={current} updateField={updateField} openCertificate={openCertificate} certificates={certificates} />
          )}
          {looseGear.subType === "multiple_items" && looseGear.multipleItems && (
            <MultipleItemsForm data={looseGear.multipleItems} onChange={updateMultipleItems} current={current} updateField={updateField} openCertificate={openCertificate} certificates={certificates} />
          )}
        </>
      )}
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
          nowhere. */}
      {current.looseGear?.subType === "visual_certificate" && (
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
          Certificate — same shared cert.engineerName/engineerSig
          field either way, just the label shown.
          Requested directly: "remove the previous examiner sign and
          master sign section on the lose gear[,] make the whole
          document layout just as the pdf loaded" — the reference has
          only one signer block ("Examination Carried Out By /
          Examiner Details"), no separate Master/Captain row, so that
          field pair is hidden for standard_report only (Multiple
          Items and the legacy Visual Certificate still use both —
          see the print-side StandardReportPage/SignatureGrid in
          CertificatePreview.tsx for the matching change). */}
      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Signatures</legend>
        {current.looseGear?.subType !== "standard_report" && (
          <div className="insp-row2">
            <div className="insp-field"><label htmlFor="lg-master-name">Master Name (optional)</label><input id="lg-master-name" value={current.captainName} onChange={(e) => updateField("captainName", e.target.value)} /></div>
            <div className="insp-field">
              <label htmlFor="lg-technician-name">Inspector Name</label>
              <input id="lg-technician-name" value={current.engineerName} onChange={(e) => updateField("engineerName", e.target.value)} />
            </div>
          </div>
        )}
        {current.looseGear?.subType === "standard_report" && (
          <div className="insp-field"><label htmlFor="lg-technician-name">Examiner Name</label><input id="lg-technician-name" value={current.engineerName} onChange={(e) => updateField("engineerName", e.target.value)} /></div>
        )}
        <div className="insp-row2">
          {current.looseGear?.subType !== "standard_report" && (
            <SignatureCanvas label="Master Signature" value={current.captainSig} onChange={(v) => updateField("captainSig", v)} />
          )}
          <SignatureCanvas
            label={current.looseGear?.subType === "standard_report" ? "Examiner Signature" : "Inspector Signature"}
            value={current.engineerSig}
            onChange={(v) => updateField("engineerSig", v)}
            allowSavedDefault
          />
        </div>
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
        {/* Requested directly: "look at this [BDA Technical Guide] at
            the report section and include section where needed" —
            LOLER Schedule 1 item 11 requires its own "date of the
            report", distinct from the date the examination itself was
            carried out above (the BDA's own example RTE shows these
            as two separate fields). */}
        <div className="insp-field"><label htmlFor="sr-date-report">Date of Report</label><input id="sr-date-report" type="date" value={data.dateOfReport} onChange={(e) => onChange({ dateOfReport: e.target.value })} /></div>
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
          <div className="insp-field"><label htmlFor="sr-jobno">Job No</label><input id="sr-jobno" value={data.jobNo} readOnly /></div>
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
        <legend className="insp-legend">Description and Identification of the Equipment Item Examined</legend>
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
          <div className="insp-field"><label htmlFor="sr-ewl">E.W.L</label><input id="sr-ewl" value={data.ewl} onChange={(e) => onChange({ ewl: e.target.value })} /></div>
        </div>
        {/* Requested directly, from the BDA Technical Guide (Thorough
            Examinations: Steel wire ropes, lifting accessories and
            certification): "The BDA further recommends that the
            Factor of Safety used to calculate WLLs... is added to the
            certificate" — MBL (Minimum Breaking Load) is the figure
            SWL/WLL is calculated FROM (WLL = MBL / FoS), and the
            guide's own example RTE records both alongside SWL for
            that reason. */}
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="sr-mbl">MBL (Minimum Breaking Load)</label><input id="sr-mbl" value={data.mbl} onChange={(e) => onChange({ mbl: e.target.value })} placeholder="e.g. 7.12t" /></div>
          <div className="insp-field"><label htmlFor="sr-fos">Factor of Safety</label><input id="sr-fos" value={data.factorOfSafety} onChange={(e) => onChange({ factorOfSafety: e.target.value })} placeholder="e.g. 5:1" /></div>
        </div>
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

      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Examiner Details</legend>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="sr-examiner-position">Position</label><input id="sr-examiner-position" value={data.examinerPosition} onChange={(e) => onChange({ examinerPosition: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="sr-leea">LEEA ID Number</label><input id="sr-leea" value={data.leeaIdNumber} onChange={(e) => onChange({ leeaIdNumber: e.target.value })} /></div>
        </div>
        <p className="insp-help-note">Name and Signature are captured below, under Signatures.</p>
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
  data, onChange, current, updateField, openCertificate,
}: { data: LooseGearMultipleItemsData; onChange: (patch: Partial<LooseGearMultipleItemsData>) => void } & Props) {
  function addRow() {
    onChange({ rows: [...data.rows, freshLooseGearRegisterRow()] });
  }
  function removeRow(i: number) {
    const next = [...data.rows];
    next.splice(i, 1);
    onChange({ rows: next });
  }
  function updateRow(i: number, patch: Partial<LooseGearRegisterRow>) {
    const next = [...data.rows];
    next[i] = { ...next[i], ...patch };
    onChange({ rows: next });
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
        <div className="insp-field"><label htmlFor="mi-hmzc-job">HMZC Job No</label><input id="mi-hmzc-job" value={current.looseGear?.jobRef || "—"} readOnly /></div>
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
                <th style={{ padding: "4px 6px" }}>Result</th>
                <th style={{ padding: "4px 6px" }}>Cert No./Test Date</th>
                <th style={{ padding: "4px 6px" }}>Item Location</th>
                <th style={{ padding: "4px 6px" }}>Type of Inspection</th>
                <th style={{ padding: "4px 6px" }}>Next Inspection Date</th>
                <th style={{ padding: "4px 6px" }}>Safe to Use</th>
                <th style={{ width: 40 }}></th>
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
                  <td style={{ padding: "4px 6px" }}><input value={row.result} onChange={(e) => updateRow(i, { result: e.target.value })} style={{ width: "100%" }} placeholder="Satisfactory" /></td>
                  <td style={{ padding: "4px 6px" }}><input value={row.certNoTestDate} onChange={(e) => updateRow(i, { certNoTestDate: e.target.value })} style={{ width: "100%" }} /></td>
                  <td style={{ padding: "4px 6px" }}><input value={row.itemLocation} onChange={(e) => updateRow(i, { itemLocation: e.target.value })} style={{ width: "100%" }} /></td>
                  <td style={{ padding: "4px 6px" }}><input value={row.typeOfInspection} onChange={(e) => updateRow(i, { typeOfInspection: e.target.value })} style={{ width: "100%" }} placeholder="Visual" /></td>
                  <td style={{ padding: "4px 6px" }}><input type="date" value={row.nextInspectionDate} onChange={(e) => updateRow(i, { nextInspectionDate: e.target.value })} style={{ width: "100%" }} /></td>
                  <td style={{ padding: "4px 6px" }}>
                    <select value={row.safeToUse} onChange={(e) => updateRow(i, { safeToUse: e.target.value as LooseGearYesNo })}>
                      <option value="">—</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </td>
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

      <VesselLookupAndSignatures current={current} updateField={updateField} openCertificate={openCertificate} />
    </>
  );
}
