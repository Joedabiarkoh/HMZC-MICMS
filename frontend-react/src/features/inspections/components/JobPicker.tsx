import { useState } from "react";
import { createJob, Job, listJobs } from "../services/jobs.api";

interface Props {
  vesselName: string;
  imoNo: string;
  onVesselChange: (v: string) => void;
  onImoChange: (v: string) => void;
  onJobSelected: (job: Job) => void;
}

// Requested directly: "before you create a certificate job number
// must be created for you and all the certificate that will be
// created within that job number will be grouped under that job
// number" then, generalizing from Loose Gear only: "the job creation
// number should be for all the certificate, so that all certificate
// issued will stay under that job number and easy to track, as the
// same vessel can be visited on different occassion for different
// POs." Shown by InspectionWorkspace.tsx for ANY equipment type, in
// place of that type's normal form, for a brand-new certificate not
// yet tied to a Job — a technician must pick an existing open Job for
// this vessel, or start a new one (with a PO or an explicit "PO not
// available yet" + customer name — see po_pending), before the
// certificate itself gets created.
export default function JobPicker({ vesselName, imoNo, onVesselChange, onImoChange, onJobSelected }: Props) {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyJobNo, setBusyJobNo] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [poPending, setPoPending] = useState(false);
  const [customerName, setCustomerName] = useState("");

  async function findJobs() {
    if (!vesselName.trim()) {
      setError("Enter a vessel name first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const openJobs = await listJobs(vesselName.trim(), "open");
      setJobs(openJobs);
    } catch {
      setError("Couldn't look up jobs for this vessel — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function useJob(job: Job) {
    onVesselChange(job.vessel_name);
    onImoChange(job.imo_no || "");
    onJobSelected(job);
  }

  async function startNewJob() {
    if (!vesselName.trim()) {
      setError("Enter a vessel name first.");
      return;
    }
    if (!poNumber.trim() && !poPending) {
      setError("Enter a PO number, or check \"PO not available yet.\"");
      return;
    }
    if (poPending && !customerName.trim()) {
      setError("Enter the customer name — required when the PO isn't available yet.");
      return;
    }
    setBusyJobNo("__new__");
    setError("");
    try {
      const job = await createJob({ vesselName: vesselName.trim(), imoNo: imoNo.trim(), poNumber: poNumber.trim(), poPending, customerName: customerName.trim() });
      onImoChange(job.imo_no || "");
      onJobSelected(job);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Couldn't start a new job — check your connection and try again.");
    } finally {
      setBusyJobNo("");
    }
  }

  return (
    <fieldset className="insp-fieldset">
      <legend className="insp-legend">Job</legend>
      <p className="insp-help-note">
        Every certificate issued for this vessel visit is grouped under one Job — pick an existing open job below, or start a new one.
      </p>
      <div className="insp-row2">
        <div className="insp-field">
          <label htmlFor="jp-vessel">Vessel</label>
          <input id="jp-vessel" value={vesselName} onChange={(e) => { onVesselChange(e.target.value); setJobs(null); }} />
        </div>
        <div className="insp-field">
          <label htmlFor="jp-imo">IMO No. (optional)</label>
          <input id="jp-imo" value={imoNo} onChange={(e) => onImoChange(e.target.value)} />
        </div>
      </div>
      <button type="button" className="insp-btn insp-btn-outline" onClick={findJobs} disabled={loading}>
        {loading ? "Looking..." : "Find Open Jobs for This Vessel"}
      </button>

      {error && <p style={{ color: "var(--insp-red)", fontSize: 11.5, marginTop: 8 }}>{error}</p>}

      {jobs !== null && (
        <div style={{ marginTop: 10 }}>
          {jobs.length === 0 ? (
            <p className="insp-help-note">No open jobs for this vessel yet.</p>
          ) : (
            jobs.map((job) => (
              <div key={job.job_no} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid #DCE1E5", borderRadius: 6, padding: "8px 10px", marginBottom: 6 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 12.5 }}>{job.job_no}</div>
                  <div style={{ fontSize: 10.5, color: "var(--insp-muted)" }}>
                    {job.po_number ? `PO ${job.po_number}` : job.po_pending ? `PO pending — ${job.customer_name || "customer not recorded"}` : "No PO on file"}
                    {" — "}{job.certificate_count} certificate{job.certificate_count === 1 ? "" : "s"} so far — opened {new Date(job.created_at).toLocaleDateString()} by {job.created_by?.full_name || job.created_by?.email || "—"}
                  </div>
                </div>
                <button type="button" className="insp-btn insp-btn-primary" style={{ padding: "4px 12px", fontSize: 11.5 }} onClick={() => useJob(job)} disabled={busyJobNo !== ""}>
                  Use This Job
                </button>
              </div>
            ))
          )}
        </div>
      )}

      <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #E4E7E9" }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: "var(--insp-navy)", marginBottom: 8 }}>Start New Job</div>
        <div className="insp-row2">
          <div className="insp-field">
            <label htmlFor="jp-po">PO Number</label>
            <input id="jp-po" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} disabled={poPending} placeholder="e.g. PO-99887" />
          </div>
          <div className="insp-field" style={{ display: "flex", alignItems: "flex-end", paddingBottom: 6 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--insp-muted)" }}>
              <input type="checkbox" checked={poPending} onChange={(e) => { setPoPending(e.target.checked); if (e.target.checked) setPoNumber(""); }} />
              PO not available yet
            </label>
          </div>
        </div>
        {poPending && (
          <div className="insp-field">
            <label htmlFor="jp-customer">Customer Name</label>
            <input id="jp-customer" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Who this job is for, until the PO arrives" />
          </div>
        )}
        <button type="button" className="insp-btn insp-btn-primary" style={{ marginTop: 6 }} onClick={startNewJob} disabled={busyJobNo !== ""}>
          {busyJobNo === "__new__" ? "Starting..." : "+ Start New Job for This Vessel"}
        </button>
      </div>
    </fieldset>
  );
}
