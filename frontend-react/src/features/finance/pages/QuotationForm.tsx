import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../finance.css";
import { useAuth } from "../../../context/AuthContext";
import ItemPicker from "../components/ItemPicker";
import LineItemsEditor, { newLineFromItem, computeDocumentTotals } from "../components/LineItemsEditor";
import OverallDiscountField from "../components/OverallDiscountField";
import FinanceDocumentPreview from "../components/FinanceDocumentPreview";
import ConditionsEditor from "../components/ConditionsEditor";
import { listQuotations, saveQuotation, deleteQuotation, downloadQuotationPdf, DocumentConflictError } from "../services/finance.api";
import { getCachedQuotation, saveQuotationToCache, buildPendingQuotationDoc } from "../services/finance.storage";
import { queueQuotationSave } from "../../../offline/syncQueue";
import { DiscountType, FinanceItem, LineItem, QuotationDoc, DEFAULT_QUOTATION_CONDITIONS } from "../types/finance.types";
import { confirmAction } from "../../../components/ConfirmDialog";
import { hasPermission, PERM } from "../../auth/types/auth.types";
import { CURRENCIES, formatMoney } from "../data/currencies";

function generateQuotationNo(existing: QuotationDoc[]): string {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const count = existing.filter((q) => q.quotation_no.includes(ymd)).length + 1;
  return `QTN/HMZC/${ymd}-${String(count).padStart(3, "0")}`;
}

/**
 * Same catalog-driven line-item flow as InvoiceForm.tsx — a quotation is
 * the same kind of document, issued earlier in the process. Kept as a
 * separate page (not a shared generic component) because the two
 * diverge in small but real ways: different status vocabulary
 * (draft/sent/accepted/rejected vs draft/issued/paid/void), and an
 * invoice can reference the quotation it came from while a quotation
 * can't reference anything upstream of it.
 */
