import { useEffect, useState, useCallback, useRef } from "react";
import { InspectionCertificate, EquipmentTypeKey } from "../types/inspection.types";
import { loadCertificates, persistCertificates } from "../services/inspection.storage";
import { listCertificates, listCertificateNumbers, saveCertificateRemote, deleteCertificateRemote, CertificateConflictError } from "../services/inspection.api";
import { freshCertificate } from "../data/inspectionHelpers";
import { queueSave, queueDelete, flushQueue, pendingCount, pendingCertNos } from "../../../offline/syncQueue";
import { useAuth } from "../../../context/AuthContext";

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
  const { user } = useAuth();
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
      const { succeeded, conflicted, failedPermanently, remaining, blockedForOtherUser } = await flushQueue();
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
      } else if (blockedForOtherUser > 0) {
        // Deliberately does NOT say "will retry automatically" — retrying
        // won't help until the account that queued these signs back in on
        // this device, and that message previously made it look like a
        // transient network issue.
        setSyncError(`${blockedForOtherUser} item${blockedForOtherUser === 1 ? "" : "s"} saved offline under a different account on this device — sign in as that user here to sync them.`);
      } else {
        setSyncError(remaining > 0 ? `${remaining} item${remaining === 1 ? "" : "s"} waiting to sync — will retry automatically.` : null);
      }
    } finally {
      flushing.current = false;
    }
  }, []);

  // Root-caused directly from a real report: "When certificate are
  // deleted it shows still on some users['] page." This used to only
  // ever ADD/UPDATE local entries from a server fetch (`merged[cert.
  // certNo] = cert` for each row `listCertificates()` returned) — a
  // certificate someone else deleted just stayed in this device's own
  // cache forever, since nothing ever removed a local entry that the
  // server no longer had. It also only ran once, at page load — so
  // even fixing the removal alone wouldn't help anyone who'd had the
  // page open before the deletion happened. Pulled into its own
  // function so it can run periodically and on tab focus, not just at
  // mount, and now actually prunes local certificates the server
  // doesn't have anymore.
  const refreshCertificates = useCallback(() => {
    return listCertificates()
      .then(async (remote) => {
        const stillPending = new Set(await pendingCertNos());
        const remoteCertNos = new Set(remote.map((c) => c.certNo));
        setCertificates((prev) => {
          const merged: Record<string, InspectionCertificate> = {};
          for (const cert of remote) {
            // Don't let a server copy overwrite a save that's still queued
            // (not yet synced) for the same certificate.
            merged[cert.certNo] = stillPending.has(cert.certNo) ? prev[cert.certNo] || cert : cert;
          }
          // A local certificate the server no longer has, and that isn't
          // itself a not-yet-synced local save (a brand new draft, or an
          // edit still queued from an offline session) — deleted by
          // someone else, or since removed from view by a permission
          // change. Either way, this device shouldn't keep showing it.
          for (const [certNo, cert] of Object.entries(prev)) {
            if (!remoteCertNos.has(certNo) && stillPending.has(certNo)) merged[certNo] = cert;
          }
          persistCertificates(merged);
          return merged;
        });
        setSyncError((prev) => (prev?.startsWith("Could not reach the server") ? null : prev));
      })
      .catch(() => {
        setSyncError((prev) => prev || "Could not reach the server — showing certificates saved on this device only.");
      });
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
    attemptFlush().then(() => refreshCertificates());

    function handleOnline() {
      attemptFlush();
      refreshCertificates();
    }
    window.addEventListener("online", handleOnline);

    // Requested directly, alongside the deletion-visibility fix above:
    // switching back to a tab that's been open a while is the moment
    // someone's most likely to notice it's showing something stale, so
    // this is the fast path — no need to wait for the next periodic
    // tick.
    function handleVisibility() {
      if (document.visibilityState === "visible" && navigator.onLine) {
        attemptFlush();
        refreshCertificates();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);

    // Every 30s while online: flushes anything queued, AND re-pulls the
    // server list so a deletion (or any other edit) made by someone
    // else shows up here without needing a full page reload.
    const interval = window.setInterval(() => {
      if (navigator.onLine) {
        attemptFlush();
        refreshCertificates();
      }
    }, PERIODIC_RETRY_MS);

    return () => {
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Requested directly: "so they will not need to sign one after the
  // other." A blank, never-yet-saved draft gets the signed-in user's
  // saved default signature filled in automatically as soon as it's
  // known. This is separate from the freshCertificate() calls below on
  // purpose — AuthContext's cached user can still be loading when this
  // hook's own mount effect below runs (both are effects racing on the
  // same commit), so a one-time fill at creation time can miss it; this
  // re-checks whenever `user` itself changes instead. Guarded by
  // `!prev.savedAt` so it only ever touches a genuinely fresh draft, not
  // an existing certificate someone opened that happens to have no
  // signature yet — that should stay exactly as blank as they left it.
  //
  // Root-caused directly from a real report: "my signature seems to
  // appear on other users['] signatures, overs[e]eding" — this used to
  // fill in whoever was CURRENTLY LOGGED IN's saved signature
  // regardless of what name was actually typed into "Service Engineer /
  // Technician Name," so one login used to enter a certificate on
  // behalf of a different named person (a shared device, someone
  // assisting with data entry) silently attached the logged-in
  // account's own signature to a certificate naming someone else —
  // confirmed against real production data. Now only auto-fills when
  // the typed name is blank or actually matches the logged-in account;
  // if the name is later changed to someone else, the auto-filled
  // signature is cleared rather than left misrepresenting who signed.
  // Only ever clears a signature that's an EXACT match for the logged-in
  // user's own saved default — a signature someone deliberately drew or
  // uploaded for this specific certificate (anything else) is never
  // touched here, regardless of what the name field says.
  useEffect(() => {
    if (!user) return;
    const myName = (user.full_name || user.email || "").trim().toLowerCase();
    setCurrent((prev) => {
      if (prev.status !== "draft" || prev.savedAt) return prev;
      const typedName = (prev.engineerName || "").trim().toLowerCase();
      const nameMatchesMe = !typedName || typedName === myName;
      if (nameMatchesMe) {
        if (!prev.engineerSig && user.saved_signature_url) {
          return { ...prev, engineerSig: user.saved_signature_url };
        }
        return prev;
      }
      if (prev.engineerSig && prev.engineerSig === user.saved_signature_url) {
        return { ...prev, engineerSig: "" };
      }
      return prev;
    });
  }, [user, current.engineerName]);

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

  // Requested directly: "create individual thorough report based on
  // multiple items filled for the subject... after they are generated,
  // technician can check each one and edit if the need be before
  // printing them" — bulk-generates several NEW draft certificates
  // (see InspectionWorkspace.tsx's handleGenerateStandardReports) while
  // the technician stays on the Multiple Items page they're generating
  // FROM; `current` must keep pointing at that page, not jump to
  // whichever generated draft was created last, which is why this is a
  // separate function from saveCurrent above rather than a loop calling
  // setCurrent + saveCurrent per generated report.
  const saveOther = useCallback((cert: InspectionCertificate) => {
    const toSave: InspectionCertificate = { ...cert, status: "draft", savedAt: new Date().toISOString() };
    setCertificates((prev) => {
      const next = { ...prev, [toSave.certNo]: toSave };
      persistCertificates(next);
      return next;
    });
    setAllCertNos((prev) => new Set(prev).add(toSave.certNo));

    saveCertificateRemote(toSave)
      .then((synced) => {
        setCertificates((prev) => {
          const next = { ...prev, [synced.certNo]: synced };
          persistCertificates(next);
          return next;
        });
        pendingCount().then((n) => setSyncError((prev) => (n > 0 ? prev : null)));
      })
      .catch(async (e) => {
        if (e instanceof CertificateConflictError) {
          setSyncError(e.message);
          return;
        }
        await queueSave(toSave);
        const n = await pendingCount();
        setPendingSyncCount(n);
        setSyncError(`Saved on this device — ${n} certificate${n === 1 ? "" : "s"} waiting to sync, will retry automatically.`);
      });

    return toSave;
  }, []);

  const startNew = useCallback(
    (type: EquipmentTypeKey, vesselName = "", imoNo = "", date?: string) => {
      const fresh = freshCertificate(type, allCertNos);
      fresh.vesselName = vesselName;
      fresh.imoNo = imoNo;
      if (date) fresh.dateOfServicing = date;
      if (user?.saved_signature_url) fresh.engineerSig = user.saved_signature_url;
      setCurrent(fresh);
      return fresh;
    },
    [allCertNos, user]
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
    saveOther,
    startNew,
    openCertificate,
    deleteCertificate,
  };
}
