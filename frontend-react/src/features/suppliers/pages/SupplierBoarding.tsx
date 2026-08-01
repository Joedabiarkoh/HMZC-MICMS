import { useEffect, useState } from "react";
import "../../finance/finance.css"; // reuses .finance-page/.finance-panel/.finance-btn/.finance-row2 rather than duplicating them
import "../../inspections/inspections.css"; // reuses .insp-btn/.insp-muted/.insp-navy/.insp-red rather than duplicating them
import { useAuth } from "../../../context/AuthContext";
import { hasPermission, PERM } from "../../auth/types/auth.types";
import {
  deleteBoardingSubmission,
  downloadBoardingSubmission,
  downloadBoardingTemplate,
  listBoardingSubmissions,
  uploadBoardingSubmission,
} from "../services/suppliers.api";
import { SupplierBoardingSubmission } from "../types/supplier.types";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Requested directly: "create a section for suppliers boarding, allow
 * for the document to be downloaded and uploaded after it has been
 * filled, use this type of form." Deliberately a simple submissions
 * log — download the blank New Supplier Form template, fill it in
 * offline, upload the completed copy back here with the supplier's
 * name attached — not a full Supplier register (no Supplier entity
 * existed anywhere in this app before this).
 */
export default function SupplierBoarding() {
  const { user } = useAuth();
  const canManage = hasPermission(user, PERM.SUPPLIER_MANAGE);

  const [submissions, setSubmissions] = useState<SupplierBoardingSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [supplierName, setSupplierName] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [uploading, setUploading] = useState(false);

  function load() {
    setLoading(true);
    listBoardingSubmissions()
      .then(setSubmissions)
      .catch((e) => setError(e?.response?.data?.detail || "Could not load supplier boarding submissions."))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function handleUpload() {
    if (!file || !supplierName.trim()) return;
    setUploading(true);
    setError("");
    try {
      await uploadBoardingSubmission(supplierName.trim(), notes.trim(), file);
      setSupplierName("");
      setNotes("");
      setFile(null);
      setFileInputKey((k) => k + 1);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Could not upload the completed form.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(submission: SupplierBoardingSubmission) {
    try {
      await deleteBoardingSubmission(submission.id);
      setSubmissions((prev) => prev.filter((s) => s.id !== submission.id));
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Could not delete the submission.");
    }
  }

  return (
    <div className="finance-page">
      <h1>Supplier Boarding</h1>
      <p className="finance-subtitle">Download the New Supplier Form, fill it in, and upload the completed copy back here.</p>

      {error && <div style={{ background: "#FBEEEC", border: "1px solid var(--insp-red)", color: "#7A241B", borderRadius: 6, padding: "8px 12px", fontSize: 12, marginBottom: 12 }}>{error}</div>}

      <div className="finance-panel" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>1. Download the Form</h2>
        <p style={{ fontSize: 12, color: "var(--insp-muted)" }}>
          The blank New Supplier Form template, in the exact format used for this business's supplier onboarding.
        </p>
        <button className="finance-btn finance-btn-outline" onClick={() => downloadBoardingTemplate()}>
          Download Template
        </button>
      </div>

      {canManage && (
        <div className="finance-panel" style={{ marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>2. Upload the Completed Form</h2>
          <div className="finance-row2">
            <div className="finance-field">
              <label htmlFor="boarding-supplier-name">Supplier Name</label>
              <input id="boarding-supplier-name" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
            </div>
            <div className="finance-field">
              <label htmlFor="boarding-notes">Notes (optional)</label>
              <input id="boarding-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
            <input key={fileInputKey} type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ fontSize: 12.5 }} />
            <button className="finance-btn finance-btn-primary" disabled={!file || !supplierName.trim() || uploading} onClick={handleUpload}>
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </div>
      )}

      <div className="finance-panel">
        <h2 style={{ marginTop: 0 }}>Submissions</h2>
        {loading && <p style={{ fontSize: 12.5 }}>Loading...</p>}
        {!loading && submissions.length === 0 && (
          <p style={{ fontSize: 12.5, color: "var(--insp-muted)" }}>No completed forms uploaded yet.</p>
        )}
        {!loading && submissions.length > 0 && (
          <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #DCE1E5" }}>
                <th style={{ padding: "4px 6px" }}>Supplier</th>
                <th style={{ padding: "4px 6px" }}>File</th>
                <th style={{ padding: "4px 6px" }}>Size</th>
                <th style={{ padding: "4px 6px" }}>Uploaded By</th>
                <th style={{ padding: "4px 6px" }}>Date</th>
                <th style={{ width: 90 }}></th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.id} style={{ borderTop: "1px solid #EEF1F3" }}>
                  <td style={{ padding: "4px 6px" }}>
                    {s.supplier_name}
                    {s.notes && <div style={{ fontSize: 11, color: "var(--insp-muted)" }}>{s.notes}</div>}
                  </td>
                  <td style={{ padding: "4px 6px" }}>
                    <button
                      type="button"
                      onClick={() => downloadBoardingSubmission(s)}
                      style={{ border: "none", background: "none", color: "var(--insp-navy)", textDecoration: "underline", cursor: "pointer", padding: 0, fontSize: 12.5 }}
                    >
                      {s.original_filename}
                    </button>
                  </td>
                  <td style={{ padding: "4px 6px", color: "var(--insp-muted)" }}>{formatSize(s.size_bytes)}</td>
                  <td style={{ padding: "4px 6px", color: "var(--insp-muted)" }}>{s.uploaded_by?.full_name || s.uploaded_by?.email || "—"}</td>
                  <td style={{ padding: "4px 6px", color: "var(--insp-muted)" }}>{new Date(s.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: "4px 6px" }}>
                    {canManage && (
                      <button type="button" className="insp-btn insp-btn-outline" style={{ padding: "2px 8px", fontSize: 11, color: "var(--insp-red)" }} onClick={() => handleDelete(s)}>
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
