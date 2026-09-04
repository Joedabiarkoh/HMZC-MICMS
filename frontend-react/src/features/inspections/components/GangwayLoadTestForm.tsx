import { GangwayLoadTestData, GangwayResult, InspectionCertificate } from "../types/inspection.types";
import { GANGWAY_INSPECTION_STATEMENT, GANGWAY_RESULT_LABELS } from "../data/gangwayLoadTest";
import VesselLookupPanel from "./VesselLookupPanel";
import SignatureCanvas from "./SignatureCanvas";

interface Props {
  current: InspectionCertificate;
  updateField: <K extends keyof InspectionCertificate>(key: K, value: InspectionCertificate[K]) => void;
  openCertificate: (certNo: string) => void;
}

/**
 * Requested directly, given the exact section layout (Gangway Details
 * / Test Details / Inspection Result) — its own listed subsection
 * under Lifting Appliances (type === "gangway_load_test", kind:
 * "gangwayloadtest", see TYPE_GROUPS/INSPECTION_TYPES), alongside
 * crane/loosegear.
 */
export default function GangwayLoadTestForm({ current, updateField, openCertificate }: Props) {
  const data = current.gangwayLoadTest;
  if (!data) return null;

  function patch(p: Partial<GangwayLoadTestData>) {
    updateField("gangwayLoadTest", { ...data!, ...p });
  }

  return (
    <>
      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Certificate</legend>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="glt-cert-no">Certificate No</label><input id="glt-cert-no" value={current.certNo} readOnly /></div>
          <div className="insp-field"><label htmlFor="glt-date">Date of Servicing</label><input id="glt-date" type="date" value={current.dateOfServicing} onChange={(e) => updateField("dateOfServicing", e.target.value)} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="glt-vessel">Vessel</label><input id="glt-vessel" value={current.vesselName} onChange={(e) => updateField("vesselName", e.target.value)} /></div>
          <div className="insp-field"><label htmlFor="glt-imo">IMO No.</label><input id="glt-imo" value={current.imoNo} onChange={(e) => updateField("imoNo", e.target.value)} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="glt-location">Location</label><input id="glt-location" value={current.location} onChange={(e) => updateField("location", e.target.value)} /></div>
        </div>
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

      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Gangway Details</legend>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="glt-manufacturer">Manufacturer</label><input id="glt-manufacturer" value={data.manufacturer} onChange={(e) => patch({ manufacturer: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="glt-type-model">Type / Model</label><input id="glt-type-model" value={data.typeModel} onChange={(e) => patch({ typeModel: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="glt-serial">Serial Number</label><input id="glt-serial" value={data.serialNumber} onChange={(e) => patch({ serialNumber: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="glt-length">Gangway Length</label><input id="glt-length" value={data.gangwayLength} onChange={(e) => patch({ gangwayLength: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="glt-width">Gangway Width</label><input id="glt-width" value={data.gangwayWidth} onChange={(e) => patch({ gangwayWidth: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="glt-swl">SWL</label><input id="glt-swl" value={data.swl} onChange={(e) => patch({ swl: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="glt-test-load">Test Load</label><input id="glt-test-load" value={data.testLoad} onChange={(e) => patch({ testLoad: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="glt-test-angle">Test Angle / Position</label><input id="glt-test-angle" value={data.testAngle} onChange={(e) => patch({ testAngle: e.target.value })} /></div>
        </div>
      </fieldset>

      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Test Details</legend>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="glt-method">Load Test Method</label><input id="glt-method" value={data.loadTestMethod} onChange={(e) => patch({ loadTestMethod: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="glt-load-applied">Test Load Applied</label><input id="glt-load-applied" value={data.testLoadApplied} onChange={(e) => patch({ testLoadApplied: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="glt-duration">Test Duration</label><input id="glt-duration" value={data.testDuration} onChange={(e) => patch({ testDuration: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="glt-equipment">Test Equipment / Load Cell No.</label><input id="glt-equipment" value={data.testEquipment} onChange={(e) => patch({ testEquipment: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="glt-cal-cert">Calibration Certificate No.</label><input id="glt-cal-cert" value={data.calibrationCertNo} onChange={(e) => patch({ calibrationCertNo: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="glt-cal-due">Calibration Due Date</label><input id="glt-cal-due" type="date" value={data.calibrationDueDate} onChange={(e) => patch({ calibrationDueDate: e.target.value })} /></div>
        </div>
      </fieldset>

      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Inspection Result</legend>
        <p style={{ fontSize: 12, color: "var(--insp-muted)", lineHeight: 1.5 }}>{GANGWAY_INSPECTION_STATEMENT}</p>
        <div className="insp-row2">
          <div className="insp-field">
            <label htmlFor="glt-result">Result</label>
            <select id="glt-result" value={data.result} onChange={(e) => patch({ result: e.target.value as GangwayResult })}>
              <option value="">—</option>
              <option value="satisfactory">{GANGWAY_RESULT_LABELS.satisfactory}</option>
              <option value="not_satisfactory">{GANGWAY_RESULT_LABELS.not_satisfactory}</option>
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Remarks</legend>
        <textarea rows={3} value={current.remarks} onChange={(e) => updateField("remarks", e.target.value)} />
      </fieldset>

      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Signatures</legend>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="glt-captain-name">Captain Name</label><input id="glt-captain-name" value={current.captainName} onChange={(e) => updateField("captainName", e.target.value)} /></div>
          <div className="insp-field"><label htmlFor="glt-engineer-name">Service Engineer Name</label><input id="glt-engineer-name" value={current.engineerName} onChange={(e) => updateField("engineerName", e.target.value)} /></div>
        </div>
        <div className="insp-row2">
          <SignatureCanvas label="Captain Signature" value={current.captainSig} onChange={(v) => updateField("captainSig", v)} />
          <SignatureCanvas label="Service Engineer Signature" value={current.engineerSig} onChange={(v) => updateField("engineerSig", v)} allowSavedDefault />
        </div>
      </fieldset>
    </>
  );
}
