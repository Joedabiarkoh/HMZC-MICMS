import { openDB, DBSchema, IDBPDatabase } from "idb";
import { InvoiceDoc, QuotationDoc, FinanceUser } from "../types/finance.types";
import { InvoiceSavePayload, QuotationSavePayload } from "./finance.api";

// Local-first cache for Invoices/Quotations, mirroring the role
// inspection.storage.ts plays for Certificates: written on every save
// attempt (successful or queued-offline via ../../../offline/syncQueue.ts)
// and read by the list pages and each form's load-on-open effect, so a
// save made while offline is visible and reopenable immediately instead
// of only existing in the sync queue until it actually reaches the
// server. Backed by IndexedDB (via `idb`, already a dependency — see
// ../../../offline/indexedDb.ts) rather than localStorage like
// inspection.storage.ts: unlike certificates, every save gets cached
// here indefinitely, not just ones made offline, and indexedDb.ts's own
// comment already flags localStorage's shared ~5-10MB ceiling as a real
// risk worth avoiding for a cache that only grows.
//
// A cached record is a real InvoiceDoc/QuotationDoc with an added
// `_pending` flag (see finance.types.ts) marking it as not yet confirmed
// synced. Reconciliation — replacing a pending entry with the server's
// authoritative copy (real id/version/issued_by) once the queued save
// actually goes through — happens in syncQueue.ts's flushQueue(), which
// calls back into this module directly so it works no matter which
// screen triggered the flush.

interface FinanceCacheDB extends DBSchema {
  invoices: { key: string; value: InvoiceDoc };
  quotations: { key: string; value: QuotationDoc };
}

const DB_NAME = "hmzc_finance_cache";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<FinanceCacheDB>> | null = null;

function getDb(): Promise<IDBPDatabase<FinanceCacheDB>> {
  if (!dbPromise) {
    dbPromise = openDB<FinanceCacheDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("invoices")) {
          db.createObjectStore("invoices", { keyPath: "invoice_no" });
        }
        if (!db.objectStoreNames.contains("quotations")) {
          db.createObjectStore("quotations", { keyPath: "quotation_no" });
        }
      },
    });
  }
  return dbPromise;
}

// ============================================================
// Invoices
// ============================================================

export async function saveInvoiceToCache(doc: InvoiceDoc, pending: boolean): Promise<void> {
  const db = await getDb();
  await db.put("invoices", { ...doc, _pending: pending || undefined });
}

export async function getCachedInvoices(): Promise<InvoiceDoc[]> {
  const db = await getDb();
  return db.getAll("invoices");
}

export async function getCachedInvoice(invoiceNo: string): Promise<InvoiceDoc | undefined> {
  const db = await getDb();
  return db.get("invoices", invoiceNo);
}

// Synthesizes a full InvoiceDoc from a save payload that never reached
// the server, so it has something cacheable. `previous` (the last doc
// this form actually loaded, from the server or the cache) supplies the
// real id/version/issued_by/created_at/quotation_id when this is an
// offline EDIT of an already-known invoice; for a brand-new invoice
// created entirely offline, id is synthesized as a negative,
// timestamp-based number — real server ids are always positive, so this
// can never collide once the row is reconciled by flushQueue().
export function buildPendingInvoiceDoc(payload: InvoiceSavePayload, previous: InvoiceDoc | null, user: FinanceUser | null): InvoiceDoc {
  const now = new Date().toISOString();
  return {
    id: previous?.id ?? -Date.now(),
    invoice_no: payload.invoice_no,
    quotation_id: previous?.quotation_id ?? payload.quotation_id ?? null,
    customer: payload.customer,
    vessel_name: payload.vessel_name,
    imo_no: payload.imo_no,
    status: payload.status as InvoiceDoc["status"],
    line_items: payload.line_items,
    subtotal: payload.subtotal,
    overall_discount_type: payload.overall_discount_type as InvoiceDoc["overall_discount_type"],
    overall_discount_percent: payload.overall_discount_percent,
    overall_discount_amount: payload.overall_discount_amount,
    discount_total: payload.discount_total,
    total: payload.total,
    currency: payload.currency,
    exchange_rate: payload.exchange_rate,
    issued_by: previous?.issued_by ?? user,
    version: previous?.version ?? 0,
    created_at: previous?.created_at ?? now,
    updated_at: now,
  };
}

// ============================================================
// Quotations
// ============================================================

export async function saveQuotationToCache(doc: QuotationDoc, pending: boolean): Promise<void> {
  const db = await getDb();
  await db.put("quotations", { ...doc, _pending: pending || undefined });
}

export async function getCachedQuotations(): Promise<QuotationDoc[]> {
  const db = await getDb();
  return db.getAll("quotations");
}

export async function getCachedQuotation(quotationNo: string): Promise<QuotationDoc | undefined> {
  const db = await getDb();
  return db.get("quotations", quotationNo);
}

// See buildPendingInvoiceDoc's own comment — same reasoning.
export function buildPendingQuotationDoc(payload: QuotationSavePayload, previous: QuotationDoc | null, user: FinanceUser | null): QuotationDoc {
  const now = new Date().toISOString();
  return {
    id: previous?.id ?? -Date.now(),
    quotation_no: payload.quotation_no,
    customer: payload.customer,
    vessel_name: payload.vessel_name,
    imo_no: payload.imo_no,
    status: payload.status as QuotationDoc["status"],
    line_items: payload.line_items,
    subtotal: payload.subtotal,
    overall_discount_type: payload.overall_discount_type as QuotationDoc["overall_discount_type"],
    overall_discount_percent: payload.overall_discount_percent,
    overall_discount_amount: payload.overall_discount_amount,
    discount_total: payload.discount_total,
    total: payload.total,
    currency: payload.currency,
    exchange_rate: payload.exchange_rate,
    conditions: payload.conditions,
    issued_by: previous?.issued_by ?? user,
    version: previous?.version ?? 0,
    created_at: previous?.created_at ?? now,
    updated_at: now,
  };
}
