import { useEffect, useState, useCallback, useRef } from "react";
import { InspectionCertificate, EquipmentTypeKey } from "../types/inspection.types";
import { loadCertificates, persistCertificates } from "../services/inspection.storage";
import { listCertificates, listCertificateNumbers, saveCertificateRemote, deleteCertificateRemote, CertificateConflictError } from "../services/inspection.api";
import { freshCertificate } from "../data/inspectionHelpers";
import { queueSave, queueDelete, flushQueue, pendingCount, pendingCertNos } from "../../../offline/syncQueue";

const PERIODIC_RETRY_MS = 30_000;

/**
 * Certificates sync to a real backend table (backend-fastapi's
 * `certificates`, with issued_by_id -> users.id) instead of living only
 * in localStorage. The local cache is kept too, deliberately — it's what
 * the UI reads from immediately (no loading spinner for every keystroke).
 *
 * Offline handling: a save or delete made while offline is queued in
 * IndexedDB (see ../../../offline/syncQueue.ts) with exponential backoff,
 * and retried automatically on reconnect (the browser's `online` event),
 * on every app load, every 30 seconds while online, and on manual
 * "Retry Now". Note pendingCount/pendingCertNos are now async — the
 * queue moved from localStorage (synchronous) to IndexedDB
 * (asynchronous) to avoid localStorage's ~5-10MB ceiling, which
 * photo-heavy certificates could realistically hit.
 *
 * `certificates` (the display/cache dict) is now permission-filtered —
 * someone without certificates.view_all only ever has their own
 * certificates in it (see list_certificates in the backend). Numbering
 * a *new* certificate can't use that dict for counting anymore — it
 * would only reflect one person's issuance for the day, guaranteeing
 * two technicians collide on the same "next" number. `allCertNos` is
 * fetched separately, unfiltered (see listCertificateNumbers), and used
 * for that instead. If it hasn't loaded yet when someone opens a brand
 * new blank draft, the certificate's `cert_no` field is still just a
 * unique column in the database (see certificates.py) — worst case,
 * a collision is rejected outright as a save error rather than silently
 * creating two certificates that share a number.
 */
