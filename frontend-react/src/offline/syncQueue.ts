import { InspectionCertificate } from "../features/inspections/types/inspection.types";
import { saveCertificateRemote, deleteCertificateRemote, CertificateConflictError } from "../features/inspections/services/inspection.api";
import { saveInvoice, saveQuotation, DocumentConflictError, InvoiceSavePayload, QuotationSavePayload } from "../features/finance/services/finance.api";
import { InvoiceDoc, QuotationDoc } from "../features/finance/types/finance.types";
import { putOp, getAllOps, deleteOp, migrateLegacyQueue, QueueOp } from "./indexedDb";

// Backed by IndexedDB (see indexedDb.ts) with exponential backoff: each
// queued item tracks its own attempt count and next-eligible-retry
// time, so a struggling or still-unreachable server gets retried with
// increasing delays (5s, 15s, 30s, 60s, 120s, then every 120s) instead
// of every trigger (app load, online event, 30s poll) hammering it
// immediately. After 10 failed attempts an item stops retrying
// automatically and is surfaced as permanently failed instead.
//
// Originally certificate-only, extended to also queue Invoice/Quotation
// saves — see indexedDb.ts's comment for why this is one shared queue
// rather than a second parallel one for Finance.

const BACKOFF_SCHEDULE_MS = [5_000, 15_000, 30_000, 60_000, 120_000];
const MAX_ATTEMPTS = 10;

function nextAttemptDelay(attempts: number): number {
  return BACKOFF_SCHEDULE_MS[Math.min(attempts, BACKOFF_SCHEDULE_MS.length - 1)];
}

let migrated: Promise<void> | null = null;
function ensureMigrated(): Promise<void> {
  if (!migrated) migrated = migrateLegacyQueue();
  return migrated;
}

// ============================================================
// Certificates
// ============================================================

export async function queueSave(cert: InspectionCertificate): Promise<void> {
  await ensureMigrated();
  const all = await getAllOps();
  // Only the latest version of a save needs to sync — drop any earlier
  // still-pending save for the same resource rather than replaying
  // stale edits in order.
  await Promise.all(all.filter((op) => op.resourceType === "certificate" && op.kind === "save" && op.resourceId === cert.certNo).map((op) => deleteOp(op.id)));
  await putOp({
    id: `certificate-${cert.certNo}-${Date.now()}`,
    resourceType: "certificate",
    kind: "save",
    resourceId: cert.certNo,
    cert,
    queuedAt: new Date().toISOString(),
    attempts: 0,
    nextAttemptAt: new Date().toISOString(),
  });
}

export async function queueDelete(certNo: string): Promise<void> {
  await ensureMigrated();
  const all = await getAllOps();
  await Promise.all(all.filter((op) => op.resourceType === "certificate" && op.resourceId === certNo).map((op) => deleteOp(op.id)));
  await putOp({
    id: `certificate-${certNo}-${Date.now()}`,
    resourceType: "certificate",
    kind: "delete",
    resourceId: certNo,
    queuedAt: new Date().toISOString(),
    attempts: 0,
    nextAttemptAt: new Date().toISOString(),
  });
}

export async function pendingCertNos(): Promise<string[]> {
  await ensureMigrated();
  return (await getAllOps()).filter((op) => op.resourceType === "certificate").map((op) => op.resourceId);
}

// ============================================================
// Finance — invoices and quotations. Deletes aren't queued offline for
// these (admin-only, not the "technician losing signal mid-task"
// scenario this queue exists for) — only saves.
// ============================================================

export async function queueInvoiceSave(payload: InvoiceSavePayload): Promise<void> {
  await ensureMigrated();
  const all = await getAllOps();
  await Promise.all(all.filter((op) => op.resourceType === "invoice" && op.resourceId === payload.invoice_no).map((op) => deleteOp(op.id)));
  await putOp({
    id: `invoice-${payload.invoice_no}-${Date.now()}`,
    resourceType: "invoice",
    kind: "save",
    resourceId: payload.invoice_no,
    payload,
    queuedAt: new Date().toISOString(),
    attempts: 0,
    nextAttemptAt: new Date().toISOString(),
  });
}

