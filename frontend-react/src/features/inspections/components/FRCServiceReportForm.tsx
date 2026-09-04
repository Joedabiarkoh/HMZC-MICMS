import {
  FRCComponentRow,
  FRCCheckAnswer,
  FRCServiceReportData,
  FRCSparePartRow,
  InspectionCertificate,
} from "../types/inspection.types";
import { FRC_COMPONENT_ROWS, FRC_FUNCTION_CHECKS, FRC_SCOPE_OF_WORK, FRC_SERVICE_TYPE_LABELS } from "../data/frcServiceReport";
import { FRC_SPARE_PARTS_COLUMNS, freshFRCSparePartRow } from "../data/inspectionHelpers";
import { RegisterEditTable } from "./RegisterTable";
import SignatureCanvas from "./SignatureCanvas";
import VesselLookupPanel from "./VesselLookupPanel";

interface Props {
  current: InspectionCertificate;
  updateField: <K extends keyof InspectionCertificate>(key: K, value: InspectionCertificate[K]) => void;
  openCertificate: (certNo: string) => void;
}

/**
 * Requested directly: incorporate HMZC's own FRC Service Report
 * template (Installation/Replacement of the self-righting bag & CO2
 * activation bottle) into the app — its own listed subsection under
 * Lifesaving Appliances (type === "frc_service", kind: "frcservice",
 * see TYPE_GROUPS/INSPECTION_TYPES) rather than nested inside Rescue
 * Boat, since that turned out not to be discoverable enough on its
 * own.
 */
