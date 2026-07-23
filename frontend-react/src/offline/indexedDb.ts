import { openDB, DBSchema, IDBPDatabase } from "idb";
import { InspectionCertificate } from "../features/inspections/types/inspection.types";
import { InvoiceSavePayload, QuotationSavePayload } from "../features/finance/services/finance.api";

// Replaces localStorage as the offline queue's storage backend.
// localStorage has a hard ~5-10MB ceiling shared across the whole
// origin — certificates carry base64 photos and signatures, so a
// handful of queued offline inspections could plausibly hit that
// ceiling and start silently failing to save. IndexedDB doesn't have
// that practical limit and doesn't block the main thread on reads/
// writes.
//
// Originally certificate-only. Extended to cover Invoice/Quotation
// saves too — those had *no* offline handling at all (a failed save
// just showed a generic error and the work was lost), which was the
// actual gap in "offline sync" as a whole-app feature, not a missing
// generic dispatcher endpoint. One shared queue (not a second, parallel
// one for Finance) so there's a single "N pending sync" count and a
// single retry/backoff mechanism for the whole app, not two the user
// has to think about separately. Each resource type still calls its
// own real, typed backend endpoint when it flushes (see syncQueue.ts) —
// this only generalizes *storage*, not into a generic "replay any HTTP
// call" queue, which is the same reasoning the root README gives for
// not building a generic /api/sync/push endpoint on the backend.
export type QueueOp =
  | { id: string; resourceType: "certificate"; kind: "save"; resourceId: string; cert: InspectionCertificate; queuedAt: string; attempts: number; nextAttemptAt: string }
  | { id: string; resourceType: "certificate"; kind: "delete"; resourceId: string; queuedAt: string; attempts: number; nextAttemptAt: string }
  | { id: string; resourceType: "invoice"; kind: "save"; resourceId: string; payload: InvoiceSavePayload; queuedAt: string; attempts: number; nextAttemptAt: string }
  | { id: string; resourceType: "quotation"; kind: "save"; resourceId: string; payload: QuotationSavePayload; queuedAt: string; attempts: number; nextAttemptAt: string };

interface HmzcOfflineDB extends DBSchema {
  syncQueue: {
    key: string;
    value: QueueOp;
  };
}

const DB_NAME = "hmzc_offline_db";
const DB_VERSION = 1;
const STORE = "syncQueue";

let dbPromise: Promise<IDBPDatabase<HmzcOfflineDB>> | null = null;

function getDb(): Promise<IDBPDatabase<HmzcOfflineDB>> {
  if (!dbPromise) {
    dbPromise = openDB<HmzcOfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

export async function putOp(op: QueueOp): Promise<void> {
  const db = await getDb();
  await db.put(STORE, op);
}

export async function getAllOps(): Promise<QueueOp[]> {
  const db = await getDb();
  return db.getAll(STORE);
}

export async function deleteOp(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, id);
}

// One-time migration from the previous localStorage-backed queue, so
// anyone with certificates already queued offline from before this
// change doesn't lose them. Safe to run every load — it clears the old
// key once done, so it's a no-op after the first successful run.
// Legacy entries had no resourceType (certificates only, back then) —
// backfilled here so they match the current shape.
const LEGACY_KEY = "hmzc-offline-sync-queue";
export async function migrateLegacyQueue(): Promise<void> {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    const legacy = JSON.parse(raw) as any[];
    const db = await getDb();
    for (const item of legacy) {
      await db.put(STORE, { ...item, resourceType: item.resourceType || "certificate", resourceId: item.resourceId || item.certNo, attempts: 0, nextAttemptAt: new Date().toISOString() });
    }
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // Nothing usable to migrate — fine, just start fresh.
  }
}
