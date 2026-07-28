import api from "../../../api/axios";
import { ExpenseDoc, FinanceItem, InvoiceDoc, JobCostingRow, QuotationDoc, LineItem, DashboardSummary } from "../types/finance.types";

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
