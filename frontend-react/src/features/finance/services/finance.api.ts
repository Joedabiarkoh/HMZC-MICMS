import api from "../../../api/axios";
import { ExpenseDoc, FinanceItem, InvoiceAttachment, InvoiceDoc, JobCostingRow, QuotationDoc, LineItem, DashboardSummary } from "../types/finance.types";

// Matches CertificateConflictError in inspection.api.ts — same reasoning:
// a 409 here means someone else saved a newer edit in between (see
// _check_version in backend-fastapi's api/routes/finance.py), which is a
// real conflict, not a connectivity problem. Queueing and silently
// retrying it would just hit the same 409 again — see how
// offlineQueue.ts (frontend/src/offline/) treats this class distinctly
// from a network failure.
export class DocumentConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentConflictError";
  }
}

export async function getFinanceSummary(): Promise<DashboardSummary> {
  const response = await api.get<DashboardSummary>("/finance/dashboard");
  return response.data;
}

// getPayments() and getFinancialReport() used to live here, calling
// GET /finance/payments and GET /finance/reports/{type} — neither ever
// existed server-side. Removed: Payments.tsx now reuses listInvoices()/
// saveInvoice() below instead, and the real Reports & Analytics page
// (features/reports/) has its own separate, working API module that
// never called this one.

// ============================================================
// Expenses — backend-fastapi's /api/finance/expenses (see
// api/routes/finance.py). A simple company-wide ledger; vessel_name is
// optional (see ExpenseDoc's own comment) and only needed if this
// expense should count toward Job Costing below.
// ============================================================

export async function listExpenses(): Promise<ExpenseDoc[]> {
  const response = await api.get<ExpenseDoc[]>("/finance/expenses");
  return response.data;
}

export interface ExpenseCreatePayload {
  category: string;
  amount: number;
  expense_date: string;
  note?: string | null;
  vessel_name?: string | null;
}

export async function createExpense(payload: ExpenseCreatePayload): Promise<ExpenseDoc> {
  const response = await api.post<ExpenseDoc>("/finance/expenses", payload);
  return response.data;
}

export async function deleteExpense(expenseId: number): Promise<void> {
  await api.delete(`/finance/expenses/${expenseId}`);
}

// ============================================================
// Job Costing — profit per vessel, computed server-side from paid
// invoices and vessel-tagged expenses (see JobCostingRow's own comment
// on why this is loose, all-time matching by vessel name).
// ============================================================

export async function getJobCosting(): Promise<JobCostingRow[]> {
  const response = await api.get<JobCostingRow[]>("/finance/job-costing");
  return response.data;
}

// ============================================================
// Item catalog — backend-fastapi's /api/finance/items, added for the
// catalog-driven invoice/quotation feature. Write access is admin-only
// server-side (see get_current_admin_user in the route); read access is
// any Finance/Admin user, since they need to search it while building a
// document.
// ============================================================

export async function listFinanceItems(includeInactive = false): Promise<FinanceItem[]> {
  const response = await api.get<FinanceItem[]>("/finance/items", { params: { include_inactive: includeInactive } });
  return response.data;
}

export async function createFinanceItem(item: Omit<FinanceItem, "id" | "created_at">): Promise<FinanceItem> {
  const response = await api.post<FinanceItem>("/finance/items", item);
  return response.data;
}

export async function updateFinanceItem(id: number, changes: Partial<FinanceItem>): Promise<FinanceItem> {
  const response = await api.patch<FinanceItem>(`/finance/items/${id}`, changes);
  return response.data;
}

// ============================================================
// Quotations
// ============================================================

export async function listQuotations(): Promise<QuotationDoc[]> {
  const response = await api.get<QuotationDoc[]>("/finance/quotations");
  return response.data;
}

export interface QuotationSavePayload {
  quotation_no: string;
  customer: string;
  vessel_name: string | null;
  imo_no: string | null;
  status: string;
  line_items: LineItem[];
  subtotal: number;
  discount_total: number;
  total: number;
  version?: number | null;
}

export async function saveQuotation(payload: QuotationSavePayload): Promise<QuotationDoc> {
  try {
    const response = await api.post<QuotationDoc>("/finance/quotations", payload);
    return response.data;
  } catch (e: any) {
    if (e?.response?.status === 409) {
      throw new DocumentConflictError(e.response.data?.detail || "This quotation was changed by someone else. Reload it and re-apply your changes.");
    }
    throw e;
  }
}