export default function QuotationForm() {
  const { quotationNo } = useParams<{ quotationNo?: string }>();
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
  const [conditions, setConditions] = useState<string[]>(DEFAULT_QUOTATION_CONDITIONS);
  // Requested directly: "using the USD as the main price, invoice can be
  // issued in any currency, have a section to change currency" — every
  // amount above stays in USD (the catalog/entry currency); currency +
  // exchangeRate (units of `currency` per 1 USD) only affect what's
  // shown in the preview/PDF, via formatMoney().
  const [currency, setCurrency] = useState("USD");
  const [exchangeRate, setExchangeRate] = useState(1);
  const [version, setVersion] = useState<number | null>(null);
  const [issuedBy, setIssuedBy] = useState<string | null>(null);
  const [issuedAt, setIssuedAt] = useState<string | null>(null);
  const [issuedById, setIssuedById] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // See InvoiceForm.tsx's identical fields for why these exist.
  const [lastKnownDoc, setLastKnownDoc] = useState<QuotationDoc | null>(null);
  const [localOnly, setLocalOnly] = useState(false);

  function applyQuotation(found: QuotationDoc) {
    setDocNo(found.quotation_no);
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
    setConditions(found.conditions || []);
    setVersion(found.version);
    setIssuedBy(found.issued_by ? (found.issued_by.full_name || found.issued_by.email) : null);
    setIssuedById(found.issued_by?.id ?? null);
    setIssuedAt(found.created_at);
    setLastKnownDoc(found);
    setLocalOnly(!!found._pending);
  }

  useEffect(() => {
    if (!quotationNo) {
      listQuotations().then((all) => setDocNo(generateQuotationNo(all))).catch(() => setDocNo(generateQuotationNo([])));
      return;
    }
    listQuotations()
      .then((all) => {
        const found = all.find((q) => q.quotation_no === quotationNo);
        if (found) {
          applyQuotation(found);
          saveQuotationToCache(found, false);
          return;
        }
        // Not (yet) on the server — may be a save still queued from an
        // offline session on this device. Check the local cache before
        // giving up.
        return getCachedQuotation(quotationNo).then((cached) => {
          if (cached) applyQuotation(cached);
          else setError("Quotation not found.");
        });
      })
      .catch(() => {
        // Couldn't reach the server at all — fall back entirely to
        // whatever this device has cached locally.
        getCachedQuotation(quotationNo).then((cached) => {
          if (cached) applyQuotation(cached);
          else setError("Quotation not found — and this device is offline, so it can't check the server either.");
        });
      });
  }, [quotationNo]);

  // Root-caused from an audit pass: ownership alone used to be enough to
  // edit — if an admin revokes someone's finance.edit permission (view-
  // only demotion) while leaving finance.view, they could still open a
  // quotation they originally issued (the route only requires FIN_VIEW)
  // and this form rendered fully editable, purely because issuedById
  // matched. The backend independently re-checks _can_edit on save, so
  // this was a frontend-only UX gap (a confusing 403 rather than an
  // actual security hole) — but every other edit gate in this app checks
  // hasPermission(...) too, so this now matches.
  const canEdit = hasPermission(user, PERM.FIN_EDIT) && (!quotationNo || user?.role === "admin" || issuedById === user?.id);
  const { subtotal, discountTotal, total } = computeDocumentTotals(lineItems, overallDiscountType, overallDiscountPercent, overallDiscountAmount);

  function addItem(item: FinanceItem) {
    setLineItems((prev) => [...prev, newLineFromItem(item)]);
  }

  async function handleSave(newStatus?: string) {
    setSaving(true);
    setError("");
    const payload = {
      quotation_no: docNo,
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
      conditions,
      version,
    };
    try {
      const saved = await saveQuotation(payload);
      setVersion(saved.version);
      setStatus(saved.status);
      setCurrency(saved.currency);
      setExchangeRate(saved.exchange_rate);
      setLastKnownDoc(saved);
      setLocalOnly(false);
      await saveQuotationToCache(saved, false);
      if (!quotationNo) navigate(`/finance/quotations/${encodeURIComponent(saved.quotation_no)}`, { replace: true });
    } catch (e: any) {
      if (e instanceof DocumentConflictError) {
        setError(e.message);
      } else if (!e?.response) {
        // Same reasoning as InvoiceForm.tsx's handleSave — queued so
        // it isn't lost, and cached locally (finance.storage.ts) so it
        // shows up in the Quotations list and can be reopened
        // immediately, then reconciled with the server's real
        // id/version once flushQueue() actually syncs it.
        const pendingDoc = buildPendingQuotationDoc(payload, lastKnownDoc, user);
        await saveQuotationToCache(pendingDoc, true);
        await queueQuotationSave(payload);
        setLastKnownDoc(pendingDoc);
        setLocalOnly(true);
        setError(`Saved on this device as ${payload.quotation_no} — couldn't reach the server. It'll sync automatically once you're back online (see the sync status in the header).`);
        if (!quotationNo) navigate(`/finance/quotations/${encodeURIComponent(payload.quotation_no)}`, { replace: true });
      } else {
        setError(e?.response?.data?.detail || "Could not save the quotation.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!quotationNo) return;
    const ok = await confirmAction({
      title: "Delete quotation?",
      message: `Quotation ${quotationNo} will be permanently deleted. This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    await deleteQuotation(quotationNo);
    navigate("/finance/quotations");
  }

  return (
    <div className="finance-page">
      <h1>{quotationNo ? `Quotation ${docNo}` : "New Quotation"}</h1>
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
            <div className="finance-field"><label htmlFor="quotation-no">Quotation No.</label><input id="quotation-no" value={docNo} readOnly /></div>
            <div className="finance-field">
              <label htmlFor="quotation-status">Status</label>
              <select id="quotation-status" value={status} onChange={(e) => setStatus(e.target.value)} disabled={!canEdit}>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
          <div className="finance-field"><label htmlFor="quotation-customer">Customer</label><input id="quotation-customer" value={customer} onChange={(e) => setCustomer(e.target.value)} disabled={!canEdit} /></div>
          <div className="finance-row2">
            <div className="finance-field"><label htmlFor="quotation-vessel">Vessel</label><input id="quotation-vessel" value={vesselName} onChange={(e) => setVesselName(e.target.value)} disabled={!canEdit} /></div>
            <div className="finance-field"><label htmlFor="quotation-imo">IMO No.</label><input id="quotation-imo" value={imoNo} onChange={(e) => setImoNo(e.target.value)} disabled={!canEdit} /></div>
          </div>

          {/* Requested directly: "using the USD as the main price,
              invoice can be issued in any currency, have a section to
              change currency." Everything above (line items, totals) is
              entered/stored in USD regardless of what's picked here —
              this only controls what currency the printed quotation
              shows. */}
          <div className="finance-row2">
            <div className="finance-field">
              <label htmlFor="quotation-currency">Currency</label>
              <select id="quotation-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={!canEdit}>
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.label}</option>)}
              </select>
            </div>
            {currency !== "USD" && (
              <div className="finance-field">
                <label htmlFor="quotation-rate">Exchange Rate (1 USD = ? {currency})</label>
                <input
                  id="quotation-rate"
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
              Prices are entered in USD above; the printed quotation will show {formatMoney(total, currency, exchangeRate)} (USD {total.toFixed(2)} @ {exchangeRate || 0}).
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
              Only an Administrator or the original issuer can edit this quotation.
            </p>
          )}

          {issuedBy && (
            <p style={{ fontSize: 11, color: "var(--insp-muted)" }}>
              Issued by {issuedBy}{issuedAt ? ` on ${new Date(issuedAt).toLocaleDateString()}` : ""}
            </p>
          )}

          <div className="finance-btn-row" style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            {canEdit && <button className="finance-btn finance-btn-outline" disabled={saving} onClick={() => handleSave("draft")}>Save Draft</button>}
            {canEdit && <button className="finance-btn finance-btn-primary" disabled={saving} onClick={() => handleSave("sent")}>Mark as Sent</button>}
            <button className="finance-btn finance-btn-outline" onClick={() => window.print()}>Print</button>
            {quotationNo && <button className="finance-btn finance-btn-outline" onClick={() => downloadQuotationPdf(quotationNo)}>Download PDF</button>}
            {quotationNo && hasPermission(user, PERM.FIN_DELETE) && <button className="finance-btn finance-btn-danger" onClick={handleDelete}>Delete</button>}
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
          {canEdit && (
            <div className="finance-panel" style={{ marginBottom: 16 }}>
              <h2 style={{ marginTop: 0 }}>Conditions</h2>
              <p style={{ fontSize: 11.5, color: "var(--insp-muted)", marginTop: -6 }}>
                Printed beside the totals block — edit, remove, or add as needed for this quotation.
              </p>
              <ConditionsEditor conditions={conditions} onChange={setConditions} />
            </div>
          )}
          <FinanceDocumentPreview
            kind="QUOTATION"
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
            conditions={conditions}
            issuedBy={issuedBy}
            issuedAt={issuedAt}
          />
        </div>
      </div>
    </div>
  );
}
