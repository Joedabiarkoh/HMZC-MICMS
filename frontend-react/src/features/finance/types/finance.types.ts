export interface Invoice {
  id: number;
  invoice_number: string;
  customer: string;
  vessel: string;
  amount: number;
  currency: string;
  status: string;
  due_date: string;
}

export interface Quotation {
  id: number;
  quotation_number: string;
  customer: string;
  service: string;
  amount: number;
  status: string;
}

// Not in the original chat's type file, but needed by the Expenses and
// JobCosting pages below, which reference this shape.
export interface Expense {
  id: number;
  job: string;
  category: string;
  amount: number;
}

export interface JobCost {
  job: string;
  revenue: number;
  labour: number;
  parts: number;
  travel: number;
  total_cost: number;
  profit: number;
}

// ============================================================
// Added for the item-catalog-driven invoice/quotation feature.
// The catalog ("items provided with the cost... a list with an
// associated id or code") is admin-managed backend data, never shown as
// a public services list — only pulled from when someone building an
// invoice or quotation searches/selects a line item. See
// backend-fastapi/app/models/finance_item.py.
// ============================================================

export interface FinanceItem {
  id: number;
  code: string;
  name: string;
  description: string | null;
  unit: string | null;
  unit_price: number;
  category: string | null;
  is_active: boolean;
  created_at: string;
}

export interface LineItem {
  finance_item_id: number | null;
  code: string;
  description: string;
  quantity: number;
  unit_price: number; // may differ from the catalog price — the issuer can override it
  discount_percent: number; // 0-100, per-line discount
  line_total: number; // quantity * unit_price * (1 - discount_percent/100)
}

export interface FinanceUser {
  id: number;
  email: string;
  full_name: string | null;
  role: string;
}

export interface QuotationDoc {
  id: number;
  quotation_no: string;
  customer: string;
  vessel_name: string | null;
  imo_no: string | null;
  status: "draft" | "sent" | "accepted" | "rejected";
  line_items: LineItem[];
  subtotal: number;
  discount_total: number;
  total: number;
  issued_by: FinanceUser | null;
  version: number;
  created_at: string;
  updated_at: string | null;
}

export interface InvoiceDoc {
  id: number;
  invoice_no: string;
  quotation_id: number | null;
  customer: string;
  vessel_name: string | null;
  imo_no: string | null;
  status: "draft" | "issued" | "paid" | "void";
  line_items: LineItem[];
  subtotal: number;
  discount_total: number;
  total: number;
  issued_by: FinanceUser | null;
  version: number;
  created_at: string;
  updated_at: string | null;
}

// Matches backend-fastapi's DashboardSummary schema — was previously
// untyped (useFinance.ts's summary was `any`) because GET /finance/dashboard
// didn't exist server-side at all, so there was nothing real to type
// against. profit_margin is nullable on purpose: no expense/cost data is
// tracked yet, so it's genuinely unknown rather than 0%.
export interface MonthlyRevenuePoint {
  month: string;
  revenue: number;
  cost: number;
}

export interface RecentTransaction {
  id: string;
  description: string;
  amount: number;
}

export interface DashboardSummary {
  revenue: number;
  outstanding: number;
  pending_quotations: number;
  profit_margin: number | null;
  monthly: MonthlyRevenuePoint[];
  recent_transactions: RecentTransaction[];
}
