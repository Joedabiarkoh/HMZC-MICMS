import api from "../../../api/axios";
import { InspectionCertificate } from "../types/inspection.types";

// backend-fastapi/app/api/routes/certificates.py now exists and is
// mounted at /api/certificates — these calls match its real shape
// (previously this file guessed at "/inspections/certificates" before
// any backend route existed at all). See inspection.storage.ts for the
// localStorage cache these are paired with — useInspections.ts calls
// both: backend when reachable, local cache always, so the module keeps
// working offline the way it did before this backend existed.

interface BackendCertificate {
  id: number;
  cert_no: string;
  equipment_type: string;
  vessel_name: string | null;
  imo_no: string | null;
  status: string;
  date_of_servicing: string | null;
  payload: InspectionCertificate;
  issued_by: { id: number; email: string; full_name: string | null; role: string } | null;
  version: number;
  created_at: string;
  updated_at: string | null;
}

export class CertificateConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CertificateConflictError";
  }
}

function toBackendPayload(cert: InspectionCertificate) {
  return {
    cert_no: cert.certNo,
    equipment_type: cert.type,
    vessel_name: cert.vesselName || null,
    imo_no: cert.imoNo || null,
    status: cert.status,
    date_of_servicing: cert.dateOfServicing || null,
    payload: cert,
    version: cert.version ?? null,
  };
}

/** Merges backend-tracked issuer/timestamp fields onto the certificate's own payload for display. */
function fromBackend(row: BackendCertificate): InspectionCertificate {
  return {
    ...row.payload,
    issuedBy: row.issued_by ? (row.issued_by.full_name || row.issued_by.email) : row.payload.savedBy,
    issuedAt: row.created_at,
    version: row.version,
  };
}

export async function listCertificates(): Promise<InspectionCertificate[]> {
  const response = await api.get<BackendCertificate[]>("/certificates");
  return response.data.map(fromBackend);
}

/**
 * Just the bare cert_no strings, for every certificate regardless of
 * who issued it — not the certificates themselves. Added alongside the
 * "each person only sees what they issued" permission change: once
 * listCertificates() started filtering non-view_all accounts to their
 * own certificates, generating the next certificate number by counting
 * *visible* certificates would only count that one person's issuance
 * for the day — two different technicians would both compute the same
 * "next" number and collide. Numbering integrity needs the whole
 * company's numbers regardless of view permission; browsing everyone's
 * certificate content doesn't, which is why this is a separate,
 * narrower endpoint (CERT_EDIT-gated, not CERT_VIEW) rather than just
 * removing the filter from listCertificates().
 */
export async function listCertificateNumbers(): Promise<string[]> {
  const response = await api.get<string[]>("/certificates/numbers");
  return response.data;
}

export interface VesselHistoryEntry {
  id: number;
  cert_no: string;
  equipment_type: string;
  vessel_name: string | null;
  imo_no: string | null;
  status: string;
  date_of_servicing: string | null;
  issued_by: { id: number; email: string; full_name: string | null; role: string } | null;
  created_at: string;
}

export interface VesselLookupResult {
  imo_provided: string | null;
  name_provided: string | null;
  imo_checksum_valid: boolean | null;
  name_imo_conflict: boolean;
  conflict_detail: string | null;
  history: VesselHistoryEntry[];
}

export interface VesselSummary {
  vessel_name: string | null;
  imo_no: string | null;
  certificate_count: number;
  last_date_of_servicing: string | null;
  last_updated: string;
  last_status: string;
  last_equipment_type: string;
}

/**
 * One row per distinct vessel (grouped server-side from this project's
 * own certificate history, not a separate Vessels table — see the
 * backend route's own comment). The entry point for "search a vessel,
 * then decide what to do with it" — vesselLookup below needs an exact
 * name/IMO already in hand, which is what this list feeds into once a
 * specific vessel is picked from the results.
 */
export async function listVessels(q?: string): Promise<VesselSummary[]> {
  const response = await api.get<VesselSummary[]>("/certificates/vessels", { params: q ? { q } : {} });
  return response.data;
}

/**
 * Requested directly: confirm IMO/Name correspond and check whether
 * this vessel's been worked on before. Validates the IMO check-digit
 * and cross-checks our own certificate history — does NOT call
 * MarineTraffic or Equasis (see the backend endpoint's own comment,
 * and the root README, for why: one needs a paid API key this project
 * doesn't have, the other's terms explicitly prohibit automated access).
 */
export async function vesselLookup(imo: string, name: string): Promise<VesselLookupResult> {
  const response = await api.get<VesselLookupResult>("/certificates/vessel-lookup", { params: { imo, name } });
  return response.data;
}

export async function saveCertificateRemote(cert: InspectionCertificate): Promise<InspectionCertificate> {
  try {
    const response = await api.post<BackendCertificate>("/certificates", toBackendPayload(cert));
    return fromBackend(response.data);
  } catch (e: any) {
    if (e?.response?.status === 409) {
      throw new CertificateConflictError(e.response.data?.detail || "This certificate was changed by someone else. Reload it and re-apply your changes.");
    }
    throw e;
  }
}

export async function deleteCertificateRemote(certNo: string): Promise<void> {
  await api.delete(`/certificates/${encodeURIComponent(certNo)}`);
}

