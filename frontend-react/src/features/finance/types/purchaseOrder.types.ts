import { FinanceUser } from "./finance.types";

export type POStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "sent"
  | "received"
  | "closed"
  | "cancelled";

export const PO_STATUS_LABELS: Record<POStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  sent: "Sent to vendor",
  received: "Received",
  closed: "Closed",
  cancelled: "Cancelled",
};

// Currencies a PO can be raised in (mirrors ALLOWED_PO_CURRENCIES server-side).
export const PO_CURRENCIES = ["USD", "EUR", "GBP", "AOA", "GHS", "ZAR"] as const;

export interface POLine {
  finance_item_id?: number | null;
  code: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
}

export interface PurchaseOrder {
  id: number;
  po_no: string;
  status: POStatus;
  revision: number;
  revision_date: string | null;
  order_date: string | null;
  delivery_date: string | null;
  delivery_terms: string | null;
  quote_ref: string | null;
  subject: string | null;
  job_no: string | null;

  vendor_name: string;
  vendor_vat: string | null;
  vendor_phone: string | null;
  vendor_email: string | null;
  vendor_physical_address: string | null;
  vendor_postal_address: string | null;

  delivery_address: string | null;
  delivery_contact_phone: string | null;
  delivery_contact_email: string | null;

  currency: string;
  line_items: POLine[];
  subtotal: number;
  total: number;
  notes: string | null;

  written_by: FinanceUser | null;
  written_by_name: string | null;
  written_by_title: string | null;
  written_by_signature_url: string | null;
  approved_by: FinanceUser | null;
  approved_by_name: string | null;
  approved_by_title: string | null;
  approved_by_signature_url: string | null;
  approved_at: string | null;

  submitted_at: string | null;
  sent_at: string | null;
  received_at: string | null;
  closed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  return_reason: string | null;

  is_overdue: boolean;
  attachment_count: number;
  version: number;
  created_at: string;
  updated_at: string | null;
}

export interface POSavePayload {
  po_no?: string | null;
  version?: number | null;
  order_date?: string | null;
  delivery_date?: string | null;
  delivery_terms?: string | null;
  quote_ref?: string | null;
  subject?: string | null;
  job_no?: string | null;
  vendor_name: string;
  vendor_vat?: string | null;
  vendor_phone?: string | null;
  vendor_email?: string | null;
  vendor_physical_address?: string | null;
  vendor_postal_address?: string | null;
  delivery_address?: string | null;
  delivery_contact_phone?: string | null;
  delivery_contact_email?: string | null;
  currency: string;
  line_items: POLine[];
  subtotal: number;
  total: number;
  notes?: string | null;
  written_by_title?: string | null;
}

export type POAction = "submit" | "return" | "approve" | "send" | "receive" | "close" | "cancel";

export interface POTransitionPayload {
  action: POAction;
  version?: number | null;
  title?: string | null;
  reason?: string | null;
  received_date?: string | null;
}

export interface POAttachment {
  id: number;
  purchase_order_id: number;
  label: string;
  original_filename: string;
  content_type: string | null;
  size_bytes: number;
  uploaded_by: FinanceUser | null;
  created_at: string;
}

export interface POVendor {
  name: string;
  source: "purchase_order" | "supplier_boarding";
  vat: string | null;
  phone: string | null;
  email: string | null;
  physical_address: string | null;
  postal_address: string | null;
  currency: string | null;
}

export function formatPOMoney(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
