import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../finance.css";
import { useAuth } from "../../../context/AuthContext";
import { hasPermission, PERM } from "../../auth/types/auth.types";
import ItemPicker from "../components/ItemPicker";
import PurchaseOrderPreview, { POPreviewData } from "../components/PurchaseOrderPreview";
import { confirmAction } from "../../../components/ConfirmDialog";
import { DocumentConflictError } from "../services/finance.api";
import {
  deletePOAttachment, deletePurchaseOrder, downloadPOAttachment, downloadPurchaseOrderPdf, getPurchaseOrder,
  listPOAttachments, listPOVendors, listPurchaseOrders, savePurchaseOrder, transitionPurchaseOrder, uploadPOAttachment,
} from "../services/purchaseOrders.api";
import { listJobs, Job } from "../../inspections/services/jobs.api";
import { FinanceItem } from "../types/finance.types";
import {
  formatPOMoney, PO_CURRENCIES, POAction, POAttachment, POLine, POVendor, PurchaseOrder, POStatus,
} from "../types/purchaseOrder.types";

const todayIso = () => new Date().toISOString().slice(0, 10);
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const ATTACHMENT_LABELS = ["Vendor Quote", "Vendor Invoice", "Delivery Note", "Other"];

interface FormState {
  poNo: string;
  orderDate: string;
  deliveryDate: string;
  deliveryTerms: string;
  quoteRef: string;
  subject: string;
  jobNo: string;
  vendorName: string;
  vendorVat: string;
  vendorPhone: string;
  vendorEmail: string;
  vendorPhysicalAddress: string;
  vendorPostalAddress: string;
  deliveryAddress: string;
  deliveryContactPhone: string;
  deliveryContactEmail: string;
  currency: string;
  notes: string;
  writtenByTitle: string;
}

const BLANK: FormState = {
  poNo: "", orderDate: todayIso(), deliveryDate: "", deliveryTerms: "", quoteRef: "", subject: "", jobNo: "",
  vendorName: "", vendorVat: "", vendorPhone: "", vendorEmail: "", vendorPhysicalAddress: "", vendorPostalAddress: "",
  deliveryAddress: "", deliveryContactPhone: "", deliveryContactEmail: "", currency: "USD", notes: "", writtenByTitle: "",
};

function fromOrder(o: PurchaseOrder): FormState {
  return {
    poNo: o.po_no, orderDate: o.order_date || "", deliveryDate: o.delivery_date || "", deliveryTerms: o.delivery_terms || "",
    quoteRef: o.quote_ref || "", subject: o.subject || "", jobNo: o.job_no || "",
    vendorName: o.vendor_name, vendorVat: o.vendor_vat || "", vendorPhone: o.vendor_phone || "", vendorEmail: o.vendor_email || "",
    vendorPhysicalAddress: o.vendor_physical_address || "", vendorPostalAddress: o.vendor_postal_address || "",
    deliveryAddress: o.delivery_address || "", deliveryContactPhone: o.delivery_contact_phone || "",
    deliveryContactEmail: o.delivery_contact_email || "", currency: o.currency, notes: o.notes || "",
    writtenByTitle: o.written_by_title || "",
  };
}

const orNull = (s: string) => (s.trim() ? s.trim() : null);

