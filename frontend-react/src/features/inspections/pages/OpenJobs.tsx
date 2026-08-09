import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../inspections.css";
import { useAuth } from "../../../context/AuthContext";
import { hasPermission, PERM } from "../../auth/types/auth.types";
import { confirmAction } from "../../../components/ConfirmDialog";
import { Job, listJobs, closeJob } from "../services/jobs.api";

type SortMode = "oldest" | "newest" | "vessel";

/**
 * Requested directly: a way to "keep tap on the jobs that are opened"
 * — before this, an open Job was only discoverable if you already knew
 * which vessel to search for (JobPicker's own "Find Open Jobs for This
 * Vessel" box, or expanding a vessel in Certificate Log). There was no
 * single place listing every open job company-wide, so a job left open
 * by mistake (or just genuinely still in progress) could sit there
 * indefinitely with nobody noticing. The backend's list_jobs (see
 * api/routes/jobs.py) already supported an unfiltered, status-only
 * query — vessel_name is optional there and was simply never called
 * without one — so this page needed no backend changes.
 *
 * Sorted oldest-opened-first by default so the jobs most likely to
 * have been forgotten surface at the top, rather than the ones opened
 * most recently (which are the least likely to need attention).
 */
export default function OpenJobs() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("oldest");
  const [closingJob, setClosingJob] = useState("");

  async function load() {
    setError("");
    try {
      const openJobs = await listJobs(undefined, "open");
      setJobs(openJobs);
    } catch {
      setError("Couldn't load open jobs — check your connection and try again.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (jobs || []).filter((j) => {
      if (!q) return true;
      return (
        j.job_no.toLowerCase().includes(q) ||
        j.vessel_name.toLowerCase().includes(q) ||
        (j.imo_no || "").toLowerCase().includes(q) ||
        (j.po_number || "").toLowerCase().includes(q) ||
        (j.customer_name || "").toLowerCase().includes(q)
      );
    });
    const sorted = [...list];
    if (sortMode === "oldest") sorted.sort((a, b) => a.created_at.localeCompare(b.created_at));
    else if (sortMode === "newest") sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    else sorted.sort((a, b) => a.vessel_name.localeCompare(b.vessel_name));
    return sorted;
  }, [jobs, search, sortMode]);

  // Same action as CertificateLog.tsx's "Close Job" — requires
  // jobs.create (opening/closing a job is the one thing an admin might
  // want to restrict to specific people; see core/permissions.py's own
  // comment on JOB_CREATE), not certificates.edit.
  async function handleCloseJob(jobNo: string) {
    const ok = await confirmAction({
      title: "Close this job?",
      message: `No new certificates can be created under ${jobNo} once it's closed. Certificates already issued under it stay fully editable.`,
      confirmLabel: "Close Job",
    });
    if (!ok) return;
    setClosingJob(jobNo);
    try {
      await closeJob(jobNo);
      setJobs((prev) => (prev || []).filter((j) => j.job_no !== jobNo));
    } catch {
      window.alert(`Couldn't close ${jobNo} — check your connection and try again.`);
    } finally {
      setClosingJob("");
    }
  }

  function daysOpen(createdAt: string): number {
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
  }

  function goToVessel(job: Job) {
    const params = new URLSearchParams();
    params.set("vesselName", job.vessel_name);
    if (job.imo_no) params.set("imoNo", job.imo_no);
    navigate(`/inspections?${params.toString()}`);
  }

  return (
    <div className="inspections-page">
      <div className="insp-topbar">
        <div>
          <h1>Open Jobs</h1>
          <p>Every job across every vessel that hasn't been closed yet.</p>
        </div>
      </div>

      <div style={{ padding: "16px 20px" }}>
        {error && (
          <div style={{ background: "#FBF0E2", border: "1px solid #B4690E", color: "#7A4A08", borderRadius: 6, padding: "8px 12px", fontSize: 12, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Search by vessel, job no., IMO, PO, or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "8px 10px", border: "1px solid #C9D1D8", borderRadius: 6, fontSize: 13, minWidth: 320 }}
          />
          <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)} style={{ padding: "8px 10px", border: "1px solid #C9D1D8", borderRadius: 6, fontSize: 13 }}>
            <option value="oldest">Oldest opened first</option>
            <option value="newest">Newest opened first</option>
            <option value="vessel">Vessel (A–Z)</option>
          </select>
          <span style={{ fontSize: 11.5, color: "var(--insp-muted)" }}>
            {jobs === null ? "Loading..." : `${filtered.length} open job${filtered.length === 1 ? "" : "s"}`}
          </span>
        </div>

        <table className="users-table" style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden", border: "1px solid #DCE1E5" }}>
          <thead>
            <tr>
              <th>Job No</th><th>Vessel</th><th>IMO No.</th><th>PO / Customer</th><th>Certificates</th><th>Days Open</th><th>Opened By</th><th></th>
            </tr>
          </thead>
          <tbody>
            {jobs !== null && filtered.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: 24, color: "#6B7480" }}>No open jobs.</td></tr>
            )}
            {filtered.map((job) => {
              const open = daysOpen(job.created_at);
              return (
                <tr key={job.job_no} style={{ borderTop: "1px solid #E4E8EB" }}>
                  <td style={{ padding: "8px 12px", fontWeight: 700 }}>{job.job_no}</td>
                  <td style={{ padding: "8px 12px" }}>{job.vessel_name}</td>
                  <td style={{ padding: "8px 12px" }}>{job.imo_no || "—"}</td>
                  <td style={{ padding: "8px 12px" }}>
                    {job.po_number ? `PO ${job.po_number}` : job.po_pending ? `Pending — ${job.customer_name || "not recorded"}` : "—"}
                  </td>
                  <td style={{ padding: "8px 12px" }}>{job.certificate_count}</td>
                  <td style={{ padding: "8px 12px", color: open >= 7 ? "var(--insp-red)" : undefined, fontWeight: open >= 7 ? 700 : undefined }}>
                    {open === 0 ? "Today" : `${open} day${open === 1 ? "" : "s"}`}
                  </td>
                  <td style={{ padding: "8px 12px" }}>{job.created_by?.full_name || job.created_by?.email || "—"}</td>
                  <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                    <button type="button" className="insp-btn insp-btn-outline" style={{ padding: "3px 10px", fontSize: 11, marginRight: 6 }} onClick={() => goToVessel(job)}>
                      View / Add Certificates
                    </button>
                    {hasPermission(user, PERM.JOB_CREATE) && (
                      <button
                        type="button"
                        className="insp-btn insp-btn-outline"
                        style={{ padding: "3px 10px", fontSize: 11 }}
                        onClick={() => handleCloseJob(job.job_no)}
                        disabled={closingJob === job.job_no}
                      >
                        {closingJob === job.job_no ? "Closing..." : "Close Job"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