export function useInspections(initialType: EquipmentTypeKey = "lifeboat") {
  const [certificates, setCertificates] = useState<Record<string, InspectionCertificate>>({});
  const [allCertNos, setAllCertNos] = useState<Set<string>>(new Set());
  const [current, setCurrent] = useState<InspectionCertificate>(() => freshCertificate(initialType, new Set()));
  const [loaded, setLoaded] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const flushing = useRef(false);

  const attemptFlush = useCallback(async () => {
    if (flushing.current) return; // avoid overlapping flushes from multiple triggers firing close together
    flushing.current = true;
    try {
      const { succeeded, conflicted, failedPermanently, remaining } = await flushQueue();
      // flushQueue() now covers Invoices/Quotations too (see syncQueue.ts)
      // — filter down to certificates here, since this hook only owns
      // certificate state. Their own pending counts are tracked
      // separately (see the Finance pages), but `remaining`/`syncError`
      // below intentionally reflect the *whole* shared queue, not just
      // certificates, so the one number shown in the nav (SyncStatusBadge)
      // always matches what's actually left to sync app-wide.
      const certSucceeded = succeeded.filter((s) => s.resourceType === "certificate");
      const certConflicted = conflicted.filter((c) => c.resourceType === "certificate");
      const certFailed = failedPermanently.filter((f) => f.resourceType === "certificate");
      if (certSucceeded.length > 0) {
        setCertificates((prev) => {
          const next = { ...prev };
          for (const s of certSucceeded) {
            if (s.kind === "save" && s.cert) next[s.resourceId] = s.cert;
            if (s.kind === "delete") delete next[s.resourceId];
          }
          persistCertificates(next);
          return next;
        });
      }
      setPendingSyncCount(remaining);
      if (certConflicted.length > 0) {
        setSyncError(`Couldn't sync ${certConflicted.map((c) => c.resourceId).join(", ")} — changed by someone else while offline. Reopen and re-apply those changes.`);
      } else if (certFailed.length > 0) {
        setSyncError(`Gave up syncing ${certFailed.map((f) => f.resourceId).join(", ")} after repeated failures — check the certificate and try saving it again.`);
      } else {
        setSyncError(remaining > 0 ? `${remaining} item${remaining === 1 ? "" : "s"} waiting to sync — will retry automatically.` : null);
      }
    } finally {
      flushing.current = false;
    }
  }, []);

  useEffect(() => {
    const local = loadCertificates();
    setCertificates(local);
    setCurrent(freshCertificate(initialType, new Set(Object.keys(local))));
    setLoaded(true);
    pendingCount().then(setPendingSyncCount);

    listCertificateNumbers()
      .then((numbers) => setAllCertNos(new Set(numbers)))
      .catch(() => {
        // Couldn't reach the server for the numbering set — fall back to
        // whatever's in the local cache (better than nothing, though it
        // may undercount other people's issuance; the database's unique
        // constraint on cert_no is still the real backstop against an
        // actual collision being persisted).
        setAllCertNos(new Set(Object.keys(local)));
      });

    // Try to flush anything queued from a previous offline session first,
    // then pull the current server list — flushing first means a locally
    // queued edit isn't clobbered by a stale server copy of the same cert.
    attemptFlush().then(() =>
      listCertificates()
        .then(async (remote) => {
          const stillPending = new Set(await pendingCertNos());
          setCertificates((prev) => {
            const merged = { ...prev };
            for (const cert of remote) {
              // Don't let a server copy overwrite a save that's still queued
              // (not yet synced) for the same certificate.
              if (!stillPending.has(cert.certNo)) merged[cert.certNo] = cert;
            }
            persistCertificates(merged);
            return merged;
          });
        })
        .catch(() => {
          setSyncError((prev) => prev || "Could not reach the server — showing certificates saved on this device only.");
        })
    );

    function handleOnline() {
      attemptFlush();
    }
    window.addEventListener("online", handleOnline);

    // Every 30s while online, in case something failed silently (server
    // briefly down, not a browser-detected offline state) rather than
    // relying solely on the `online` event, which only fires on an
    // actual network-state transition.
    const interval = window.setInterval(() => {
      if (navigator.onLine) attemptFlush();
    }, PERIODIC_RETRY_MS);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveCurrent = useCallback(
    (status: "draft" | "final", savedBy: string) => {
      const toSave: InspectionCertificate = { ...current, status, savedAt: new Date().toISOString(), savedBy };

      setCertificates((prev) => {
        const next = { ...prev, [toSave.certNo]: toSave };
        persistCertificates(next);
        return next;
      });
      setAllCertNos((prev) => new Set(prev).add(toSave.certNo));
      setCurrent(toSave);

      saveCertificateRemote(toSave)
        .then((synced) => {
          setCertificates((prev) => {
            const next = { ...prev, [synced.certNo]: synced };
            persistCertificates(next);
            return next;
          });
          setCurrent((prev) => (prev.certNo === synced.certNo ? synced : prev));
          pendingCount().then((n) => setSyncError((prev) => (n > 0 ? prev : null)));
        })
        .catch(async (e) => {
          if (e instanceof CertificateConflictError) {
            // A real conflict, not a connectivity problem — queueing and
            // silently retrying would just hit the same 409 again. Surface
            // it plainly instead; the user needs to reload this
            // certificate and re-apply their changes, not wait.
            setSyncError(e.message);
            return;
          }
          await queueSave(toSave);
          const n = await pendingCount();
          setPendingSyncCount(n);
          setSyncError(`Saved on this device — ${n} certificate${n === 1 ? "" : "s"} waiting to sync, will retry automatically.`);
        });

      return toSave;
    },
    [current]
  );

  const startNew = useCallback(
    (type: EquipmentTypeKey, vesselName = "", imoNo = "", date?: string) => {
      const fresh = freshCertificate(type, allCertNos);
      fresh.vesselName = vesselName;
      fresh.imoNo = imoNo;
      if (date) fresh.dateOfServicing = date;
      setCurrent(fresh);
      return fresh;
    },
    [allCertNos]
  );

  const openCertificate = useCallback((certNo: string) => {
    const found = certificates[certNo];
    if (found) setCurrent(JSON.parse(JSON.stringify(found)));
  }, [certificates]);

  const deleteCertificate = useCallback((certNo: string) => {
    setCertificates((prev) => {
      const next = { ...prev };
      delete next[certNo];
      persistCertificates(next);
      return next;
    });
    deleteCertificateRemote(certNo).catch(async () => {
      await queueDelete(certNo);
      const n = await pendingCount();
      setPendingSyncCount(n);
      setSyncError(`Deleted on this device — ${n} change${n === 1 ? "" : "s"} waiting to sync, will retry automatically.`);
    });
  }, []);

  return {
    certificates,
    current,
    setCurrent,
    loaded,
    syncError,
    pendingSyncCount,
    retrySync: attemptFlush,
    saveCurrent,
    startNew,
    openCertificate,
    deleteCertificate,
  };
}
