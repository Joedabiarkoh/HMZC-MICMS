import { useState } from "react";
import { closeLooseGearJob, createLooseGearJob, listLooseGearJobs, LooseGearJob, reserveCertNo } from "../services/looseGearJobs.api";

interface Props {
  vesselName: string;
  imoNo: string;
  onVesselChange: (v: string) => void;
  onImoChange: (v: string) => void;
  onJobSelected: (result: { jobNo: string; certNo: string }) => void;
}

// Requested directly: "before you create a certificate job number
// must be created for you and all the certificate that will be
// created within that job number will be grouped under that job
// number." Shown by LooseGearForm.tsx in place of the normal
// Standard Report/Multiple Items form for a brand-new certificate
// that hasn't been tied to a Job yet — a technician must pick an
// existing open Job for this vessel, or start a new one, before the
// certificate even gets a real number (see reserveCertNo,
// looseGearJobs.api.ts — that's what backend-fastapi's
// LooseGearJob.next_item_seq is for).
export default function LooseGearJobPicker({ vesselName, imoNo, onVesselChange, onImoChange, onJobSelected }: Props) {
  const [jobs, setJobs] = useState<LooseGearJob[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyJobNo, setBusyJobNo] = useState("");

  async function findJobs() {
    if (!vesselName.trim()) {
      setError("Enter a vessel name first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const openJobs = await listLooseGearJobs(vesselName.trim(), "open");
      setJobs(openJobs);
    } catch {
      setError("Couldn't look up jobs for this vessel — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function useJob(job: LooseGearJob) {
    setBusyJobNo(job.job_no);
    setError("");
    try {
      const reserved = await reserveCertNo(job.job_no);
      onVesselChange(job.vessel_name);
      onImoChange(job.imo_no || "");
      onJobSelected({ jobNo: reserved.job_no, certNo: reserved.cert_no });
    } catch {
      setError("Couldn't reserve a certificate number under that job — it may have just been closed. Try refreshing the job list.");
    } finally {
      setBusyJobNo("");
    }
  }

  async function startNewJob() {
    if (!vesselName.trim()) {
      setError("Enter a vessel name first.");
      return;
    }
    setBusyJobNo("__new__");
    setError("");
    try {
      const job = await createLooseGearJob(vesselName.trim(), imoNo.trim());
      const reserved = await reserveCertNo(job.job_no);
      onImoChange(job.imo_no || "");
      onJobSelected({ jobNo: reserved.job_no, certNo: reserved.cert_no });
    } catch {
      setError("Couldn't start a new job — check your connection and try again.");
    } finally {
      setBusyJobNo("");
    }
  }

  return (
    <fieldset className="insp-fieldset">
      <legend className="insp-legend">Job</legend>
      <p className="insp-help-note">
        Every item examined on this vessel visit is grouped under one Job — pick an existing open job below, or start a new one.
      </p>
      <div className="insp-row2">
        <div className="insp-field">
          <label htmlFor="lgj-vessel">Vessel</label>
          <input id="lgj-vessel" value={vesselName} onChange={(e) => { onVesselChange(e.target.value); setJobs(null); }} />
        </div>
        <div className="insp-field">
          <label htmlFor="lgj-imo">IMO No. (optional)</label>
          <input id="lgj-imo" value={imoNo} onChange={(e) => onImoChange(e.target.value)} />
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
                    {job.next_item_seq - 1} item{job.next_item_seq - 1 === 1 ? "" : "s"} so far — opened {new Date(job.created_at).toLocaleDateString()} by {job.created_by?.full_name || job.created_by?.email || "—"}
                  </div>
                </div>
                <button type="button" className="insp-btn insp-btn-primary" style={{ padding: "4px 12px", fontSize: 11.5 }} onClick={() => useJob(job)} disabled={busyJobNo !== ""}>
                  {busyJobNo === job.job_no ? "Adding..." : "Add Item to This Job"}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      <button type="button" className="insp-btn insp-btn-primary" style={{ marginTop: 10 }} onClick={startNewJob} disabled={busyJobNo !== ""}>
        {busyJobNo === "__new__" ? "Starting..." : "+ Start New Job for This Vessel"}
      </button>
    </fieldset>
  );
}
