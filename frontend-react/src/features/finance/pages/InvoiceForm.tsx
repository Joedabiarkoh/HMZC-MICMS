import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../finance.css";
import { useAuth } from "../../../context/AuthContext";
import ItemPicker from "../components/ItemPicker";
import LineItemsEditor, { newLineFromItem, computeTotals } from "../components/LineItemsEditor";
import FinanceDocumentPreview from "../components/FinanceDocumentPreview";
import { listInvoices, saveInvoice, deleteInvoice, DocumentConflictError } from "../services/finance.api";
import { queueInvoiceSave } from "../../../offline/syncQueue";
import { FinanceItem, LineItem, InvoiceDoc } from "../types/finance.types";
import { confirmAction } from "../../../components/ConfirmDialog";
import { hasPermission, PERM } from "../../auth/types/auth.types";

function generateInvoiceNo(existing: InvoiceDoc[]): string {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const count = existing.filter((i) => i.invoice_no.includes(ymd)).length + 1;
  return `INV/HMZC/${ymd}-${String(count).padStart(3, "0")}`;
}

/**
 * The core of what was asked for: search the item catalog, select items
 * to build up the invoice, quantity is typed in per line (varies per
 * vessel), price comes from the catalog automatically but can be
 * overridden, and a discount can be applied per line. Handles both
 * creating a new invoice (no :invoiceNo in the URL) and editing an
 * existing one (loads it, sends its `version` back so a real edit
 * conflict is caught rather than silently overwritten).
 */
