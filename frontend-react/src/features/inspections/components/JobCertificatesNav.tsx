import { useEffect, useMemo, useRef, useState } from "react";
import { InspectionCertificate } from "../types/inspection.types";
import { reportTypeLabel } from "../data/groupCertificatesByVessel";

interface Props {
  jobNo: string;
  certificates: Record<string, InspectionCertificate>;
  currentCertNo: string;
  onOpenCertificate: (certNo: string) => void;
}

/**
 * Requested directly: "when you open a vessel job and it has many
 * certificate for that job scope, you always have to open one, close,
 * get back to certificate, and open again... you have to always go
 * back to certificate to find the next certificate for that scope."
 * A job can realistically hold anywhere from a handful up to a few
 * hundred certificates (see reserve_cert_no's own comment on the
 * backend, written against a 300-item job) — this is the always-
 * visible fix: Prev/Next steps to the adjacent certificate in this
 * job with one click (no list, no round trip), and the toggle opens a
 * searchable, type-grouped panel for jumping anywhere in the job
 * directly, reusing onOpenCertificate (openCertificateWithSave in
 * InspectionWorkspace.tsx) — the same in-place, save-my-work-first
 * jump every other "open a different certificate" control here
 * already uses, so this never causes a full page reload or silently
 * drops unsaved edits.
 */
export default function JobCertificatesNav({ jobNo, certificates, currentCertNo, onOpenCertificate }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const jobCerts = useMemo(
    () =>
      Object.values(certificates)
        .filter((c) => c.jobRef === jobNo)
        // Numeric-aware sort — certificate numbers carry a trailing
        // sequence (e.g. "...-001", "...-002"); a plain string sort
        // would order "10" before "2".
        .sort((a, b) => a.certNo.localeCompare(b.certNo, undefined, { numeric: true })),
    [certificates, jobNo]
  );

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  // Nothing to page through — a job with only the certificate already
  // on screen (or none at all yet) doesn't need this control cluttering
  // the toolbar.
  if (jobCerts.length <= 1) return null;

  const currentIndex = jobCerts.findIndex((c) => c.certNo === currentCertNo);
  const prev = currentIndex > 0 ? jobCerts[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < jobCerts.length - 1 ? jobCerts[currentIndex + 1] : null;

  const filtered = query.trim()
    ? jobCerts.filter(
        (c) => c.certNo.toLowerCase().includes(query.trim().toLowerCase()) || reportTypeLabel(c).toLowerCase().includes(query.trim().toLowerCase())
      )
    : jobCerts;

  const grouped = new Map<string, InspectionCertificate[]>();
  for (const c of filtered) {
    const label = reportTypeLabel(c);
    if (!grouped.has(label)) grouped.set(label, []);
    grouped.get(label)!.push(c);
  }

  function jumpTo(certNo: string) {
    setOpen(false);
    setQuery("");
    onOpenCertificate(certNo);
  }

  return (
    <div className="insp-job-certs-nav no-print" ref={containerRef}>
      <button
        type="button"
        className="insp-job-certs-arrow"
        disabled={!prev}
        onClick={() => prev && jumpTo(prev.certNo)}
        title={prev ? `Previous: ${prev.certNo}` : "No previous certificate in this job"}
        aria-label="Previous certificate in this job"
      >
        ‹
      </button>
      <button type="button" className="insp-job-certs-toggle" onClick={() => setOpen((o) => !o)}>
        {currentIndex >= 0 ? `Certificate ${currentIndex + 1} of ${jobCerts.length} in this job` : `${jobCerts.length} certificates in this job`}
        <span className="insp-job-certs-caret">{open ? "▲" : "▼"}</span>
      </button>
      <button
        type="button"
        className="insp-job-certs-arrow"
        disabled={!next}
        onClick={() => next && jumpTo(next.certNo)}
        title={next ? `Next: ${next.certNo}` : "No next certificate in this job"}
        aria-label="Next certificate in this job"
      >
        ›
      </button>

      {open && (
        <div className="insp-job-certs-panel">
          <input
            type="search"
            autoFocus
            placeholder="Filter by certificate no. or type..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="insp-job-certs-search"
          />
          <div className="insp-job-certs-list">
            {filtered.length === 0 && <p className="insp-help-note" style={{ padding: "10px" }}>No matches.</p>}
            {Array.from(grouped.entries()).map(([label, certs]) => (
              <div key={label}>
                <div className="insp-job-certs-group">{label}</div>
                {certs.map((c) => (
                  <button
                    type="button"
                    key={c.certNo}
                    className={`insp-job-certs-row ${c.certNo === currentCertNo ? "active" : ""}`}
                    onClick={() => jumpTo(c.certNo)}
                  >
                    <span>{c.certNo}</span>
                    <span className={`insp-pill ${c.status === "final" ? "good" : ""}`}>{c.status === "final" ? "Finalized" : "Draft"}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
