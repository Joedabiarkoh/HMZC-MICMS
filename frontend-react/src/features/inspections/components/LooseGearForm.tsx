import { freshLooseGearItem } from "../data/inspectionHelpers";
import { InspectionCertificate, LooseGearItem, LooseGearYesNo } from "../types/inspection.types";
import VesselLookupPanel from "./VesselLookupPanel";
import SignatureCanvas from "./SignatureCanvas";

interface Props {
  current: InspectionCertificate;
  updateField: <K extends keyof InspectionCertificate>(key: K, value: InspectionCertificate[K]) => void;
  openCertificate: (certNo: string) => void;
}

/**
 * Requested directly: put HMZC's real LOLER 1998 "Report of Thorough
 * Examination" templates into the Loose Gear & Lifting Equipment
 * division — a single-item statutory form and a "multiple items"
 * register variant (Downloads/Report of Thorough Inspection*.docx).
 * Every item in the register carries its own full statutory
 * declaration (see LooseGearItem's own comment in inspection.types.ts)
 * rather than one shared declaration for the whole batch, so each is
 * rendered as its own numbered block, not a compact table row like
 * FFE's item register — there are simply too many fields per item
 * (~25) to fit a table column.
 */
export default function LooseGearForm({ current, updateField, openCertificate }: Props) {
  const looseGear = current.looseGear || { jobPoNo: "", colourCode: "", items: [] };

  function update(patch: Partial<typeof looseGear>) {
    updateField("looseGear", { ...looseGear, ...patch });
  }

  function addItem() {
    update({ items: [...looseGear.items, freshLooseGearItem()] });
  }

  function removeItem(index: number) {
    const next = [...looseGear.items];
    next.splice(index, 1);
    update({ items: next });
  }

  function updateItem(index: number, patch: Partial<LooseGearItem>) {
    const next = [...looseGear.items];
    next[index] = { ...next[index], ...patch };
    update({ items: next });
  }

  return (
    <>
      {/* Harmonized header — same 3-row pattern as FFE's, plus the two
          loosegear-specific fields (Job/PO No, Colour Code) the source
          forms add on top of the shared vessel/cert/IMO/date fields. */}
      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Certificate</legend>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="lg-vessel">Vessel</label><input id="lg-vessel" value={current.vesselName} onChange={(e) => updateField("vesselName", e.target.value)} /></div>
          <div className="insp-field"><label htmlFor="lg-cert-no">Certificate No</label><input id="lg-cert-no" value={current.certNo} readOnly /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="lg-imo">IMO No</label><input id="lg-imo" value={current.imoNo} onChange={(e) => updateField("imoNo", e.target.value)} /></div>
          <div className="insp-field"><label htmlFor="lg-date">Date of Report</label><input id="lg-date" type="date" value={current.dateOfServicing} onChange={(e) => updateField("dateOfServicing", e.target.value)} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="lg-jobpo">Job/PO No.</label><input id="lg-jobpo" value={looseGear.jobPoNo} onChange={(e) => update({ jobPoNo: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="lg-location">Location/Port</label><input id="lg-location" value={current.location} onChange={(e) => updateField("location", e.target.value)} /></div>
        </div>
        <div className="insp-field"><label htmlFor="lg-colour">Colour Code</label><input id="lg-colour" value={looseGear.colourCode} onChange={(e) => update({ colourCode: e.target.value })} placeholder="e.g. Blue" /></div>
      </fieldset>

      <VesselLookupPanel
        vesselName={current.vesselName}
        imoNo={current.imoNo}
        onOpenCertificate={(certNo, equipmentType) => {
          if (equipmentType === current.type) {
            openCertificate(certNo);
          } else {
            window.location.href = `/inspections?type=${equipmentType}&open=${encodeURIComponent(certNo)}`;
          }
        }}
      />

      {looseGear.items.map((item, i) => (
        <LooseGearItemBlock
          key={i}
          index={i}
          item={item}
          onChange={(patch) => updateItem(i, patch)}
          onRemove={() => removeItem(i)}
        />
      ))}

      <button type="button" className="insp-btn insp-btn-outline" style={{ marginBottom: 14 }} onClick={addItem}>
        + Add Item
      </button>

      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Signatures</legend>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="lg-master-name">Master Name (optional)</label><input id="lg-master-name" value={current.captainName} onChange={(e) => updateField("captainName", e.target.value)} /></div>
          <div className="insp-field"><label htmlFor="lg-technician-name">Technician Name</label><input id="lg-technician-name" value={current.engineerName} onChange={(e) => updateField("engineerName", e.target.value)} /></div>
        </div>
        <div className="insp-row2">
          <SignatureCanvas label="Master Signature" value={current.captainSig} onChange={(v) => updateField("captainSig", v)} />
          <SignatureCanvas label="Technician Signature" value={current.engineerSig} onChange={(v) => updateField("engineerSig", v)} allowSavedDefault />
        </div>
      </fieldset>
    </>
  );
}

function YesNoField({
  id, label, value, onChange,
}: {
  id: string;
  label: string;
  value: LooseGearYesNo;
  onChange: (v: LooseGearYesNo) => void;
}) {
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

function LooseGearItemBlock({
  index, item, onChange, onRemove,
}: {
  index: number;
  item: LooseGearItem;
  onChange: (patch: Partial<LooseGearItem>) => void;
  onRemove: () => void;
}) {
  const p = `lg-item-${index}`;
  return (
    <fieldset className="insp-fieldset">
      <legend className="insp-legend" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Item {index + 1} — Statutory Declaration</span>
        <button type="button" className="insp-btn insp-btn-outline" style={{ padding: "2px 10px", fontSize: 11, color: "var(--insp-red)" }} onClick={onRemove}>
          Remove Item
        </button>
      </legend>

      <div className="insp-row2">
        <div className="insp-field"><label htmlFor={`${p}-serial`}>Item Serial No.</label><input id={`${p}-serial`} value={item.itemSerialNo} onChange={(e) => onChange({ itemSerialNo: e.target.value })} /></div>
        <div className="insp-field"><label htmlFor={`${p}-desc`}>Item Description</label><input id={`${p}-desc`} value={item.itemDescription} onChange={(e) => onChange({ itemDescription: e.target.value })} placeholder="e.g. Screw Pin Bow Shackle" /></div>
      </div>
      <div className="insp-row2">
        <div className="insp-field"><label htmlFor={`${p}-swl`}>SWL (as stated on item)</label><input id={`${p}-swl`} value={item.swl} onChange={(e) => onChange({ swl: e.target.value })} placeholder="e.g. 2 ton" /></div>
        <div className="insp-field"><label htmlFor={`${p}-location`}>Item Location</label><input id={`${p}-location`} value={item.itemLocation} onChange={(e) => onChange({ itemLocation: e.target.value })} placeholder="e.g. Deck Floor" /></div>
      </div>
      <div className="insp-row2">
        <div className="insp-field"><label htmlFor={`${p}-manufacturer`}>Manufacturer</label><input id={`${p}-manufacturer`} value={item.manufacturer} onChange={(e) => onChange({ manufacturer: e.target.value })} /></div>
        <div className="insp-field"><label htmlFor={`${p}-prev-cert`}>Previous Certificate No.</label><input id={`${p}-prev-cert`} value={item.previousCertificateNo} onChange={(e) => onChange({ previousCertificateNo: e.target.value })} /></div>
      </div>
      <div className="insp-row2">
        <div className="insp-field"><label htmlFor={`${p}-prev-date`}>Previous Inspection Date</label><input id={`${p}-prev-date`} type="date" value={item.previousInspectionDate} onChange={(e) => onChange({ previousInspectionDate: e.target.value })} /></div>
        <div className="insp-field"><label htmlFor={`${p}-test-date`}>Test Date</label><input id={`${p}-test-date`} type="date" value={item.testDate} onChange={(e) => onChange({ testDate: e.target.value })} /></div>
      </div>

      <div className="insp-row2">
        <YesNoField id={`${p}-ec`} label="EC Declaration Available?" value={item.ecDeclarationAvailable} onChange={(v) => onChange({ ecDeclarationAvailable: v })} />
        <YesNoField id={`${p}-ce`} label="CE Mark Clearly Visible?" value={item.ceMarkVisible} onChange={(v) => onChange({ ceMarkVisible: v })} />
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--insp-navy)", margin: "8px 0 4px", textTransform: "uppercase" }}>LOLER 1998 Statutory Questions</div>
      <div className="insp-row2">
        <YesNoField id={`${p}-first-exam`} label="First examination after install/assembly at a new site?" value={item.firstExaminationAfterInstall} onChange={(v) => onChange({ firstExaminationAfterInstall: v })} />
        <YesNoField id={`${p}-installed-ok`} label="If YES above — installed correctly?" value={item.installedCorrectly} onChange={(v) => onChange({ installedCorrectly: v })} />
      </div>
      <div className="insp-row2">
        <YesNoField id={`${p}-within-6`} label="Examined within an interval of 6 months?" value={item.examinedWithin6Months} onChange={(v) => onChange({ examinedWithin6Months: v })} />
        <YesNoField id={`${p}-within-12`} label="Examined within an interval of 12 months?" value={item.examinedWithin12Months} onChange={(v) => onChange({ examinedWithin12Months: v })} />
      </div>
      <div className="insp-row2">
        <YesNoField id={`${p}-scheme`} label="In accordance with an examination scheme?" value={item.inAccordanceWithScheme} onChange={(v) => onChange({ inAccordanceWithScheme: v })} />
        <YesNoField id={`${p}-exceptional`} label="After the occurrence of exceptional circumstances?" value={item.afterExceptionalCircumstances} onChange={(v) => onChange({ afterExceptionalCircumstances: v })} />
      </div>

      <div className="insp-field">
        <label htmlFor={`${p}-defect`}>Identification of any defect (if none, state NONE)</label>
        <textarea id={`${p}-defect`} rows={2} value={item.defectDescription} onChange={(e) => onChange({ defectDescription: e.target.value })} />
      </div>
      <div className="insp-row2">
        <YesNoField id={`${p}-danger`} label="Existing or imminent danger to persons? (reportable defect)" value={item.existingOrImminentDanger} onChange={(v) => onChange({ existingOrImminentDanger: v })} />
        <div className="insp-field"><label htmlFor={`${p}-danger-by`}>Could become a danger by (date)</label><input id={`${p}-danger-by`} type="date" value={item.couldBecomeDangerBy} onChange={(e) => onChange({ couldBecomeDangerBy: e.target.value })} /></div>
      </div>
      <div className="insp-field">
        <label htmlFor={`${p}-repair`}>Particulars of any repair/renewal/alteration required</label>
        <textarea id={`${p}-repair`} rows={2} value={item.repairParticulars} onChange={(e) => onChange({ repairParticulars: e.target.value })} />
      </div>
      <div className="insp-field">
        <label htmlFor={`${p}-tests`}>Particulars of any tests carried out (if none, state NONE)</label>
        <textarea id={`${p}-tests`} rows={2} value={item.testsCarriedOut} onChange={(e) => onChange({ testsCarriedOut: e.target.value })} />
      </div>
      <div className="insp-field">
        <label htmlFor={`${p}-observations`}>Observations / additional comments</label>
        <textarea id={`${p}-observations`} rows={2} value={item.observations} onChange={(e) => onChange({ observations: e.target.value })} />
      </div>

      <div className="insp-row2">
        <YesNoField id={`${p}-safe`} label="Is this equipment safe to operate?" value={item.safeToOperate} onChange={(v) => onChange({ safeToOperate: v })} />
        <div className="insp-field"><label htmlFor={`${p}-next-exam`}>Next thorough examination due</label><input id={`${p}-next-exam`} type="date" value={item.nextExaminationDue} onChange={(e) => onChange({ nextExaminationDue: e.target.value })} /></div>
      </div>
      <div className="insp-row2">
        <div className="insp-field"><label htmlFor={`${p}-reported-by`}>Name &amp; Qualifications of person making report</label><input id={`${p}-reported-by`} value={item.reportedByName} onChange={(e) => onChange({ reportedByName: e.target.value })} /></div>
        <div className="insp-field"><label htmlFor={`${p}-reported-qual`}>Qualifications</label><input id={`${p}-reported-qual`} value={item.reportedByQualifications} onChange={(e) => onChange({ reportedByQualifications: e.target.value })} /></div>
      </div>
      <div className="insp-row2">
        <div className="insp-field"><label htmlFor={`${p}-authenticated`}>Name of person signing/authenticating this report</label><input id={`${p}-authenticated`} value={item.authenticatedByName} onChange={(e) => onChange({ authenticatedByName: e.target.value })} /></div>
        <div className="insp-field"><label htmlFor={`${p}-employer`}>Employer name &amp; address</label><input id={`${p}-employer`} value={item.employerNameAddress} onChange={(e) => onChange({ employerNameAddress: e.target.value })} /></div>
      </div>
    </fieldset>
  );
}