export async function queueQuotationSave(payload: QuotationSavePayload): Promise<void> {
  await ensureMigrated();
  const all = await getAllOps();
  await Promise.all(all.filter((op) => op.resourceType === "quotation" && op.resourceId === payload.quotation_no).map((op) => deleteOp(op.id)));
  await putOp({
    id: `quotation-${payload.quotation_no}-${Date.now()}`,
    resourceType: "quotation",
    kind: "save",
    resourceId: payload.quotation_no,
    payload,
    queuedAt: new Date().toISOString(),
    attempts: 0,
    nextAttemptAt: new Date().toISOString(),
  });
}

export async function pendingDocNos(resourceType: "invoice" | "quotation"): Promise<string[]> {
  await ensureMigrated();
  return (await getAllOps()).filter((op) => op.resourceType === resourceType).map((op) => op.resourceId);
}

// ============================================================
// Shared
// ============================================================

export async function pendingCount(): Promise<number> {
  await ensureMigrated();
  return (await getAllOps()).length;
}

export interface FlushResult {
  succeeded: {
    resourceType: QueueOp["resourceType"];
    resourceId: string;
    kind: "save" | "delete";
    cert?: InspectionCertificate;
    invoice?: InvoiceDoc;
    quotation?: QuotationDoc;
  }[];
  conflicted: { resourceType: QueueOp["resourceType"]; resourceId: string; message: string }[];
  failedPermanently: { resourceType: QueueOp["resourceType"]; resourceId: string; kind: string }[];
  remaining: number;
}

/**
 * Attempts every queued operation that's currently eligible for retry
 * (i.e. its backoff delay has elapsed), in the order queued, dispatching
 * to the real typed endpoint for whatever resourceType each op is —
 * certificates, invoices, and quotations each still go through their
 * own actual API call (saveCertificateRemote / saveInvoice /
 * saveQuotation), not a generic replay. Items not yet eligible are left
 * alone — calling this on a timer is cheap and safe to do often; it
 * won't cause extra requests for items still in backoff.
 */
export async function flushQueue(): Promise<FlushResult> {
  await ensureMigrated();
  const all = await getAllOps();
  const now = Date.now();
  const due = all.filter((op) => new Date(op.nextAttemptAt).getTime() <= now);

  const succeeded: FlushResult["succeeded"] = [];
  const conflicted: FlushResult["conflicted"] = [];
  const failedPermanently: FlushResult["failedPermanently"] = [];

  for (const op of due) {
    try {
      if (op.resourceType === "certificate" && op.kind === "save") {
        const synced = await saveCertificateRemote(op.cert);
        succeeded.push({ resourceType: "certificate", resourceId: op.resourceId, kind: "save", cert: synced });
      } else if (op.resourceType === "certificate" && op.kind === "delete") {
        await deleteCertificateRemote(op.resourceId);
        succeeded.push({ resourceType: "certificate", resourceId: op.resourceId, kind: "delete" });
      } else if (op.resourceType === "invoice") {
        const synced = await saveInvoice(op.payload);
        succeeded.push({ resourceType: "invoice", resourceId: op.resourceId, kind: "save", invoice: synced });
      } else if (op.resourceType === "quotation") {
        const synced = await saveQuotation(op.payload);
        succeeded.push({ resourceType: "quotation", resourceId: op.resourceId, kind: "save", quotation: synced });
      }
      await deleteOp(op.id);
    } catch (e) {
      if (e instanceof CertificateConflictError || e instanceof DocumentConflictError) {
        // Retrying forever won't fix a real conflict — drop it rather
        // than let it retry indefinitely, and report it so the caller
        // can tell the user their offline edit couldn't be applied.
        conflicted.push({ resourceType: op.resourceType, resourceId: op.resourceId, message: e.message });
        await deleteOp(op.id);
        continue;
      }

      const attempts = op.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        failedPermanently.push({ resourceType: op.resourceType, resourceId: op.resourceId, kind: op.kind });
        await deleteOp(op.id);
        continue;
      }

      const updated: QueueOp = {
        ...op,
        attempts,
        nextAttemptAt: new Date(now + nextAttemptDelay(attempts)).toISOString(),
      } as QueueOp;
      await putOp(updated);
    }
  }

  return { succeeded, conflicted, failedPermanently, remaining: (await getAllOps()).length };
}
