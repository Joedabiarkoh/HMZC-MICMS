import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../finance.css";
import { useAuth } from "../../../context/AuthContext";
import ItemPicker from "../components/ItemPicker";
import LineItemsEditor, { newLineFromItem, computeDocumentTotals } from "../components/LineItemsEditor";
import OverallDiscountField from "../components/OverallDiscountField";
import FinanceDocumentPreview from "../components/FinanceDocumentPreview";
import InvoiceAttachments from "../components/InvoiceAttachments";
import StagedInvoiceAttachments, { StagedAttachment } from "../components/StagedInvoiceAttachments";
import { listInvoices, saveInvoice, deleteInvoice, openInvoicePdf, uploadInvoiceAttachment, DocumentConflictError } from "../services/finance.api";
import { getCachedInvoice, saveInvoiceToCache, buildPendingInvoiceDoc } from "../services/finance.storage";
import { queueInvoiceSave } from "../../../offline/syncQueue";
import { DiscountType, FinanceItem, LineItem, InvoiceDoc } from "../types/finance.types";
import { confirmAction } from "../../../components/ConfirmDialog";
import { hasPermission, PERM } from "../../auth/types/auth.types";
import { CURRENCIES, formatMoney } from "../data/currencies";

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
  // Requested directly: "can we make the discount lumpsum for all the
  // invoice and not each line item" — a document-level discount on top
  // of whatever the line items above already discount, not a
  // replacement for them. See computeDocumentTotals/OverallDiscountField.
  const [overallDiscountType, setOverallDiscountType] = useState<DiscountType>("percent");
  const [overallDiscountPercent, setOverallDiscountPercent] = useState(0);
  const [overallDiscountAmount, setOverallDiscountAmount] = useState(0);
  // Same design as QuotationForm.tsx — every amount above stays in USD;
  // currency/exchangeRate only affect what's shown in the preview/PDF.
  const [currency, setCurrency] = useState("USD");
  const [exchangeRate, setExchangeRate] = useState(1);
  const [stagedFiles, setStagedFiles] = useState<StagedAttachment[]>([]);
  const [version, setVersion] = useState<number | null>(null);
  const [issuedBy, setIssuedBy] = useState<string | null>(null);
  const [issuedAt, setIssuedAt] = useState<string | null>(null);
  const [issuedById, setIssuedById] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // The last full InvoiceDoc this form actually had in hand (from the
  // server or the local cache), used as the base when an offline save
  // needs to synthesize a cacheable doc — see buildPendingInvoiceDoc.
  const [lastKnownDoc, setLastKnownDoc] = useState<InvoiceDoc | null>(null);
  // Set when this invoice was loaded from the local cache rather than
  // the server — i.e. it's a save still queued from an offline session
  // (see finance.storage.ts) — so the form can say so instead of quietly
  // looking identical to a confirmed, synced invoice.
  const [localOnly, setLocalOnly] = useState(false);

  function applyInvoice(found: InvoiceDoc) {
    setDocNo(found.invoice_no);
    setCustomer(found.customer);
    setVesselName(found.vessel_name || "");
    setImoNo(found.imo_no || "");
    setStatus(found.status);
    setLineItems(found.line_items);
    setOverallDiscountType(found.overall_discount_type || "percent");
    setOverallDiscountPercent(found.overall_discount_percent || 0);
    setOverallDiscountAmount(found.overall_discount_amount || 0);
    setCurrency(found.currency || "USD");
    setExchangeRate(found.exchange_rate || 1);
    setVersion(found.version);
    setIssuedBy(found.issued_by ? (found.issued_by.full_name || found.issued_by.email) : null);
    setIssuedById(found.issued_by?.id ?? null);
    setIssuedAt(found.created_at);
    setLastKnownDoc(found);
    setLocalOnly(!!found._pending);
  }

  useEffect(() => {
    if (!invoiceNo) {
      listInvoices().then((all) => setDocNo(generateInvoiceNo(all))).catch(() => setDocNo(generateInvoiceNo([])));
      return;
    }
    listInvoices()
      .then((all) => {
        const found = all.find((i) => i.invoice_no === invoiceNo);
        if (found) {
          applyInvoice(found);
          saveInvoiceToCache(found, false);
          return;
        }
        // Not (yet) on the server — may be a save still queued from an
        // offline session on this device. Check the local cache before
        // giving up.
        return getCachedInvoice(invoiceNo).then((cached) => {
          if (cached) applyInvoice(cached);
          else setError("Invoice not found.");
        });
      })
      .catch(() => {
        // Couldn't reach the server at all — fall back entirely to
        // whatever this device has cached locally.
        getCachedInvoice(invoiceNo).then((cached) => {
          if (cached) applyInvoice(cached);
          else setError("Invoice not found — and this device is offline, so it can't check the server either.");
        });
      });
  }, [invoiceNo]);

  // Same fix as QuotationForm.tsx's canEdit — ownership alone used to be
  // enough to edit, inconsistent with InvoiceAttachments below (which
  // already checked FIN_EDIT for its own canEdit prop) and with the
  // backend, which independently re-checks _can_edit on save regardless.
  const canEdit = hasPermission(user, PERM.FIN_EDIT) && (!invoiceNo || user?.role === "admin" || issuedById === user?.id);
  const { subtotal, discountTotal, total } = computeDocumentTotals(lineItems, overallDiscountType, overallDiscountPercent, overallDiscountAmount);

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
      overall_discount_type: overallDiscountType,
      overall_discount_percent: overallDiscountPercent,
      overall_discount_amount: overallDiscountAmount,
      discount_total: discountTotal,
      total,
      currency,
      exchange_rate: currency === "USD" ? 1 : exchangeRate,
      version,
    };
    try {
      const saved = await saveInvoice(payload);
      setVersion(saved.version);
      setStatus(saved.status);
      setCurrency(saved.currency);
      setExchangeRate(saved.exchange_rate);
      setLastKnownDoc(saved);
      setLocalOnly(false);
      await saveInvoiceToCache(saved, false);
      // Requested directly: documents loaded while creating the invoice
      // (before it had a real invoice_id to attach to) get uploaded now,
      // right after the invoice that owns them actually exists. Best
      // effort per file — one failing upload doesn't lose the others or
      // block the save the user actually asked for.
      if (stagedFiles.length > 0) {
        const failed: string[] = [];
        for (const sf of stagedFiles) {
          try {
            await uploadInvoiceAttachment(saved.invoice_no, sf.file, sf.label);
          } catch {
            failed.push(sf.file.name);
          }
        }
        setStagedFiles([]);
        if (failed.length > 0) {
          setError(`Invoice saved, but couldn't upload: ${failed.join(", ")}. Add them again from Supporting Documents below.`);
        }
      }
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
        // rejecting it. Queued the same way an offline certificate save
        // is (see syncQueue.ts) so it isn't lost, and now also cached
        // locally (finance.storage.ts) the same way Certificates already
        // are — so it shows up in the Invoices list and can be reopened
        // immediately, then gets reconciled with the server's real
        // id/version once flushQueue() actually syncs it.
        const pendingDoc = buildPendingInvoiceDoc(payload, lastKnownDoc, user);
        await saveInvoiceToCache(pendingDoc, true);
        await queueInvoiceSave(payload);
        setLastKnownDoc(pendingDoc);
        setLocalOnly(true);
        setError(`Saved on this device as ${payload.invoice_no} — couldn't reach the server. It'll sync automatically once you're back online (see the sync status in the header).`);
        if (!invoiceNo) navigate(`/finance/invoices/${encodeURIComponent(payload.invoice_no)}`, { replace: true });
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
      {error && <div className="no-print" style={{ background: "#FBEEEC", border: "1px solid var(--insp-red)", color: "#7A241B", borderRadius: 6, padding: "8px 12px", fontSize: 12, marginBottom: 12 }}>{error}</div>}
      {localOnly && !error && (
        <div className="no-print" style={{ background: "#FFF7E0", border: "1px solid #D9A441", color: "#7A5B1B", borderRadius: 6, padding: "8px 12px", fontSize: 12, marginBottom: 12 }}>
          Saved on this device — waiting to sync to the server. It'll update automatically once that happens.
        </div>
      )}

      <div className="finance-form-layout">
        <div className="finance-panel">
          <div className="finance-row2">
            <div className="finance-field"><label htmlFor="invoice-no">Invoice No.</label><input id="invoice-no" value={docNo} readOnly /></div>
            <div className="finance-field">
              <label htmlFor="invoice-status">Status</label>
              <select id="invoice-status" value={status} onChange={(e) => setStatus(e.target.value)} disabled={!canEdit}>
                <option value="draft">Draft</option>
                <option value="issued">Issued</option>
                <option value="paid">Paid</option>
                <option value="void">Void</option>
              </select>
            </div>
          </div>
          <div className="finance-field"><label htmlFor="invoice-customer">Customer</label><input id="invoice-customer" value={customer} onChange={(e) => setCustomer(e.target.value)} disabled={!canEdit} /></div>
          <div className="finance-row2">
            <div className="finance-field"><label htmlFor="invoice-vessel">Vessel</label><input id="invoice-vessel" value={vesselName} onChange={(e) => setVesselName(e.target.value)} disabled={!canEdit} /></div>
            <div className="finance-field"><label htmlFor="invoice-imo">IMO No.</label><input id="invoice-imo" value={imoNo} onChange={(e) => setImoNo(e.target.value)} disabled={!canEdit} /></div>
          </div>

          {/* Requested directly: "using the USD as the main price,
              invoice can be issued in any currency, have a section to
              change currency." Everything above (line items, totals) is
              entered/stored in USD regardless of what's picked here —
              this only controls what currency the printed invoice shows. */}
          <div className="finance-row2">
            <div className="finance-field">
              <label htmlFor="invoice-currency">Currency</label>
              <select id="invoice-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={!canEdit}>
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.label}</option>)}
              </select>
            </div>
            {currency !== "USD" && (
              <div className="finance-field">
                <label htmlFor="invoice-rate">Exchange Rate (1 USD = ? {currency})</label>
                <input
                  id="invoice-rate"
                  type="number"
                  min="0"
                  step="0.0001"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(Number(e.target.value) || 0)}
                  disabled={!canEdit}
                />
              </div>
            )}
          </div>
          {currency !== "USD" && (
            <p style={{ fontSize: 11, color: "var(--insp-muted)", marginTop: -8 }}>
              Prices are entered in USD above; the printed invoice will show {formatMoney(total, currency, exchangeRate)} (USD {total.toFixed(2)} @ {exchangeRate || 0}).
            </p>
          )}

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
            {/* Requested directly: "when you give the command to print
                or save the loaded documents will be added to the
                invoice document." window.print() can only ever print
                the current page, so it can't merge in separately
                uploaded files — this instead opens the server-rendered
                combined PDF (invoice + every Supporting Document below)
                in a new tab, where the browser's own PDF viewer covers
                both printing and saving from one merged document. Only
                available once the invoice is actually saved, same
                gating as the Supporting Documents section itself. */}
            {invoiceNo && <button className="finance-btn finance-btn-outline" onClick={() => openInvoicePdf(invoiceNo)}>Print / Save (with Attachments)</button>}
            {invoiceNo && hasPermission(user, PERM.FIN_DELETE) && <button className="finance-btn finance-btn-danger" onClick={handleDelete}>Delete</button>}
          </div>
        </div>

        <div>
          {canEdit && (
            <div className="finance-panel" style={{ marginBottom: 16 }}>
              <h2 style={{ marginTop: 0 }}>Line Items</h2>
              <LineItemsEditor lineItems={lineItems} onChange={setLineItems} />
              <div style={{ maxWidth: 260, marginTop: 10 }}>
                <OverallDiscountField
                  discountType={overallDiscountType}
                  discountPercent={overallDiscountPercent}
                  discountAmount={overallDiscountAmount}
                  onChange={(patch) => {
                    if (patch.discountType !== undefined) setOverallDiscountType(patch.discountType);
                    if (patch.discountPercent !== undefined) setOverallDiscountPercent(patch.discountPercent);
                    if (patch.discountAmount !== undefined) setOverallDiscountAmount(patch.discountAmount);
                  }}
                />
              </div>
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
            currency={currency}
            exchangeRate={exchangeRate}
            issuedBy={issuedBy}
            issuedAt={issuedAt}
          />

          {/* Requested directly: this section must not be invisible
              while a new invoice is still being created — before the
              first save there's no real invoice_id for an attachment to
              belong to, so StagedInvoiceAttachments holds the files
              locally instead of uploading them; handleSave() uploads
              each one right after the invoice is created. Once saved,
              this switches to the real InvoiceAttachments (list/
              upload/delete/download-all against the actual invoice_id).
              Gated on this page's own `canEdit` (admin or the original
              issuer) — an audit pass found the backend's attachment
              upload/delete routes only checked finance.edit, letting any
              Finance user tamper with another user's invoice's supporting
              documents; both now agree on the same ownership rule. */}
          {invoiceNo ? (
            <InvoiceAttachments invoiceNo={invoiceNo} canEdit={canEdit} />
          ) : (
            hasPermission(user, PERM.FIN_EDIT) && <StagedInvoiceAttachments files={stagedFiles} onChange={setStagedFiles} />
          )}
        </div>
      </div>
    </div>
  );
}
