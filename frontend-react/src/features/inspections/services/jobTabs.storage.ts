import { EquipmentTypeKey } from "../types/inspection.types";

// Job Tabs let a technician keep several Jobs open at once instead of
// having to force-close one to start another (requested directly: "when
// you open one job number, you can also open another job number and
// work on without closing the other... issue all certificate within
// that job without needing to switch back and forth"). A tab tracks
// enough to resume where you left off — the certNo it points at is kept
// in sync with whichever certificate is currently active for that job
// (see InspectionWorkspace.tsx) and is looked up in the existing
// `certificates` cache to resume, rather than this file storing any
// certificate content itself.
//
// Session-local only — closing a tab here never touches the Job on the
// server (see closeJob in jobs.api.ts for that, a separate, permissioned
// action). Persisted to localStorage purely so a page refresh doesn't
// silently lose track of what was open.
export interface JobTab {
  jobNo: string;
  vesselName: string;
  imoNo: string;
  type: EquipmentTypeKey;
  certNo: string;
}

const STORE_KEY = "hmzc-micms-job-tabs";

export function loadJobTabs(): JobTab[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function persistJobTabs(tabs: JobTab[]): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(tabs));
  } catch {
    // Storage may be unavailable (private browsing, quota) — same
    // non-fatal failure mode as inspection.storage.ts's persistCertificates.
  }
}
