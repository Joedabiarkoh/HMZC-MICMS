import {
  LOOSE_GEAR_SUB_TYPES,
  freshLooseGearRegisterRow,
  freshLooseGearState,
} from "../data/inspectionHelpers";
import {
  InspectionCertificate,
  LooseGearData,
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

interface Props {
  current: InspectionCertificate;
  updateField: <K extends keyof InspectionCertificate>(key: K, value: InspectionCertificate[K]) => void;
  openCertificate: (certNo: string) => void;
}

/**
 * Requested directly: put HMZC's three real LOLER 1998 "Report of
 * Thorough Examination" templates into the Loose Gear & Lifting
 * Equipment division AS PROVIDED — each kept as its own selectable
 * sub-type with its own original field layout, the same pattern FFE
 * already uses for its ~20 sub-types (see ffeCertTypes.ts), rather than
 * merged into one shape or restyled to look like FFE's certificate.
 */
export default function LooseGearForm({ current, updateField, openCertificate }: Props) {
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

      {looseGear.subType === "visual_certificate" && looseGear.visualCert && (
        <VisualCertForm data={looseGear.visualCert} onChange={updateVisualCert} current={current} updateField={updateField} openCertificate={openCertificate} />
      )}
      {looseGear.subType === "standard_report" && looseGear.standardReport && (
        <StandardReportForm data={looseGear.standardReport} onChange={updateStandardReport} current={current} updateField={updateField} openCertificate={openCertificate} />
      )}
      {looseGear.subType === "multiple_items" && looseGear.multipleItems && (
        <MultipleItemsForm data={looseGear.multipleItems} onChange={updateMultipleItems} current={current} updateField={updateField} openCertificate={openCertificate} />
      )}
    </>
  );
}

function YesNoField({ id, label, value, onChange }: { id: string; label: string; value: LooseGearYesNo; onChange: (v: LooseGearYesNo) => void }) {
  return (
    <div className="insp-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as LooseGearYesNo)}>
        <option value="">—</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </div>
  );
}

function VesselLookupAndSignatures({ current, updateField, openCertificate }: Props) {
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
      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Signatures</legend>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="lg-master-name">Master Name (optional)</label><input id="lg-master-name" value={current.captainName} onChange={(e) => updateField("captainName", e.target.value)} /></div>
          <div className="insp-field"><label htmlFor="lg-technician-name">Inspector Name</label><input id="lg-technician-name" value={current.engineerName} onChange={(e) => updateField("engineerName", e.target.value)} /></div>
        </div>
        <div className="insp-row2">
          <SignatureCanvas label="Master Signature" value={current.captainSig} onChange={(v) => updateField("captainSig", v)} />
          <SignatureCanvas label="Inspector Signature" value={current.engineerSig} onChange={(v) => updateField("engineerSig", v)} allowSavedDefault />
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

function StandardReportForm({
  data, onChange, current, updateField, openCertificate,
}: { data: LooseGearStandardReportData; onChange: (patch: Partial<LooseGearStandardReportData>) => void } & Props) {
  function updateStatutory(patch: Partial<LooseGearStatutoryAnswers>) {
    onChange({ statutory: { ...data.statutory, ...patch } });
  }

  return (
    <>
      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Report of Thorough Examination</legend>
        <p style={{ fontSize: 11, color: "var(--insp-muted)", marginTop: -4 }}>
          Lifting &amp; Rigging colour code is based on ACEPA (Association of Companies of Oil Exploration and Production in Angola).
        </p>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="sr-certno">Certificate No</label><input id="sr-certno" value={current.certNo} readOnly /></div>
          <div className="insp-field"><label htmlFor="sr-vessel">Vessel</label><input id="sr-vessel" value={current.vesselName} onChange={(e) => updateField("vesselName", e.target.value)} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="sr-date-exam">Date of Thorough Examination</label><input id="sr-date-exam" type="date" value={data.dateOfExamination} onChange={(e) => onChange({ dateOfExamination: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="sr-date-report">Date of Report</label><input id="sr-date-report" type="date" value={data.dateOfReport} onChange={(e) => onChange({ dateOfReport: e.target.value })} /></div>
        </div>
        <div className="insp-field"><label htmlFor="sr-reportnum">Report Number</label><input id="sr-reportnum" value={data.reportNumber} onChange={(e) => onChange({ reportNumber: e.target.value })} /></div>
        <div className="insp-field"><label htmlFor="sr-client-employer">Name &amp; Address of Employer for Whom the Examination Was Made</label><input id="sr-client-employer" value={data.clientEmployerNameAddress} onChange={(e) => onChange({ clientEmployerNameAddress: e.target.value })} /></div>
        <div className="insp-field"><label htmlFor="sr-premises">Address of Premises at Which the Examination Was Made</label><input id="sr-premises" value={data.premisesAddress} onChange={(e) => onChange({ premisesAddress: e.target.value })} /></div>
        <div className="insp-field"><label htmlFor="sr-equip-desc">Description and Identification of the Equipment</label><input id="sr-equip-desc" value={data.equipmentDescription} onChange={(e) => onChange({ equipmentDescription: e.target.value })} /></div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="sr-swl">Safe Working Load(s)</label><input id="sr-swl" value={data.swl} onChange={(e) => onChange({ swl: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="sr-mfg-date">Date of Manufacture (if known)</label><input id="sr-mfg-date" type="date" value={data.dateOfManufacture} onChange={(e) => onChange({ dateOfManufacture: e.target.value })} /></div>
        </div>
        <div className="insp-field"><label htmlFor="sr-last-exam">Date of Last Thorough Examination</label><input id="sr-last-exam" type="date" value={data.dateOfLastExamination} onChange={(e) => onChange({ dateOfLastExamination: e.target.value })} /></div>
      </fieldset>

      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Statutory Declaration</legend>
        <StatutoryQuestionsBlock id="sr" data={data.statutory} onChange={updateStatutory} />
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="sr-reported-by">Name &amp; Qualifications of person making this report</label><input id="sr-reported-by" value={data.reportedByNameAndQualifications} onChange={(e) => onChange({ reportedByNameAndQualifications: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="sr-authenticated">Name of person signing/authenticating this report</label><input id="sr-authenticated" value={data.authenticatedByName} onChange={(e) => onChange({ authenticatedByName: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="sr-next-exam">Latest Date Next Examination Must Be Carried Out</label><input id="sr-next-exam" type="date" value={data.nextExaminationDue} onChange={(e) => onChange({ nextExaminationDue: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="sr-employer">Name &amp; Address of Employer (of persons making/authenticating report)</label><input id="sr-employer" value={data.authenticatingEmployerNameAddress} onChange={(e) => onChange({ authenticatingEmployerNameAddress: e.target.value })} /></div>
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
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="mi-jobpo">Job/PO No.</label><input id="mi-jobpo" value={data.jobPoNo} onChange={(e) => onChange({ jobPoNo: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="mi-inspectedby">Inspected By</label><input id="mi-inspectedby" value={data.inspectedBy} onChange={(e) => onChange({ inspectedBy: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="mi-vessel">Vessel Name</label><input id="mi-vessel" value={current.vesselName} onChange={(e) => updateField("vesselName", e.target.value)} /></div>
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
