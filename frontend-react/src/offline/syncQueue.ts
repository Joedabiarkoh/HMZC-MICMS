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

// Root-caused from a real report: on a shared device, a save queued
// offline by one technician was being silently replayed under whoever
// happened to be logged in when the periodic flush next fired — the
// queue had no idea it was ever tied to a particular person. Every op
// is now tagged with the id of whoever queued it (read straight off the
// JWT already in localStorage — no need for AuthContext, which this
// module has no access to and shouldn't need to import) so flushQueue()
// can refuse to replay an item under the wrong account. Decodes the
// token's own claims rather than trusting anything else, since the
// token IS the credential every queued request will actually be sent
// with.
function getCurrentUserId(): string | null {
  try {
    const token = localStorage.getItem("hmzc_token");
    if (!token) return null;
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
    const claims = JSON.parse(json);
    return claims?.sub != null ? String(claims.sub) : null;
  } catch {
    return null;
  }
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
    queuedByUserId: getCurrentUserId() || undefined,
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
    queuedByUserId: getCurrentUserId() || undefined,
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
    queuedByUserId: getCurrentUserId() || undefined,
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
    queuedByUserId: getCurrentUserId() || undefined,
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
  // Items left untouched this flush because they were queued by a
  // DIFFERENT account than the one currently signed in on this device —
  // see queuedByUserId's comment above. They stay queued (nothing is
  // lost) and will sync automatically once that original account signs
  // back in here, but must never be replayed under the current session.
  blockedForOtherUser: number;
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
  const currentUserId = getCurrentUserId();
  // An op with no queuedByUserId at all is a legacy/migrated entry from
  // before this field existed — allowed through rather than getting
  // permanently stuck, since there's no account to defer to. An op
  // that DOES carry a queuedByUserId is only eligible when it matches
  // whoever is signed in right now.
  const dueForCurrentUser = all.filter(
    (op) => new Date(op.nextAttemptAt).getTime() <= now && (!op.queuedByUserId || op.queuedByUserId === currentUserId)
  );
  const blockedForOtherUser = all.filter(
    (op) => new Date(op.nextAttemptAt).getTime() <= now && op.queuedByUserId && op.queuedByUserId !== currentUserId
  ).length;

  const succeeded: FlushResult["succeeded"] = [];
  const conflicted: FlushResult["conflicted"] = [];
  const failedPermanently: FlushResult["failedPermanently"] = [];

  for (const op of dueForCurrentUser) {
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

  return { succeeded, conflicted, failedPermanently, remaining: (await getAllOps()).length, blockedForOtherUser };
}
