import { useEffect, useState } from "react";
import {
  deleteInvoiceAttachment,
  downloadAllInvoiceAttachments,
  downloadInvoiceAttachment,
  listInvoiceAttachments,
  uploadInvoiceAttachment,
} from "../services/finance.api";
import { INVOICE_ATTACHMENT_LABELS, InvoiceAttachment } from "../types/finance.types";

interface Props {
  invoiceNo: string;
  canEdit: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Requested directly: "allow other supporting document to be uploaded
 * and save or send all together like service report, PO, delivery
 * note and any additional supporting document." Only rendered once the
 * invoice has a real invoice_no it can be attached to (InvoiceForm.tsx
 * only mounts this after the first save) — an attachment needs a real
 * invoice_id server-side to belong to.
 */
export default function InvoiceAttachments({ invoiceNo, canEdit }: Props) {
  const [attachments, setAttachments] = useState<InvoiceAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState<string>(INVOICE_ATTACHMENT_LABELS[0]);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);

  function load() {
    setLoading(true);
    listInvoiceAttachments(invoiceNo)
      .then(setAttachments)
      .catch((e) => setError(e?.response?.data?.detail || "Could not load supporting documents."))
      .finally(() => setLoading(false));
  }
  useEffect(load, [invoiceNo]);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      await uploadInvoiceAttachment(invoiceNo, file, label);
      setFile(null);
      setFileInputKey((k) => k + 1);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Could not upload the file.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(a: InvoiceAttachment) {
    try {
      await deleteInvoiceAttachment(invoiceNo, a.id);
      setAttachments((prev) => prev.filter((x) => x.id !== a.id));
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Could not delete the file.");
    }
  }

  return (
    <div className="finance-panel" style={{ marginTop: 16 }}>
      <h2 style={{ marginTop: 0 }}>Supporting Documents</h2>
      <p style={{ fontSize: 11.5, color: "var(--insp-muted)", marginTop: -6 }}>
        Service report, PO, delivery note, or any other document related to this invoice — saved here and
        downloadable together.
      </p>

      {error && <div style={{ background: "#FBEEEC", border: "1px solid var(--insp-red)", color: "#7A241B", borderRadius: 6, padding: "8px 12px", fontSize: 12, marginBottom: 12 }}>{error}</div>}

      {canEdit && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
          <select value={label} onChange={(e) => setLabel(e.target.value)} style={{ padding: "6px 8px", fontSize: 12.5 }}>
            {INVOICE_ATTACHMENT_LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <input key={fileInputKey} type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ fontSize: 12.5 }} />
          <button className="finance-btn finance-btn-outline" disabled={!file || uploading} onClick={handleUpload}>
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>
      )}

      {loading && <p style={{ fontSize: 12.5 }}>Loading...</p>}

      {!loading && attachments.length === 0 && (
        <p style={{ fontSize: 12.5, color: "var(--insp-muted)" }}>No supporting documents uploaded yet.</p>
      )}

      {!loading && attachments.length > 0 && (
        <>
          <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse", marginBottom: 12 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #DCE1E5" }}>
                <th style={{ padding: "4px 6px" }}>Label</th>
                <th style={{ padding: "4px 6px" }}>File</th>
                <th style={{ padding: "4px 6px" }}>Size</th>
                <th style={{ padding: "4px 6px" }}>Uploaded By</th>
                <th style={{ width: 90 }}></th>
              </tr>
            </thead>
            <tbody>
              {attachments.map((a) => (
                <tr key={a.id} style={{ borderTop: "1px solid #EEF1F3" }}>
                  <td style={{ padding: "4px 6px" }}>{a.label}</td>
                  <td style={{ padding: "4px 6px" }}>
                    <button
                      type="button"
                      onClick={() => downloadInvoiceAttachment(invoiceNo, a)}
                      style={{ border: "none", background: "none", color: "var(--insp-navy)", textDecoration: "underline", cursor: "pointer", padding: 0, fontSize: 12.5 }}
                    >
                      {a.original_filename}
                    </button>
                  </td>
                  <td style={{ padding: "4px 6px", color: "var(--insp-muted)" }}>{formatSize(a.size_bytes)}</td>
                  <td style={{ padding: "4px 6px", color: "var(--insp-muted)" }}>{a.uploaded_by?.full_name || a.uploaded_by?.email || "—"}</td>
                  <td style={{ padding: "4px 6px" }}>
                    {canEdit && (
                      <button type="button" className="insp-btn insp-btn-outline" style={{ padding: "2px 8px", fontSize: 11, color: "var(--insp-red)" }} onClick={() => handleDelete(a)}>
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="finance-btn finance-btn-outline" onClick={() => downloadAllInvoiceAttachments(invoiceNo)}>
            Download All
          </button>
        </>
      )}
    </div>
  );
}