export async function deleteQuotation(quotationNo: string): Promise<void> {
  await api.delete(`/finance/quotations/${encodeURIComponent(quotationNo)}`);
}

// ============================================================
// Invoices
// ============================================================

export async function listInvoices(): Promise<InvoiceDoc[]> {
  const response = await api.get<InvoiceDoc[]>("/finance/invoices");
  return response.data;
}

export interface InvoiceSavePayload {
  invoice_no: string;
  quotation_id?: number | null;
  customer: string;
  vessel_name: string | null;
  imo_no: string | null;
  status: string;
  line_items: LineItem[];
  subtotal: number;
  discount_total: number;
  total: number;
  version?: number | null;
}

export async function saveInvoice(payload: InvoiceSavePayload): Promise<InvoiceDoc> {
  try {
    const response = await api.post<InvoiceDoc>("/finance/invoices", payload);
    return response.data;
  } catch (e: any) {
    if (e?.response?.status === 409) {
      throw new DocumentConflictError(e.response.data?.detail || "This invoice was changed by someone else. Reload it and re-apply your changes.");
    }
    throw e;
  }
}

export async function deleteInvoice(invoiceNo: string): Promise<void> {
  await api.delete(`/finance/invoices/${encodeURIComponent(invoiceNo)}`);
}

// ============================================================
// Invoice supporting documents — service report, PO, delivery note, or
// any other additional document, uploaded and saved against an
// invoice, downloadable together as one zip bundle (see
// api/routes/finance.py's download-all-zip endpoint; there's no
// server-side PDF or in-app email for invoices to bundle "the invoice
// itself" into, so this bundles the supporting documents only).
// ============================================================

export async function listInvoiceAttachments(invoiceNo: string): Promise<InvoiceAttachment[]> {
  const response = await api.get<InvoiceAttachment[]>(`/finance/invoices/${encodeURIComponent(invoiceNo)}/attachments`);
  return response.data;
}

export async function uploadInvoiceAttachment(invoiceNo: string, file: File, label: string): Promise<InvoiceAttachment> {
  const form = new FormData();
  form.append("file", file);
  form.append("label", label);
  const response = await api.post<InvoiceAttachment>(
    `/finance/invoices/${encodeURIComponent(invoiceNo)}/attachments`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return response.data;
}

export async function deleteInvoiceAttachment(invoiceNo: string, attachmentId: number): Promise<void> {
  await api.delete(`/finance/invoices/${encodeURIComponent(invoiceNo)}/attachments/${attachmentId}`);
}

// Blob downloads go through axios (not a plain <a href>) so the Bearer
// token from the request interceptor (src/api/axios.ts) actually gets
// attached — these endpoints require finance.view, so an unauthenticated
// direct link wouldn't work anyway.
async function downloadBlob(url: string, filename: string): Promise<void> {
  const response = await api.get(url, { responseType: "blob" });
  const blobUrl = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}

export async function downloadInvoiceAttachment(invoiceNo: string, attachment: InvoiceAttachment): Promise<void> {
  await downloadBlob(
    `/finance/invoices/${encodeURIComponent(invoiceNo)}/attachments/${attachment.id}/download`,
    attachment.original_filename
  );
}

export async function downloadAllInvoiceAttachments(invoiceNo: string): Promise<void> {
  await downloadBlob(
    `/finance/invoices/${encodeURIComponent(invoiceNo)}/attachments/download-all`,
    `${invoiceNo.replace(/\//g, "_")}_attachments.zip`
  );
}

// ============================================================
// PDF — "serve all the invoice and the added documents as pdf all
// together in one document." Server-rendered (reportlab), not the
// browser's own print-to-PDF, so it can actually merge in every
// uploaded supporting document (see core/invoice_pdf.py). Quotations
// get the same document-only PDF (no attachments — quotations don't
// have any) for parity with the invoice's plain "PDF" download.
// ============================================================

export async function downloadInvoicePdf(invoiceNo: string, withAttachments = true): Promise<void> {
  const safeNo = invoiceNo.replace(/\//g, "_");
  await downloadBlob(
    `/finance/invoices/${encodeURIComponent(invoiceNo)}/pdf?with_attachments=${withAttachments}`,
    `${safeNo}.pdf`
  );
}

export async function downloadQuotationPdf(quotationNo: string): Promise<void> {
  const safeNo = quotationNo.replace(/\//g, "_");
  await downloadBlob(`/finance/quotations/${encodeURIComponent(quotationNo)}/pdf`, `${safeNo}.pdf`);
}
