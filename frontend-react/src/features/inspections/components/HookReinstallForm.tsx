import { Fragment } from "react";
import { HookCheckAnswer, HookComponentRow, HookCraftType, HookLoadTestData, HookOutcome, HookReinstallData, InspectionCertificate } from "../types/inspection.types";
import {
  HOOK_CHECK_GROUPS,
  HOOK_COMPONENT_ROWS,
  HOOK_CRAFT_TYPES,
  HOOK_LOAD_CHECKS,
  HOOK_LOAD_METHODS,
  HOOK_LOAD_TEST_NOTE,
  HOOK_OUTCOME_LABELS,
  HOOK_REMOVAL_REASONS,
  HOOK_SCOPE_OF_WORK,
  HOOK_TESTER_KEY,
  HOOK_TYPES,
  HookCheckDef,
  computeHookLoad,
} from "../data/hookReinstall";
import HookTesterForm from "./HookTesterForm";
import { freshHookTesterReport } from "../data/hookTester";
import SignatureCanvas from "./SignatureCanvas";
import VesselLookupPanel from "./VesselLookupPanel";

interface Props {
  current: InspectionCertificate;
  updateField: <K extends keyof InspectionCertificate>(key: K, value: InspectionCertificate[K]) => void;
  openCertificate: (certNo: string) => void;
}

function toggleIn(list: string[], key: string): string[] {
  return list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
}

/**
 * Requested directly: incorporate HMZC's own Release Hook
 * Re-installation Certificate (HMZC_Hook_Reinstallation_Certificate.docx)
 * — its own listed subsection under Lifesaving Appliances
 * (type === "hook_reinstall", kind: "hookreinstall"), built the same way
 * as FRCServiceReportForm. See data/hookReinstall.ts for the fixed
 * lists and the finalize rules (getHookBlockers).
 */