export default function FRCServiceReportForm({ current, updateField, openCertificate }: Props) {
  const data = current.frcServiceReport;
  if (!data) return null;

  function patch(p: Partial<FRCServiceReportData>) {
    updateField("frcServiceReport", { ...data!, ...p });
  }
  function patchComponent(key: string, field: keyof Omit<FRCComponentRow, "key">, value: string) {
    patch({ components: data!.components.map((c) => (c.key === key ? { ...c, [field]: value } : c)) });
  }
  function patchCheck(key: string, value: FRCCheckAnswer) {
    patch({ checks: { ...data!.checks, [key]: value } });
  }
  function addSparePart() {
    patch({ spareParts: [...data!.spareParts, freshFRCSparePartRow()] });
  }
  function removeSparePart(i: number) {
    const rows = [...data!.spareParts];
    rows.splice(i, 1);
    patch({ spareParts: rows });
  }
  function changeSparePart(i: number, key: string, value: string) {
    const rows = [...data!.spareParts];
    rows[i] = { ...rows[i], [key]: value } as FRCSparePartRow;
    patch({ spareParts: rows });
  }

  return (
    <>
      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Report Info</legend>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="frc-report-no">Report No.</label><input id="frc-report-no" value={current.certNo} readOnly /></div>
          <div className="insp-field"><label htmlFor="frc-date">Date of Service</label><input id="frc-date" type="date" value={current.dateOfServicing} onChange={(e) => updateField("dateOfServicing", e.target.value)} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field">
            <label htmlFor="frc-service-type">Service Type</label>
            <select id="frc-service-type" value={data.serviceType} onChange={(e) => patch({ serviceType: e.target.value as FRCServiceReportData["serviceType"] })}>
              <option value="">—</option>
              <option value="installation">{FRC_SERVICE_TYPE_LABELS.installation}</option>
              <option value="replacement">{FRC_SERVICE_TYPE_LABELS.replacement}</option>
            </select>
          </div>
          <div className="insp-field"><label htmlFor="frc-next-due">Next Service Due</label><input id="frc-next-due" type="date" value={data.nextServiceDue} onChange={(e) => patch({ nextServiceDue: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="frc-engineer">Attending Engineer</label><input id="frc-engineer" value={data.attendingEngineer} onChange={(e) => patch({ attendingEngineer: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="frc-job-ref">Job Ref.</label><input id="frc-job-ref" value={current.jobRef} readOnly /></div>
        </div>
      </fieldset>

      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Client &amp; Vessel Details</legend>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="frc-client">Client / Owner</label><input id="frc-client" value={data.clientOwner} onChange={(e) => patch({ clientOwner: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="frc-vessel">Vessel / Installation Name</label><input id="frc-vessel" value={current.vesselName} onChange={(e) => updateField("vesselName", e.target.value)} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="frc-imo">IMO No. / Reg. No.</label><input id="frc-imo" value={current.imoNo} onChange={(e) => updateField("imoNo", e.target.value)} /></div>
          <div className="insp-field"><label htmlFor="frc-location">Location / Port</label><input id="frc-location" value={current.location} onChange={(e) => updateField("location", e.target.value)} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="frc-vessel-type">Vessel Type</label><input id="frc-vessel-type" value={data.vesselType} onChange={(e) => patch({ vesselType: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="frc-contact">Contact Person</label><input id="frc-contact" value={data.contactPerson} onChange={(e) => patch({ contactPerson: e.target.value })} /></div>
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
        <legend className="insp-legend">FRC / Equipment Details</legend>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="frc-make">FRC Make &amp; Model</label><input id="frc-make" value={data.frcMakeModel} onChange={(e) => patch({ frcMakeModel: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="frc-hull">Hull / Serial No.</label><input id="frc-hull" value={data.hullSerialNo} onChange={(e) => patch({ hullSerialNo: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="frc-manufacturer">Manufacturer</label><input id="frc-manufacturer" value={data.manufacturer} onChange={(e) => patch({ manufacturer: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="frc-year">Year of Manufacture</label><input id="frc-year" value={data.yearOfManufacture} onChange={(e) => patch({ yearOfManufacture: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="frc-seating">Seating Capacity</label><input id="frc-seating" value={data.seatingCapacity} onChange={(e) => patch({ seatingCapacity: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="frc-davit">Davit / Launching Appliance</label><input id="frc-davit" value={data.davitLaunchingAppliance} onChange={(e) => patch({ davitLaunchingAppliance: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="frc-last-service">Date of Last Service</label><input id="frc-last-service" type="date" value={data.dateOfLastService} onChange={(e) => patch({ dateOfLastService: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="frc-class-flag">Class / Flag</label><input id="frc-class-flag" value={data.classFlag} onChange={(e) => patch({ classFlag: e.target.value })} /></div>
        </div>
      </fieldset>

      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Scope of Work</legend>
        <p style={{ fontSize: 12, color: "var(--insp-muted)", lineHeight: 1.5 }}>{FRC_SCOPE_OF_WORK}</p>
      </fieldset>

      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Components Removed / Installed</legend>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", minWidth: 640 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #DCE1E5" }}>
                <th style={{ padding: "4px 6px", width: 30 }}>#</th>
                <th style={{ padding: "4px 6px" }}>Description</th>
                <th style={{ padding: "4px 6px" }}>Old Serial / Part No. (Removed)</th>
                <th style={{ padding: "4px 6px" }}>New Serial / Part No. (Installed)</th>
                <th style={{ padding: "4px 6px" }}>Qty</th>
                <th style={{ padding: "4px 6px" }}>Expiry / Next Due Date</th>
              </tr>
            </thead>
            <tbody>
              {data.components.map((row, i) => (
                <tr key={row.key} style={{ borderTop: "1px solid #EEF1F3" }}>
                  <td style={{ padding: "4px 6px", color: "var(--insp-muted)" }}>{i + 1}</td>
                  <td style={{ padding: "4px 6px" }}>{FRC_COMPONENT_ROWS.find((c) => c.key === row.key)?.description}</td>
                  <td style={{ padding: "4px 6px" }}><input value={row.oldSerial} onChange={(e) => patchComponent(row.key, "oldSerial", e.target.value)} /></td>
                  <td style={{ padding: "4px 6px" }}><input value={row.newSerial} onChange={(e) => patchComponent(row.key, "newSerial", e.target.value)} /></td>
                  <td style={{ padding: "4px 6px" }}><input value={row.qty} onChange={(e) => patchComponent(row.key, "qty", e.target.value)} style={{ width: 50 }} /></td>
                  <td style={{ padding: "4px 6px" }}><input type="date" value={row.expiry} onChange={(e) => patchComponent(row.key, "expiry", e.target.value)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </fieldset>

      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Testing &amp; Function Checks</legend>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", minWidth: 480 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #DCE1E5" }}>
                <th style={{ padding: "4px 6px" }}>Check Performed</th>
                <th style={{ padding: "4px 6px", width: 110 }}>Result</th>
              </tr>
            </thead>
            <tbody>
              {FRC_FUNCTION_CHECKS.map((c) => (
                <tr key={c.key} style={{ borderTop: "1px solid #EEF1F3" }}>
                  <td style={{ padding: "4px 6px" }}>{c.label}</td>
                  <td style={{ padding: "4px 6px" }}>
                    <select value={data.checks[c.key] || ""} onChange={(e) => patchCheck(c.key, e.target.value as FRCCheckAnswer)}>
                      <option value="">—</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                      <option value="na">N/A</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </fieldset>

      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Findings / Remarks</legend>
        <textarea rows={3} value={data.findingsRemarks} onChange={(e) => patch({ findingsRemarks: e.target.value })} />
      </fieldset>

      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Recommendations</legend>
        <textarea rows={3} value={data.recommendations} onChange={(e) => patch({ recommendations: e.target.value })} />
      </fieldset>

      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Spare Parts / Materials Used</legend>
        <RegisterEditTable
          columns={FRC_SPARE_PARTS_COLUMNS}
          rows={data.spareParts as unknown as Record<string, string>[]}
          onAdd={addSparePart}
          onRemove={removeSparePart}
          onChange={changeSparePart}
          addLabel="+ Add Spare Part"
        />
      </fieldset>

      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Sign-Off</legend>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="frc-eng-name">Attending Engineer Name</label><input id="frc-eng-name" value={current.engineerName} onChange={(e) => updateField("engineerName", e.target.value)} /></div>
          <div className="insp-field"><label htmlFor="frc-client-rep-name">Client Representative Name</label><input id="frc-client-rep-name" value={data.clientRepName} onChange={(e) => patch({ clientRepName: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <SignatureCanvas label="Engineer Signature" value={current.engineerSig} onChange={(v) => updateField("engineerSig", v)} allowSavedDefault />
          <SignatureCanvas label="Client Representative Signature" value={data.clientRepSig} onChange={(v) => patch({ clientRepSig: v })} />
        </div>
      </fieldset>
    </>
  );
}
