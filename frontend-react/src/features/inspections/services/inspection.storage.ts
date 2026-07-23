import { InspectionCertificate } from "../types/inspection.types";

// The previous standalone tool (hmzc_certificate_system_v3.html) stored
// certificates in the browser's localStorage because there was no
// backend at all. That's still true here — inspection.api.ts defines
// the real REST calls for when Module "Certificates" gets a backend,
// but until then this local store is what actually persists data, same
// as it did in the previous system. Swap callers over to inspection.api
// once backend-fastapi/app/api/routes/inspections.py exists.

const STORE_KEY = "hmzc-micms-inspection-certificates";

export function loadCertificates(): Record<string, InspectionCertificate> {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function persistCertificates(certs: Record<string, InspectionCertificate>): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(certs));
  } catch {
    // Storage may be unavailable (private browsing, quota). Same
    // failure mode the old tool had — surfaced to the user by the
    // calling hook rather than thrown here.
  }
}
