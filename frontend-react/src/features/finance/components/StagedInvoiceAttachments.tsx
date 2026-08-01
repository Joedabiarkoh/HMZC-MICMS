import { useState } from "react";
import { INVOICE_ATTACHMENT_LABELS } from "../types/finance.types";

export interface StagedAttachment {
  file: File;
  label: string;
}

interface Props {
  files: StagedAttachment[];
  onChange: (next: StagedAttachment[]) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Requested directly: the place to attach supporting documents was
 * invisible while actually creating a new invoice — InvoiceAttachments
 * only renders once the invoice has a real invoice_id server-side, so a
 * brand-new "New Invoice" draft had nowhere to load documents into
 * until after the first save. This is the pre-save counterpart: the
 * same "Supporting Documents" card, in the same spot (the preview side,
 * next to FinanceDocumentPreview), but it only stages files locally
 * (File objects held in InvoiceForm.tsx's state) rather than uploading
 * them — there's no invoice_id yet for them to belong to. InvoiceForm's
 * handleSave() uploads every staged file right after the invoice is
 * actually created, so from the user's point of view documents loaded
 * here end up attached exactly the same as ones added after saving.
 */
export default function StagedInvoiceAttachments({ files, onChange }: Props) {
  const [label, setLabel] = useState<string>(INVOICE_ATTACHMENT_LABELS[0]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  function addFile() {
    if (!pendingFile) return;
    onChange([...files, { file: pendingFile, label }]);
    setPendingFile(null);
    setFileInputKey((k) => k + 1);
  }

  function removeFile(i: number) {
    onChange(files.filter((_, idx) => idx !== i));
  }

  return (
    <div className="finance-panel" style={{ marginTop: 16 }}>
      <h2 style={{ marginTop: 0 }}>Supporting Documents</h2>
      <p style={{ fontSize: 11.5, color: "var(--insp-muted)", marginTop: -6 }}>
        Service report, PO, delivery note, or any other document related to this invoice. Load them here while
        creating the invoice — they're uploaded and attached as soon as you save.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <select value={label} onChange={(e) => setLabel(e.target.value)} style={{ padding: "6px 8px", fontSize: 12.5 }}>
          {INVOICE_ATTACHMENT_LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <input key={fileInputKey} type="file" onChange={(e) => setPendingFile(e.target.files?.[0] || null)} style={{ fontSize: 12.5 }} />
        <button type="button" className="finance-btn finance-btn-outline" disabled={!pendingFile} onClick={addFile}>
          Add
        </button>
      </div>

      {files.length === 0 && (
        <p style={{ fontSize: 12.5, color: "var(--insp-muted)" }}>No supporting documents loaded yet.</p>
      )}

      {files.length > 0 && (
        <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #DCE1E5" }}>
              <th style={{ padding: "4px 6px" }}>Label</th>
              <th style={{ padding: "4px 6px" }}>File</th>
              <th style={{ padding: "4px 6px" }}>Size</th>
              <th style={{ width: 90 }}></th>
            </tr>
          </thead>
          <tbody>
            {files.map((f, i) => (
              <tr key={i} style={{ borderTop: "1px solid #EEF1F3" }}>
                <td style={{ padding: "4px 6px" }}>{f.label}</td>
                <td style={{ padding: "4px 6px" }}>{f.file.name}</td>
                <td style={{ padding: "4px 6px", color: "var(--insp-muted)" }}>{formatSize(f.file.size)}</td>
                <td style={{ padding: "4px 6px" }}>
                  <button type="button" className="insp-btn insp-btn-outline" style={{ padding: "2px 8px", fontSize: 11, color: "var(--insp-red)" }} onClick={() => removeFile(i)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
