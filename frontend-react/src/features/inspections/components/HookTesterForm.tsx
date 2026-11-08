import { HookTesterReport, HookTesterResult } from "../types/inspection.types";
import {
  HOOK_TESTER_ACCEPTANCE,
  HOOK_TESTER_CONDITIONS_NOTE,
  HOOK_TESTER_FACTORS,
  HOOK_TESTER_FACTOR_NOTE,
  HOOK_TESTER_GAUGE_NOTE,
  HOOK_TESTER_PROCEDURE,
  computeHookTesterPlan,
  fmtBar,
  fmtTonnes,
  hookTesterDrop,
} from "../data/hookTester";

interface Props {
  report: HookTesterReport;
  onChange: (patch: Partial<HookTesterReport>) => void;
  engineerName: string;
}

const cell = { padding: "4px 6px" } as const;

/**
 * The Hook Load Test Report (HMZC's Hook_Test_Report_3.5t.docx), shown inside
 * the Hook Re-installation certificate when the load test was done with the
 * hook tester ("Hook tester" ticked under Load applied by). Everything that is
 * arithmetic — the test load, the test pressure, each stage's pressure, the
 * pressure drop — is computed from the inputs (data/hookTester.ts), so the
 * technician only enters what was measured.
 */
export default function HookTesterForm({ report, onChange, engineerName }: Props) {
  const plan = computeHookTesterPlan(report);
  const drop = hookTesterDrop(report);

  function setReading(pct: number, value: string) {
    onChange({ gaugeReadings: { ...report.gaugeReadings, [String(pct)]: value } });
  }
  const field = (id: string, label: string, key: keyof HookTesterReport, opts: { type?: string; placeholder?: string } = {}) => (
    <div className="insp-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type={opts.type || "text"} placeholder={opts.placeholder} value={String(report[key] ?? "")} onChange={(e) => onChange({ [key]: e.target.value } as Partial<HookTesterReport>)} />
    </div>
  );

  return (
    <fieldset className="insp-fieldset" aria-label="Hook Load Test Report" style={{ borderColor: "var(--insp-accent)" }}>
      <legend className="insp-legend">Hook Load Test Report — hydraulic hook tester</legend>
      <p style={{ fontSize: 11.5, color: "var(--insp-muted)", margin: "0 0 10px" }}>
        Shown because the load test is done with the hook tester. It prints as its own section of this certificate. Pressures are calculated from the cylinder's rating plate.
      </p>

      <div style={{ fontWeight: 700, fontSize: 12, margin: "8px 0 4px" }}>1. Equipment tested</div>
      <div className="insp-row2">
        {field("ht-client", "Client / vessel", "clientVessel")}
        {field("ht-equipment", "Equipment", "equipment")}
      </div>
      <div className="insp-row2">
        {field("ht-maker", "Hook maker / type", "hookMakerType")}
        {field("ht-hookserial", "Hook serial no. / cert. no.", "hookSerialCertNo")}
      </div>
      <div className="insp-row2">
        {field("ht-swl", "Safe Working Load (SWL), tonnes", "swl", { placeholder: "3.5" })}
        {field("ht-date", "Date of test", "dateOfTest", { type: "date" })}
      </div>
      {field("ht-place", "Place of test", "placeOfTest")}

      <div style={{ fontWeight: 700, fontSize: 12, margin: "12px 0 4px" }}>2. Test equipment</div>
      <div className="insp-row2">
        {field("ht-cyl", "Hydraulic cylinder", "cylinderModel")}
        {field("ht-cylserial", "Cylinder S/N / date", "cylinderSerialDate")}
      </div>
      <div className="insp-row2">
        {field("ht-cap", "Cylinder rated capacity (t)", "cylinderCapacity", { placeholder: "20" })}
        {field("ht-rated", "Rated working pressure (bar)", "ratedPressure", { placeholder: "630" })}
      </div>
      <div className="insp-row2">
        {field("ht-grange", "Pressure gauge range", "gaugeRange")}
        {field("ht-gmake", "Gauge make", "gaugeMake")}
      </div>
      <div className="insp-row2">
        {field("ht-gserial", "Gauge serial no.", "gaugeSerialNo")}
        {field("ht-gcert", "Gauge calibration cert. no.", "gaugeCertNo")}
      </div>
      <div className="insp-row2">
        {field("ht-gexp", "Gauge calibration expiry", "gaugeCertExpiry", { type: "date" })}
        {field("ht-pump", "Pump / reaction frame", "pumpFrame")}
      </div>
      <p style={{ fontSize: 11.5, color: "var(--insp-red)", margin: "4px 0 0" }}>{HOOK_TESTER_GAUGE_NOTE}</p>

      <div style={{ fontWeight: 700, fontSize: 12, margin: "12px 0 4px" }}>3. Test load and pressure calculation</div>
      <div className="insp-row2">
        <div className="insp-field">
          <label htmlFor="ht-factor">Test factor (× SWL)</label>
          <select id="ht-factor" value={report.testFactor} onChange={(e) => onChange({ testFactor: e.target.value })}>
            {HOOK_TESTER_FACTORS.map((f) => (
              <option key={f.factor} value={f.factor.toFixed(1)}>{f.factor.toFixed(1)} × SWL — {f.use}</option>
            ))}
          </select>
        </div>
        <div className="insp-field">
          <label>Test load / test pressure — calculated</label>
          <input readOnly value={plan ? `${fmtTonnes(plan.testLoad)} t  →  ${fmtBar(plan.testPressure)} bar` : "Enter SWL and the cylinder rating"} />
        </div>
      </div>
      {plan && (
        <p style={{ fontSize: 11.5, color: "var(--insp-muted)", margin: "2px 0 6px" }}>
          Pressure (bar) = load (t) × {report.ratedPressure} ÷ {report.cylinderCapacity} = load (t) × {fmtBar(plan.barPerTonne)} bar per tonne.
        </p>
      )}
      {plan && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", minWidth: 420 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #DCE1E5" }}>
                <th style={cell}>Test factor</th><th style={cell}>Test load (t)</th><th style={cell}>Pressure (bar)</th><th style={cell}>Use</th>
              </tr>
            </thead>
            <tbody>
              {plan.reference.map((r) => (
                <tr key={r.factor} style={{ borderTop: "1px solid #EEF1F3", fontWeight: r.selected ? 700 : 400 }}>
                  <td style={cell}>{r.factor.toFixed(1)} × SWL</td>
                  <td style={cell}>{fmtTonnes(r.loadT)}</td>
                  <td style={cell}>{fmtBar(r.pressureBar)}</td>
                  <td style={cell}>{r.use}{r.selected ? " (used in this report)" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ fontSize: 11.5, color: "var(--insp-muted)", margin: "6px 0 0" }}>{HOOK_TESTER_FACTOR_NOTE}</p>

      <div style={{ fontWeight: 700, fontSize: 12, margin: "12px 0 4px" }}>4. Test procedure and record</div>
      <ol style={{ fontSize: 11.5, color: "var(--insp-muted)", margin: "0 0 8px", paddingLeft: 18 }}>
        {HOOK_TESTER_PROCEDURE.map((step) => <li key={step}>{step}</li>)}
      </ol>
      <div className="insp-row2">
        {field("ht-hold", "Hold time used (minutes)", "holdMinutes", { placeholder: "5" })}
        <div className="insp-field" />
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", minWidth: 480 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #DCE1E5" }}>
              <th style={cell}>Stage</th><th style={cell}>% of test load</th><th style={cell}>Load (t)</th><th style={cell}>Calculated pressure (bar)</th><th style={cell}>Gauge reading (bar)</th>
            </tr>
          </thead>
          <tbody>
            {(plan?.stages ?? [25, 50, 75, 100].map((pct) => ({ pct, label: pct === 100 ? "Full test load - hold" : "Increment", loadT: NaN, pressureBar: NaN }))).map((st) => (
              <tr key={st.pct} style={{ borderTop: "1px solid #EEF1F3" }}>
                <td style={cell}>{st.label}</td>
                <td style={cell}>{st.pct}%</td>
                <td style={cell}>{Number.isNaN(st.loadT) ? "—" : fmtTonnes(st.loadT)}</td>
                <td style={cell}>{Number.isNaN(st.pressureBar) ? "—" : fmtBar(st.pressureBar)}</td>
                <td style={cell}>
                  <input aria-label={`Gauge reading at ${st.pct}%`} inputMode="decimal" value={report.gaugeReadings[String(st.pct)] || ""} onChange={(e) => setReading(st.pct, e.target.value)} style={{ width: 90 }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11.5, color: "var(--insp-muted)", margin: "6px 0 0" }}>{HOOK_TESTER_CONDITIONS_NOTE}</p>

      <div style={{ fontWeight: 700, fontSize: 12, margin: "12px 0 4px" }}>5. Results</div>
      <div className="insp-row2">
        {field("ht-pstart", "Gauge reading at start of hold (bar)", "pressureStart")}
        {field("ht-pend", "Gauge reading after the hold (bar)", "pressureEnd")}
      </div>
      <div className="insp-field">
        <label>Pressure drop — calculated</label>
        <input readOnly value={drop === null ? "" : `${Math.round(drop * 10) / 10} bar`} />
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, margin: "4px 0" }}>
        <input type="checkbox" checked={report.visualConfirmed} onChange={(e) => onChange({ visualConfirmed: e.target.checked })} />
        Visual inspection after test: no cracks, distortion or permanent set observed
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, margin: "4px 0 8px" }}>
        <input type="checkbox" checked={report.releaseConfirmed} onChange={(e) => onChange({ releaseConfirmed: e.target.checked })} />
        Release / reset function after test: operates freely and locks correctly
      </label>
      <div className="insp-row2">
        {field("ht-ndt", "NDT after proof load (not carried out / method and result)", "ndt")}
        <div className="insp-field">
          <label htmlFor="ht-result">Overall result</label>
          <select id="ht-result" value={report.result} onChange={(e) => onChange({ result: e.target.value as HookTesterResult })}>
            <option value="">—</option>
            <option value="pass">PASS</option>
            <option value="fail">FAIL</option>
          </select>
        </div>
      </div>

      <div style={{ fontWeight: 700, fontSize: 12, margin: "12px 0 4px" }}>6. Acceptance criteria</div>
      <ul style={{ fontSize: 11.5, color: "var(--insp-muted)", margin: "0 0 8px", paddingLeft: 18 }}>
        {HOOK_TESTER_ACCEPTANCE.map((a) => <li key={a}>{a}</li>)}
      </ul>

      <div style={{ fontWeight: 700, fontSize: 12, margin: "12px 0 4px" }}>7. Sign-off</div>
      <p style={{ fontSize: 11.5, color: "var(--insp-muted)", margin: "0 0 6px" }}>
        Tested by: {engineerName || "the attending engineer (name and signature under this certificate's Sign-Off)"}.
      </p>
      <div className="insp-row2">
        {field("ht-company", "Company", "company")}
        {field("ht-testdate", "Date", "testDate", { type: "date" })}
      </div>
      <div className="insp-row2">
        {field("ht-witness", "Witnessed by", "witnessedBy")}
        {field("ht-witnessdate", "Witness date", "witnessDate", { type: "date" })}
      </div>
    </fieldset>
  );
}
