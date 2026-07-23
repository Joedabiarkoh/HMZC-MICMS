import api from "../../../api/axios";
import { FinanceItem, InvoiceDoc, QuotationDoc, LineItem, DashboardSummary } from "../types/finance.types";

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

// The chat only wrote 3 endpoints (dashboard/quotation/invoice) but the
// pages below (Payments, Expenses, JobCosting, Reports) need data sources
// too. Same REST pattern is extended here so every page actually has a
// real (if backend-pending) call instead of hardcoded data forever.
export async function getPayments() {
  const response = await api.get("/finance/payments");
  return response.data;
}

export async function getExpenses() {
  const response = await api.get("/finance/expenses");
  return response.data;
}

export async function createExpense(data: any) {
  const response = await api.post("/finance/expense", data);
  return response.data;
}

export async function getJobCosting(job: string) {
  const response = await api.get(`/finance/job-costing/${job}`);
  return response.data;
}

export async function getFinancialReport(type: string) {
  const response = await api.get(`/finance/reports/${type}`);
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