export default function InvoiceForm() {
  const { invoiceNo } = useParams<{ invoiceNo?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [docNo, setDocNo] = useState("");
  const [customer, setCustomer] = useState("");
  const [vesselName, setVesselName] = useState("");
  const [imoNo, setImoNo] = useState("");
  const [status, setStatus] = useState("draft");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [version, setVersion] = useState<number | null>(null);
  const [issuedBy, setIssuedBy] = useState<string | null>(null);
  const [issuedAt, setIssuedAt] = useState<string | null>(null);
  const [issuedById, setIssuedById] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!invoiceNo) {
      listInvoices().then((all) => setDocNo(generateInvoiceNo(all))).catch(() => setDocNo(generateInvoiceNo([])));
      return;
    }
    listInvoices().then((all) => {
      const found = all.find((i) => i.invoice_no === invoiceNo);
      if (!found) { setError("Invoice not found."); return; }
      setDocNo(found.invoice_no);
      setCustomer(found.customer);
      setVesselName(found.vessel_name || "");
      setImoNo(found.imo_no || "");
      setStatus(found.status);
      setLineItems(found.line_items);
      setVersion(found.version);
      setIssuedBy(found.issued_by ? (found.issued_by.full_name || found.issued_by.email) : null);
      setIssuedById(found.issued_by?.id ?? null);
      setIssuedAt(found.created_at);
    });
  }, [invoiceNo]);

  const canEdit = !invoiceNo || user?.role === "admin" || issuedById === user?.id;
  const { subtotal, discountTotal, total } = computeTotals(lineItems);

  function addItem(item: FinanceItem) {
    setLineItems((prev) => [...prev, newLineFromItem(item)]);
  }

  async function handleSave(newStatus?: string) {
    setSaving(true);
    setError("");
    const payload = {
      invoice_no: docNo,
      customer,
      vessel_name: vesselName || null,
      imo_no: imoNo || null,
      status: newStatus || status,
      line_items: lineItems,
      subtotal,
      discount_total: discountTotal,
      total,
      version,
    };
    try {
      const saved = await saveInvoice(payload);
      setVersion(saved.version);
      setStatus(saved.status);
      if (!invoiceNo) navigate(`/finance/invoices/${encodeURIComponent(saved.invoice_no)}`, { replace: true });
    } catch (e: any) {
      if (e instanceof DocumentConflictError) {
        // A real conflict, not a connectivity problem — queueing would
        // just hit the same 409 again. Same distinction
        // InspectionWorkspace already makes for certificates.
        setError(e.message);
      } else if (!e?.response) {
        // No response at all means the request never reached the
        // server (offline, DNS failure, etc.) rather than the server
        // rejecting it — this was previously just a lost invoice with
        // a generic error message. Now queued the same way an offline
        // certificate save is (see syncQueue.ts) so it isn't lost.
        //
        // Deliberately does NOT navigate to the invoice's detail route
        // the way a real save does — unlike Certificates (which have a
        // local-first cache in inspection.storage.ts that can serve a
        // not-yet-synced record immediately), Finance has no local
        // cache at all; navigating there would immediately re-fetch
        // from the server, find nothing, and show "Invoice not found."
        // Full offline parity for Finance (a local cache so a queued
        // invoice shows up in the Invoices list before it's synced,
        // the way Certificate Log already does) is real follow-up work,
        // not something this fix does — see the root README.
        await queueInvoiceSave(payload);
        setError(`Saved on this device as ${payload.invoice_no} — couldn't reach the server. It'll sync automatically once you're back online (see the sync status in the header), but it won't appear in the Invoices list until then.`);
      } else {
        setError(e?.response?.data?.detail || "Could not save the invoice.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!invoiceNo) return;
    const ok = await confirmAction({
      title: "Delete invoice?",
      message: `Invoice ${invoiceNo} will be permanently deleted. This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    await deleteInvoice(invoiceNo);
    navigate("/finance/invoices");
  }

  return (
    <div className="finance-page">
      <h1>{invoiceNo ? `Invoice ${docNo}` : "New Invoice"}</h1>
      <p className="finance-subtitle">HMZC LTD — Marine Engineering Services</p>
      {error && <div style={{ background: "#FBEEEC", border: "1px solid var(--insp-red)", color: "#7A241B", borderRadius: 6, padding: "8px 12px", fontSize: 12, marginBottom: 12 }}>{error}</div>}

      <div className="finance-form-layout">
        <div className="finance-panel">
          <div className="finance-row2">
            <div className="finance-field"><label>Invoice No.</label><input value={docNo} readOnly /></div>
            <div className="finance-field">
              <label>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} disabled={!canEdit}>
                <option value="draft">Draft</option>
                <option value="issued">Issued</option>
                <option value="paid">Paid</option>
                <option value="void">Void</option>
              </select>
            </div>
          </div>
          <div className="finance-field"><label>Customer</label><input value={customer} onChange={(e) => setCustomer(e.target.value)} disabled={!canEdit} /></div>
          <div className="finance-row2">
            <div className="finance-field"><label>Vessel</label><input value={vesselName} onChange={(e) => setVesselName(e.target.value)} disabled={!canEdit} /></div>
            <div className="finance-field"><label>IMO No.</label><input value={imoNo} onChange={(e) => setImoNo(e.target.value)} disabled={!canEdit} /></div>
          </div>

          {canEdit && (
            <>
              <h2 style={{ marginTop: 18 }}>Add Item</h2>
              <ItemPicker onSelect={addItem} />
            </>
          )}

          {!canEdit && (
            <p style={{ fontSize: 11.5, color: "var(--insp-muted)" }}>
              Only an Administrator or the original issuer can edit this invoice.
            </p>
          )}

          {issuedBy && (
            <p style={{ fontSize: 11, color: "var(--insp-muted)" }}>
              Issued by {issuedBy}{issuedAt ? ` on ${new Date(issuedAt).toLocaleDateString()}` : ""}
            </p>
          )}

          <div className="finance-btn-row" style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            {canEdit && <button className="finance-btn finance-btn-outline" disabled={saving} onClick={() => handleSave("draft")}>Save Draft</button>}
            {canEdit && <button className="finance-btn finance-btn-primary" disabled={saving} onClick={() => handleSave("issued")}>Issue Invoice</button>}
            <button className="finance-btn finance-btn-outline" onClick={() => window.print()}>Print</button>
            {invoiceNo && hasPermission(user, PERM.FIN_DELETE) && <button className="finance-btn finance-btn-danger" onClick={handleDelete}>Delete</button>}
          </div>
        </div>

        <div>
          {canEdit && (
            <div className="finance-panel" style={{ marginBottom: 16 }}>
              <h2 style={{ marginTop: 0 }}>Line Items</h2>
              <LineItemsEditor lineItems={lineItems} onChange={setLineItems} />
            </div>
          )}
          <FinanceDocumentPreview
            kind="INVOICE"
            docNo={docNo}
            customer={customer}
            vesselName={vesselName || null}
            imoNo={imoNo || null}
            status={status}
            lineItems={lineItems}
            subtotal={subtotal}
            discountTotal={discountTotal}
            total={total}
            issuedBy={issuedBy}
            issuedAt={issuedAt}
          />
        </div>
      </div>
    </div>
  );
}