export default function PurchaseOrderForm() {
  const { poNo: routePoNo } = useParams<{ poNo?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [f, setF] = useState<FormState>(BLANK);
  const [lines, setLines] = useState<POLine[]>([]);
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [vendors, setVendors] = useState<POVendor[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [attachments, setAttachments] = useState<POAttachment[]>([]);
  const [attLabel, setAttLabel] = useState(ATTACHMENT_LABELS[0]);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));

  const status: POStatus = order?.status ?? "draft";
  const isAdmin = user?.role === "admin";
  const canEditPerm = hasPermission(user, PERM.FIN_EDIT);
  const isOwner = !order || order.written_by?.id === user?.id;
  // The backend decides finally; this only decides what the screen offers.
  const canEdit = canEditPerm && (isAdmin || isOwner) && status !== "closed" && status !== "cancelled" && status !== "received";
  const canApprove = hasPermission(user, PERM.FIN_PO_APPROVE);
  const total = round2(lines.reduce((s, l) => s + l.line_total, 0));

  useEffect(() => {
    listPOVendors().then(setVendors).catch(() => {});
    listJobs(undefined, "open").then(setJobs).catch(() => {});
  }, []);

  // New PO: prefill the delivery block from the most recent PO.
  useEffect(() => {
    if (routePoNo) return;
    listPurchaseOrders()
      .then((all) => {
        const last = all[0];
        if (last) {
          setF((p) => ({
            ...p,
            deliveryAddress: p.deliveryAddress || last.delivery_address || "",
            deliveryContactPhone: p.deliveryContactPhone || last.delivery_contact_phone || "",
            deliveryContactEmail: p.deliveryContactEmail || last.delivery_contact_email || "",
            deliveryTerms: p.deliveryTerms || last.delivery_terms || "",
          }));
        }
      })
      .catch(() => {});
  }, [routePoNo]);

  async function load(no: string) {
    try {
      const o = await getPurchaseOrder(no);
      setOrder(o);
      setF(fromOrder(o));
      setLines(o.line_items);
      listPOAttachments(no).then(setAttachments).catch(() => {});
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Purchase order not found.");
    }
  }

  useEffect(() => {
    if (routePoNo) void load(routePoNo);
  }, [routePoNo]);

  function pickVendor(name: string) {
    set("vendorName", name);
    const v = vendors.find((x) => x.name.toLowerCase() === name.trim().toLowerCase());
    if (v && v.source === "purchase_order") {
      setF((p) => ({
        ...p,
        vendorName: v.name,
        vendorVat: v.vat || "",
        vendorPhone: v.phone || "",
        vendorEmail: v.email || "",
        vendorPhysicalAddress: v.physical_address || "",
        vendorPostalAddress: v.postal_address || "",
        currency: p.currency === "USD" && v.currency ? v.currency : p.currency,
      }));
    }
  }

  function addCatalogItem(item: FinanceItem) {
    // Catalog prices are USD; a PO in another currency starts at the catalog
    // number and the buyer overrides it with the vendor's price.
    setLines((p) => [...p, {
      finance_item_id: item.id, code: item.code, description: item.name + (item.description ? ` — ${item.description}` : ""),
      quantity: 1, unit: item.unit || "", unit_price: item.unit_price, line_total: item.unit_price,
    }]);
  }

  function addBlankLine() {
    setLines((p) => [...p, { code: "", description: "", quantity: 1, unit: "", unit_price: 0, line_total: 0 }]);
  }

  function patchLine(i: number, patch: Partial<POLine>) {
    setLines((p) => p.map((l, idx) => {
      if (idx !== i) return l;
      const n = { ...l, ...patch };
      n.line_total = round2(n.quantity * n.unit_price);
      return n;
    }));
  }

  function payload() {
    return {
      po_no: orNull(f.poNo),
      version: order?.version ?? null,
      order_date: f.orderDate || null,
      delivery_date: f.deliveryDate || null,
      delivery_terms: orNull(f.deliveryTerms),
      quote_ref: orNull(f.quoteRef),
      subject: orNull(f.subject),
      job_no: orNull(f.jobNo),
      vendor_name: f.vendorName,
      vendor_vat: orNull(f.vendorVat),
      vendor_phone: orNull(f.vendorPhone),
      vendor_email: orNull(f.vendorEmail),
      vendor_physical_address: orNull(f.vendorPhysicalAddress),
      vendor_postal_address: orNull(f.vendorPostalAddress),
      delivery_address: orNull(f.deliveryAddress),
      delivery_contact_phone: orNull(f.deliveryContactPhone),
      delivery_contact_email: orNull(f.deliveryContactEmail),
      currency: f.currency,
      line_items: lines,
      subtotal: total,
      total,
      notes: orNull(f.notes),
      written_by_title: orNull(f.writtenByTitle),
    };
  }

  function explain(e: any, fallback: string): string {
    if (e instanceof DocumentConflictError) return e.message;
    const d = e?.response?.data?.detail;
    if (Array.isArray(d)) return d.map((x: any) => x.msg).join("; ");
    return d || fallback;
  }

  async function handleSave(): Promise<PurchaseOrder | null> {
    setError(""); setNotice("");
    if (!f.vendorName.trim()) { setError("Choose or type a vendor."); return null; }
    if (lines.length === 0) { setError("Add at least one line item."); return null; }
    setSaving(true);
    try {
      const saved = await savePurchaseOrder(payload());
      setOrder(saved);
      setF(fromOrder(saved));
      setLines(saved.line_items);
      setNotice(saved.status === "draft" && order && order.status !== "draft"
        ? "Saved. Editing an approved order sends it back to Draft — it needs approving again."
        : "Saved.");
      if (!routePoNo) navigate(`/finance/purchase-orders/${encodeURIComponent(saved.po_no)}`, { replace: true });
      return saved;
    } catch (e: any) {
      setError(explain(e, "Could not save the purchase order."));
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function act(action: POAction, extra: { title?: string; reason?: string; received_date?: string } = {}) {
    if (!order) return;
    setError(""); setNotice(""); setSaving(true);
    try {
      const o = await transitionPurchaseOrder(order.po_no, { action, version: order.version, ...extra });
      setOrder(o);
      setF(fromOrder(o));
      setLines(o.line_items);
    } catch (e: any) {
      setError(explain(e, "That action could not be completed."));
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    // Save any pending edits first so the approver sees what's on screen.
    const saved = await handleSave();
    if (!saved) return;
    setSaving(true);
    try {
      const o = await transitionPurchaseOrder(saved.po_no, { action: "submit", version: saved.version });
      setOrder(o); setF(fromOrder(o)); setLines(o.line_items);
      setNotice("Submitted for approval.");
    } catch (e: any) {
      setError(explain(e, "Could not submit for approval."));
    } finally { setSaving(false); }
  }

  async function handleApprove() {
    const title = window.prompt("Your position title, printed under your signature:", order?.approved_by_title || "");
    if (!title || !title.trim()) return;
    const ok = await confirmAction({
      title: "Approve this purchase order?",
      message: `${order?.po_no} for ${order ? formatPOMoney(order.total, order.currency) : ""} will be signed with your saved signature.`,
      confirmLabel: "Approve",
    });
    if (ok) await act("approve", { title: title.trim() });
  }

  async function handleReturn() {
    const reason = window.prompt("Why is it being returned to the author?");
    if (reason && reason.trim()) await act("return", { reason: reason.trim() });
  }

  async function handleCancel() {
    const reason = window.prompt("Reason for cancelling this purchase order:");
    if (!reason || !reason.trim()) return;
    const ok = await confirmAction({ title: "Cancel purchase order?", message: `${order?.po_no} will be marked cancelled.`, confirmLabel: "Cancel PO", danger: true });
    if (ok) await act("cancel", { reason: reason.trim() });
  }

  async function handleReceive() {
    const d = window.prompt("Date received (YYYY-MM-DD):", todayIso());
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) await act("receive", { received_date: d });
    else if (d) setError("Enter the date as YYYY-MM-DD.");
  }

  async function handleDelete() {
    if (!order) return;
    const ok = await confirmAction({ title: "Delete purchase order?", message: `${order.po_no} will be permanently deleted.`, confirmLabel: "Delete", danger: true });
    if (!ok) return;
    try {
      await deletePurchaseOrder(order.po_no);
      navigate("/finance/purchase-orders");
    } catch (e: any) { setError(explain(e, "Could not delete.")); }
  }

  async function handleUpload(file: File | undefined) {
    if (!file || !order) return;
    try {
      const a = await uploadPOAttachment(order.po_no, file, attLabel);
      setAttachments((p) => [...p, a]);
    } catch (e: any) { setError(explain(e, "Upload failed.")); }
    if (fileRef.current) fileRef.current.value = "";
  }

  const preview: POPreviewData = useMemo(() => ({
    poNo: f.poNo || (order?.po_no ?? "(assigned on save)"),
    status, revision: order?.revision ?? 0,
    orderDate: f.orderDate, deliveryDate: f.deliveryDate, deliveryTerms: f.deliveryTerms, quoteRef: f.quoteRef,
    subject: f.subject, jobNo: f.jobNo, vendorName: f.vendorName, vendorVat: f.vendorVat, vendorPhone: f.vendorPhone,
    vendorEmail: f.vendorEmail, vendorPhysicalAddress: f.vendorPhysicalAddress, vendorPostalAddress: f.vendorPostalAddress,
    deliveryAddress: f.deliveryAddress, deliveryContactPhone: f.deliveryContactPhone, deliveryContactEmail: f.deliveryContactEmail,
    currency: f.currency, lines, subtotal: total, total, notes: f.notes,
    writtenByName: order?.written_by_name ?? (user?.full_name || user?.email || null),
    writtenByTitle: f.writtenByTitle || null,
    writtenBySignatureUrl: order?.written_by_signature_url ?? null,
    approvedByName: order?.approved_by_name ?? null,
    approvedByTitle: order?.approved_by_title ?? null,
    approvedBySignatureUrl: order?.approved_by_signature_url ?? null,
    approvedAt: order?.approved_at ?? null,
  }), [f, lines, order, status, total, user]);

  const dis = !canEdit;
  const input = (id: string, labelText: string, key: keyof FormState, type = "text") => (
    <div className="finance-field">
      <label htmlFor={id}>{labelText}</label>
      <input id={id} type={type} value={f[key]} onChange={(e) => set(key, e.target.value)} disabled={dis} />
    </div>
  );

  return (
    <div className="finance-page">
      <h1>{routePoNo ? `Purchase Order ${order?.po_no ?? routePoNo}` : "New Purchase Order"}</h1>
      <p className="finance-subtitle">
        HMZC LTD — Marine Engineering Services
        {order && <> · <span className={`finance-status-pill ${status}`}>{status.replace("_", " ")}</span></>}
        {order?.is_overdue && <span style={{ color: "var(--insp-red)", fontWeight: 700 }}> · overdue</span>}
      </p>
      {error && <div className="no-print" style={{ background: "#FBEEEC", border: "1px solid var(--insp-red)", color: "#7A241B", borderRadius: 6, padding: "8px 12px", fontSize: 12, marginBottom: 12 }}>{error}</div>}
      {notice && !error && <div className="no-print" style={{ background: "#EEF7EE", border: "1px solid var(--insp-green)", color: "#245B2A", borderRadius: 6, padding: "8px 12px", fontSize: 12, marginBottom: 12 }}>{notice}</div>}
      {order?.return_reason && status === "draft" && (
        <div className="no-print" style={{ background: "#FFF7E0", border: "1px solid #D9A441", color: "#7A5B1B", borderRadius: 6, padding: "8px 12px", fontSize: 12, marginBottom: 12 }}>
          Returned by the approver: {order.return_reason}
        </div>
      )}
      {order?.status === "cancelled" && order.cancel_reason && (
        <div className="no-print" style={{ fontSize: 12, marginBottom: 12 }}>Cancelled: {order.cancel_reason}</div>
      )}

      <div className="finance-form-layout">
        <div className="finance-panel">
          <div className="finance-row2">
            <div className="finance-field">
              <label htmlFor="po-no">PO No.</label>
              <input id="po-no" value={f.poNo} onChange={(e) => set("poNo", e.target.value)} disabled={!!order || dis}
                placeholder="Assigned automatically (YY-NNNN)" />
            </div>
            {input("po-order-date", "Order Date", "orderDate", "date")}
          </div>
          <div className="finance-row2">
            {input("po-delivery-date", "Delivery Date", "deliveryDate", "date")}
            {input("po-quote", "Vendor Quote Ref", "quoteRef")}
          </div>
          {input("po-delivery-terms", "Delivery Terms", "deliveryTerms")}
          {input("po-subject", "Subject / Requisition", "subject")}

          <div className="finance-field">
            <label htmlFor="po-job">Linked Job No.</label>
            <input id="po-job" list="po-jobs" value={f.jobNo} onChange={(e) => set("jobNo", e.target.value)} disabled={dis} placeholder="Optional" />
            <datalist id="po-jobs">
              {jobs.map((j) => <option key={j.id} value={j.job_no}>{j.vessel_name}</option>)}
            </datalist>
          </div>

          <h2 style={{ marginTop: 18 }}>Vendor</h2>
          <div className="finance-field">
            <label htmlFor="po-vendor">Vendor name</label>
            <input id="po-vendor" list="po-vendors" value={f.vendorName} onChange={(e) => pickVendor(e.target.value)} disabled={dis}
              placeholder="Pick a supplier or type a new one" />
            <datalist id="po-vendors">
              {vendors.map((v) => <option key={`${v.source}-${v.name}`} value={v.name}>{v.source === "supplier_boarding" ? "Boarded supplier" : "Previous PO"}</option>)}
            </datalist>
          </div>
          <div className="finance-row2">
            {input("po-vendor-vat", "VAT / NIF", "vendorVat")}
            {input("po-vendor-phone", "Phone", "vendorPhone")}
          </div>
          {input("po-vendor-email", "Email", "vendorEmail", "email")}
          {input("po-vendor-phys", "Physical address", "vendorPhysicalAddress")}
          {input("po-vendor-post", "Postal address", "vendorPostalAddress")}

          <h2 style={{ marginTop: 18 }}>Delivery</h2>
          {input("po-del-addr", "Deliver to (address)", "deliveryAddress")}
          <div className="finance-row2">
            {input("po-del-phone", "Contact phone", "deliveryContactPhone")}
            {input("po-del-email", "Contact email", "deliveryContactEmail", "email")}
          </div>

          <div className="finance-row2">
            <div className="finance-field">
              <label htmlFor="po-currency">Currency</label>
              <select id="po-currency" value={f.currency} onChange={(e) => set("currency", e.target.value)} disabled={dis}>
                {PO_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {input("po-title", "Your position title", "writtenByTitle")}
          </div>
          <div className="finance-field">
            <label htmlFor="po-notes">Notes</label>
            <textarea id="po-notes" rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} disabled={dis} />
          </div>

          {order?.approved_by_name && (
            <p style={{ fontSize: 11, color: "var(--insp-muted)" }}>
              Approved by {order.approved_by_name}{order.approved_at ? ` on ${new Date(order.approved_at).toLocaleDateString()}` : ""}.
              {order.sent_at && ` Sent ${new Date(order.sent_at).toLocaleDateString()}.`}
              {order.received_at && ` Received ${order.received_at}.`}
            </p>
          )}
          {!canEdit && order && status !== "draft" && (
            <p style={{ fontSize: 11.5, color: "var(--insp-muted)" }}>
              This order is {status.replace("_", " ")}{status === "pending_approval" ? " — return it to edit." : "."}
            </p>
          )}

          <div className="finance-btn-row no-print" style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            {canEdit && <button className="finance-btn finance-btn-outline" disabled={saving} onClick={() => void handleSave()}>Save</button>}
            {canEdit && (status === "draft") && <button className="finance-btn finance-btn-primary" disabled={saving} onClick={() => void handleSubmit()}>Submit for approval</button>}
            {canEdit && (status === "approved" || status === "sent") && order && (
              <span style={{ fontSize: 11, color: "var(--insp-muted)", alignSelf: "center" }}>Saving changes returns it to Draft for re-approval.</span>
            )}
            {order && status === "pending_approval" && canApprove && (
              <>
                <button className="finance-btn finance-btn-primary" disabled={saving} onClick={() => void handleApprove()}>Approve &amp; sign</button>
                <button className="finance-btn finance-btn-outline" disabled={saving} onClick={() => void handleReturn()}>Return</button>
              </>
            )}
            {order && status === "approved" && canEditPerm && <button className="finance-btn finance-btn-primary" disabled={saving} onClick={() => void act("send")}>Mark as sent</button>}
            {order && status === "sent" && canEditPerm && <button className="finance-btn finance-btn-primary" disabled={saving} onClick={() => void handleReceive()}>Mark received</button>}
            {order && status === "received" && canEditPerm && <button className="finance-btn finance-btn-primary" disabled={saving} onClick={() => void act("close")}>Close</button>}
            {order && ["draft", "pending_approval", "approved", "sent"].includes(status) && canEditPerm && (
              <button className="finance-btn finance-btn-danger" disabled={saving} onClick={() => void handleCancel()}>Cancel PO</button>
            )}
            <button className="finance-btn finance-btn-outline" onClick={() => window.print()}>Print</button>
            {order && <button className="finance-btn finance-btn-outline" onClick={() => downloadPurchaseOrderPdf(order.po_no).catch(() => setError("Could not download the PDF."))}>Download PDF</button>}
            {order && attachments.length > 0 && (
              <button className="finance-btn finance-btn-outline" onClick={() => downloadPurchaseOrderPdf(order.po_no, true).catch(() => setError("Could not download the PDF."))}>PDF + attachments</button>
            )}
            {order && hasPermission(user, PERM.FIN_DELETE) && (status === "draft" || status === "cancelled") && (
              <button className="finance-btn finance-btn-danger" onClick={() => void handleDelete()}>Delete</button>
            )}
          </div>
        </div>

        <div>
          {canEdit && (
            <div className="finance-panel no-print" style={{ marginBottom: 16 }}>
              <h2 style={{ marginTop: 0 }}>Line Items</h2>
              <ItemPicker onSelect={addCatalogItem} />
              <p style={{ fontSize: 11, color: "var(--insp-muted)" }}>
                Catalog prices are in USD — set each price to the vendor's quote in {f.currency}.
              </p>
              <table className="finance-table" style={{ marginTop: 6 }}>
                <thead><tr><th>Description</th><th style={{ width: 70 }}>Qty</th><th style={{ width: 70 }}>Unit</th><th style={{ width: 100 }}>Unit price</th><th style={{ width: 90 }}>Amount</th><th /></tr></thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i}>
                      <td><input aria-label={`Line ${i + 1} description`} style={{ width: "100%" }} value={l.description} onChange={(e) => patchLine(i, { description: e.target.value })} /></td>
                      <td><input aria-label={`Line ${i + 1} quantity`} type="number" min="0" step="any" style={{ width: "100%" }} value={l.quantity} onChange={(e) => patchLine(i, { quantity: Number(e.target.value) || 0 })} /></td>
                      <td><input aria-label={`Line ${i + 1} unit`} style={{ width: "100%" }} value={l.unit} onChange={(e) => patchLine(i, { unit: e.target.value })} /></td>
                      <td><input aria-label={`Line ${i + 1} unit price`} type="number" min="0" step="any" style={{ width: "100%" }} value={l.unit_price} onChange={(e) => patchLine(i, { unit_price: Number(e.target.value) || 0 })} /></td>
                      <td style={{ textAlign: "right" }}>{l.line_total.toFixed(2)}</td>
                      <td><button type="button" className="finance-btn finance-btn-danger" style={{ padding: "2px 8px" }} aria-label={`Remove line ${i + 1}`} onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))}>×</button></td>
                    </tr>
                  ))}
                  {lines.length === 0 && <tr><td colSpan={6} style={{ color: "var(--insp-muted)", textAlign: "center" }}>No lines yet — pick from the catalog or add a blank line.</td></tr>}
                </tbody>
              </table>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <button type="button" className="finance-btn finance-btn-outline" onClick={addBlankLine}>+ Blank line</button>
                <strong>Total: {formatPOMoney(total, f.currency)}</strong>
              </div>
            </div>
          )}

          {order && (
            <div className="finance-panel no-print" style={{ marginBottom: 16 }}>
              <h2 style={{ marginTop: 0 }}>Attachments</h2>
              <p style={{ fontSize: 11.5, color: "var(--insp-muted)", marginTop: -6 }}>Vendor quote, vendor invoice, delivery note…</p>
              {attachments.length === 0 && <p style={{ fontSize: 12 }}>None yet.</p>}
              <ul style={{ paddingLeft: 18, fontSize: 12 }}>
                {attachments.map((a) => (
                  <li key={a.id}>
                    <strong>{a.label}</strong> — {a.original_filename}{" "}
                    <button type="button" className="finance-btn finance-btn-outline" style={{ padding: "1px 8px" }} onClick={() => downloadPOAttachment(order.po_no, a).catch(() => setError("Download failed."))}>Download</button>{" "}
                    {canEditPerm && (
                      <button type="button" className="finance-btn finance-btn-danger" style={{ padding: "1px 8px" }}
                        onClick={async () => { await deletePOAttachment(order.po_no, a.id).catch(() => setError("Could not remove it.")); setAttachments((p) => p.filter((x) => x.id !== a.id)); }}>Remove</button>
                    )}
                  </li>
                ))}
              </ul>
              {canEditPerm && (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <select aria-label="Attachment type" value={attLabel} onChange={(e) => setAttLabel(e.target.value)}>
                    {ATTACHMENT_LABELS.map((l) => <option key={l}>{l}</option>)}
                  </select>
                  <input ref={fileRef} type="file" aria-label="Choose attachment file" onChange={(e) => void handleUpload(e.target.files?.[0])} />
                </div>
              )}
            </div>
          )}

          <PurchaseOrderPreview d={preview} />
        </div>
      </div>
    </div>
  );
}