export default function HookReinstallForm({ current, updateField, openCertificate }: Props) {
  const data = current.hookReinstall;
  if (!data) return null;

  function patch(p: Partial<HookReinstallData>) {
    updateField("hookReinstall", { ...data!, ...p });
  }
  function patchComponent(key: string, field: keyof Omit<HookComponentRow, "key">, value: string) {
    patch({ components: data!.components.map((c) => (c.key === key ? { ...c, [field]: value } : c)) });
  }
  function patchCheck(key: string, value: HookCheckAnswer) {
    patch({ checks: { ...data!.checks, [key]: value } });
  }
  function patchRemark(key: string, value: string) {
    patch({ checkRemarks: { ...data!.checkRemarks, [key]: value } });
  }
  function patchLoad(p: Partial<HookLoadTestData>) {
    patch({ loadTest: { ...data!.loadTest, ...p } });
  }

  const load = computeHookLoad(data.loadTest);
  // Older certificates (saved before the hook-tester report existed) have no
  // hookTester object: fall back to the report's defaults.
  const testerSelected = data.loadTest.loadMethods.includes(HOOK_TESTER_KEY);
  const tester = data.hookTester ?? freshHookTesterReport();
  const anyNo = Object.values(data.checks).includes("no");

  function checkRow(c: HookCheckDef, numLabel: string) {
    const answer = data!.checks[c.key] || "";
    const needsRemark = answer === "no" && !(data!.checkRemarks[c.key] || "").trim();
    return (
      <tr key={c.key} style={{ borderTop: "1px solid #EEF1F3" }}>
        <td style={{ padding: "4px 6px", color: "var(--insp-muted)", width: 28 }}>{numLabel}</td>
        <td style={{ padding: "4px 6px" }}>{c.label}</td>
        <td style={{ padding: "4px 6px", color: "var(--insp-muted)", whiteSpace: "nowrap" }}>{c.ref}</td>
        <td style={{ padding: "4px 6px", width: 90 }}>
          <select aria-label={`Result: ${c.label}`} value={answer} onChange={(e) => patchCheck(c.key, e.target.value as HookCheckAnswer)}>
            <option value="">—</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="na">N/A</option>
          </select>
        </td>
        <td style={{ padding: "4px 6px" }}>
          <input
            aria-label={`Remarks: ${c.label}`}
            value={data!.checkRemarks[c.key] || ""}
            onChange={(e) => patchRemark(c.key, e.target.value)}
            placeholder={answer === "no" ? "Required for NO" : ""}
            style={needsRemark ? { borderColor: "var(--insp-red)" } : undefined}
          />
        </td>
      </tr>
    );
  }

  let checkNo = 0;

  return (
    <>
      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Certificate Info</legend>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="hook-cert-no">Certificate No.</label><input id="hook-cert-no" value={current.certNo} readOnly /></div>
          <div className="insp-field"><label htmlFor="hook-date">Date of Service</label><input id="hook-date" type="date" value={current.dateOfServicing} onChange={(e) => updateField("dateOfServicing", e.target.value)} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="hook-job-ref">Job Ref.</label><input id="hook-job-ref" value={current.jobRef} readOnly /></div>
          <div className="insp-field"><label htmlFor="hook-next-due">Next Service Due</label><input id="hook-next-due" type="date" value={data.nextServiceDue} onChange={(e) => patch({ nextServiceDue: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="hook-engineer">Attending Engineer</label><input id="hook-engineer" value={data.attendingEngineer} onChange={(e) => patch({ attendingEngineer: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="hook-provider-ref">Service Provider Approval / Manufacturer Authorisation Ref.</label><input id="hook-provider-ref" value={data.serviceProviderApprovalRef} onChange={(e) => patch({ serviceProviderApprovalRef: e.target.value })} /></div>
        </div>
      </fieldset>

      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Client &amp; Vessel Details</legend>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="hook-client">Client / Owner</label><input id="hook-client" value={data.clientOwner} onChange={(e) => patch({ clientOwner: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="hook-vessel">Vessel / Installation Name</label><input id="hook-vessel" value={current.vesselName} onChange={(e) => updateField("vesselName", e.target.value)} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="hook-imo">IMO No. / Reg. No.</label><input id="hook-imo" value={current.imoNo} onChange={(e) => updateField("imoNo", e.target.value)} /></div>
          <div className="insp-field"><label htmlFor="hook-location">Location / Port</label><input id="hook-location" value={current.location} onChange={(e) => updateField("location", e.target.value)} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="hook-vessel-type">Vessel Type</label><input id="hook-vessel-type" value={data.vesselType} onChange={(e) => patch({ vesselType: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="hook-contact">Contact Person</label><input id="hook-contact" value={data.contactPerson} onChange={(e) => patch({ contactPerson: e.target.value })} /></div>
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
        <legend className="insp-legend">Survival Craft &amp; Release Hook Details</legend>
        <div className="insp-field">
          <label htmlFor="hook-craft-type">Craft Type</label>
          <select id="hook-craft-type" value={data.craftType} onChange={(e) => patch({ craftType: e.target.value as HookCraftType })}>
            <option value="">—</option>
            {HOOK_CRAFT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="hook-craft-make">Craft Make &amp; Model</label><input id="hook-craft-make" value={data.craftMakeModel} onChange={(e) => patch({ craftMakeModel: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="hook-hull">Hull / Serial No.</label><input id="hook-hull" value={data.hullSerialNo} onChange={(e) => patch({ hullSerialNo: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="hook-manufacturer">Manufacturer</label><input id="hook-manufacturer" value={data.manufacturer} onChange={(e) => patch({ manufacturer: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="hook-year">Year of Manufacture</label><input id="hook-year" value={data.yearOfManufacture} onChange={(e) => patch({ yearOfManufacture: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="hook-seating">Seating Capacity</label><input id="hook-seating" value={data.seatingCapacity} onChange={(e) => patch({ seatingCapacity: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="hook-davit">Davit / Launching Appliance</label><input id="hook-davit" value={data.davitLaunchingAppliance} onChange={(e) => patch({ davitLaunchingAppliance: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="hook-make">Hook Make &amp; Model</label><input id="hook-make" value={data.hookMakeModel} onChange={(e) => patch({ hookMakeModel: e.target.value })} /></div>
          <div className="insp-field">
            <label htmlFor="hook-type">Hook Type</label>
            <select id="hook-type" value={data.hookType} onChange={(e) => patch({ hookType: e.target.value })}>
              <option value="">—</option>
              {HOOK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="insp-field"><label htmlFor="hook-approval">Hook Type-Approval Certificate No.</label><input id="hook-approval" value={data.hookApprovalCertNo} onChange={(e) => patch({ hookApprovalCertNo: e.target.value })} /></div>
      </fieldset>

      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Scope of Work</legend>
        <p style={{ fontSize: 12, color: "var(--insp-muted)", lineHeight: 1.5 }}>{HOOK_SCOPE_OF_WORK}</p>
        <div className="insp-field">
          <label>Hooks removed for</label>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {HOOK_REMOVAL_REASONS.map((r) => (
              <label key={r.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <input type="checkbox" checked={data.removedFor.includes(r.key)} onChange={() => patch({ removedFor: toggleIn(data.removedFor, r.key) })} />
                {r.label}
              </label>
            ))}
          </div>
          {data.removedFor.includes("other") && (
            <input aria-label="Other reason" placeholder="Specify other reason" value={data.removedForOther} onChange={(e) => patch({ removedForOther: e.target.value })} style={{ marginTop: 6 }} />
          )}
        </div>
      </fieldset>

      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Components Removed / Installed</legend>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", minWidth: 640 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #DCE1E5" }}>
                <th style={{ padding: "4px 6px", width: 30 }}>#</th>
                <th style={{ padding: "4px 6px" }}>Description</th>
                <th style={{ padding: "4px 6px" }}>Old S/N (Removed)</th>
                <th style={{ padding: "4px 6px" }}>New S/N (Installed)</th>
              </tr>
            </thead>
            <tbody>
              {data.components.map((row, i) => (
                <tr key={row.key} style={{ borderTop: "1px solid #EEF1F3" }}>
                  <td style={{ padding: "4px 6px", color: "var(--insp-muted)" }}>{i + 1}</td>
                  <td style={{ padding: "4px 6px" }}>{HOOK_COMPONENT_ROWS.find((c) => c.key === row.key)?.description}</td>
                  <td style={{ padding: "4px 6px" }}><input aria-label="Old serial" value={row.oldSerial} onChange={(e) => patchComponent(row.key, "oldSerial", e.target.value)} /></td>
                  <td style={{ padding: "4px 6px" }}><input aria-label="New serial" value={row.newSerial} onChange={(e) => patchComponent(row.key, "newSerial", e.target.value)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </fieldset>

      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Inspection &amp; Test Check Sheet</legend>
        <p style={{ fontSize: 11.5, color: "var(--insp-muted)", margin: "0 0 8px" }}>
          Answer every check (use N/A where it doesn't apply). A remark is required for any NO.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #DCE1E5" }}>
                <th style={{ padding: "4px 6px" }}>#</th>
                <th style={{ padding: "4px 6px" }}>Check Performed</th>
                <th style={{ padding: "4px 6px" }}>Ref.</th>
                <th style={{ padding: "4px 6px" }}>Result</th>
                <th style={{ padding: "4px 6px" }}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {HOOK_CHECK_GROUPS.map((g) => (
                <Fragment key={g.title}>
                  <tr><td colSpan={5} style={{ padding: "6px", background: "#EEF1F3", fontWeight: 700, color: "var(--insp-navy)", fontSize: 11.5 }}>{g.title}</td></tr>
                  {g.checks.map((c) => checkRow(c, String(++checkNo)))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </fieldset>

      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Load Test (Proof Load / Jib Test)</legend>
        <p style={{ fontSize: 11.5, color: "var(--insp-muted)", margin: "0 0 8px" }}>{HOOK_LOAD_TEST_NOTE}</p>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="hook-craft-mass">Craft mass + equipment (kg)</label><input id="hook-craft-mass" inputMode="decimal" value={data.loadTest.craftMass} onChange={(e) => patchLoad({ craftMass: e.target.value })} /></div>
          <div className="insp-field" />
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="hook-persons">Persons (number)</label><input id="hook-persons" inputMode="numeric" value={data.loadTest.personsCount} onChange={(e) => patchLoad({ personsCount: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="hook-person-mass">Mass per person (kg)</label><input id="hook-person-mass" inputMode="decimal" value={data.loadTest.personMass} onChange={(e) => patchLoad({ personMass: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label>Total mass (kg) — calculated</label><input value={load?.totalMass ?? ""} readOnly placeholder="Enter craft mass, persons and mass per person" /></div>
          <div className="insp-field"><label>Test load = 1.1 × total mass (kg) — calculated</label><input value={load?.testLoad ?? ""} readOnly /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="hook-jib-swl">Jib / crane SWL</label><input id="hook-jib-swl" value={data.loadTest.jibSwl} onChange={(e) => patchLoad({ jibSwl: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="hook-loadcell-id">Load cell / scale ID</label><input id="hook-loadcell-id" value={data.loadTest.loadCellId} onChange={(e) => patchLoad({ loadCellId: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="hook-loadcell-cert">Calibration cert. no.</label><input id="hook-loadcell-cert" value={data.loadTest.loadCellCertNo} onChange={(e) => patchLoad({ loadCellCertNo: e.target.value })} /></div>
          <div className="insp-field"><label htmlFor="hook-loadcell-expiry">Calibration expiry</label><input id="hook-loadcell-expiry" type="date" value={data.loadTest.loadCellCertExpiry} onChange={(e) => patchLoad({ loadCellCertExpiry: e.target.value })} /></div>
        </div>
        <div className="insp-field">
          <label>Load applied by</label>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {HOOK_LOAD_METHODS.map((m) => (
              <label key={m.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <input type="checkbox" checked={data.loadTest.loadMethods.includes(m.key)} onChange={() => patchLoad({ loadMethods: toggleIn(data.loadTest.loadMethods, m.key) })} />
                {m.label}
              </label>
            ))}
          </div>
          {testerSelected && (
            <p style={{ fontSize: 11.5, color: "var(--insp-accent)", margin: "6px 0 0" }}>
              Hook tester selected — the Hook Load Test Report form is below.
            </p>
          )}
        </div>
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #DCE1E5" }}>
                <th style={{ padding: "4px 6px" }}>#</th>
                <th style={{ padding: "4px 6px" }}>Result at Test Load</th>
                <th style={{ padding: "4px 6px" }}>Ref.</th>
                <th style={{ padding: "4px 6px" }}>Result</th>
                <th style={{ padding: "4px 6px" }}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {HOOK_LOAD_CHECKS.map((c, i) => checkRow(c, `L${i + 1}`))}
            </tbody>
          </table>
        </div>
      </fieldset>

      {/* The load test was done with the hydraulic hook tester: bring up its
          own report (HMZC's Hook Load Test Report) right under the Load Test. */}
      {testerSelected && (
        <HookTesterForm
          report={tester}
          onChange={(p) => patch({ hookTester: { ...tester, ...p } })}
          engineerName={current.engineerName}
        />
      )}

      <fieldset className="insp-fieldset">
        <legend className="insp-legend">Overall Result</legend>
        <div className="insp-field">
          <label htmlFor="hook-outcome">Outcome</label>
          <select id="hook-outcome" value={data.outcome} onChange={(e) => patch({ outcome: e.target.value as HookOutcome })}>
            <option value="">—</option>
            <option value="satisfactory">{HOOK_OUTCOME_LABELS.satisfactory}</option>
            <option value="not_satisfactory">{HOOK_OUTCOME_LABELS.not_satisfactory}</option>
          </select>
          {anyNo && data.outcome === "satisfactory" && (
            <div style={{ color: "var(--insp-red)", fontSize: 11.5, marginTop: 4 }}>A check is answered NO — the result can't be Satisfactory.</div>
          )}
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
        <legend className="insp-legend">Sign-Off</legend>
        <div className="insp-row2">
          <div className="insp-field"><label htmlFor="hook-eng-name">Attending Engineer Name</label><input id="hook-eng-name" value={current.engineerName} onChange={(e) => updateField("engineerName", e.target.value)} /></div>
          <div className="insp-field"><label htmlFor="hook-client-rep-name">Client Representative Name</label><input id="hook-client-rep-name" value={data.clientRepName} onChange={(e) => patch({ clientRepName: e.target.value })} /></div>
        </div>
        <div className="insp-row2">
          <SignatureCanvas label="Engineer Signature" value={current.engineerSig} onChange={(v) => updateField("engineerSig", v)} allowSavedDefault />
          <SignatureCanvas label="Client Representative Signature" value={data.clientRepSig} onChange={(v) => patch({ clientRepSig: v })} />
        </div>
      </fieldset>
    </>
  );
}
