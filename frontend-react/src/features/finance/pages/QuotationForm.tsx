import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../finance.css";
import { useAuth } from "../../../context/AuthContext";
import ItemPicker from "../components/ItemPicker";
import LineItemsEditor, { newLineFromItem, computeTotals } from "../components/LineItemsEditor";
import FinanceDocumentPreview from "../components/FinanceDocumentPreview";
import ConditionsEditor from "../components/ConditionsEditor";
import { listQuotations, saveQuotation, deleteQuotation, downloadQuotationPdf, DocumentConflictError } from "../services/finance.api";
import { queueQuotationSave } from "../../../offline/syncQueue";
import { FinanceItem, LineItem, QuotationDoc, DEFAULT_QUOTATION_CONDITIONS } from "../types/finance.types";
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

  useEffect(() => {
    if (!quotationNo) {
      listQuotations().then((all) => setDocNo(generateQuotationNo(all))).catch(() => setDocNo(generateQuotationNo([])));
      return;
    }
    listQuotations().then((all) => {
      const found = all.find((q) => q.quotation_no === quotationNo);
      if (!found) { setError("Quotation not found."); return; }
      setDocNo(found.quotation_no);
      setCustomer(found.customer);
      setVesselName(found.vessel_name || "");
      setImoNo(found.imo_no || "");
      setStatus(found.status);
      setLineItems(found.line_items);
      setCurrency(found.currency || "USD");
      setExchangeRate(found.exchange_rate || 1);
      setConditions(found.conditions || []);
      setVersion(found.version);
      setIssuedBy(found.issued_by ? (found.issued_by.full_name || found.issued_by.email) : null);
      setIssuedById(found.issued_by?.id ?? null);
      setIssuedAt(found.created_at);
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
  const { subtotal, discountTotal, total } = computeTotals(lineItems);

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
      if (!quotationNo) navigate(`/finance/quotations/${encodeURIComponent(saved.quotation_no)}`, { replace: true });
    } catch (e: any) {
      if (e instanceof DocumentConflictError) {
        setError(e.message);
      } else if (!e?.response) {
        // Same reasoning as InvoiceForm.tsx's handleSave — queued
        // instead of lost, but deliberately not navigated to its detail
        // route, since Finance has no local cache to serve a
        // not-yet-synced record from (unlike Certificates).
        await queueQuotationSave(payload);
        setError(`Saved on this device as ${payload.quotation_no} — couldn't reach the server. It'll sync automatically once you're back online (see the sync status in the header), but it won't appear in the Quotations list until then.`);
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
