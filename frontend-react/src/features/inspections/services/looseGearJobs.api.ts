import api from "../../../api/axios";

// backend-fastapi/app/api/routes/loose_gear_jobs.py, mounted at
// /api/loose-gear-jobs. See LooseGearJobPicker.tsx for where these are
// called from — a technician must create or select an open Job for a
// vessel before a new Standard Report/Multiple Items certificate can
// get a real certificate number (see reserveCertNo below).

export interface LooseGearJob {
  id: number;
  job_no: string;
  vessel_name: string;
  imo_no: string | null;
  status: "open" | "closed";
  next_item_seq: number;
  created_by: { id: number; email: string; full_name: string | null } | null;
  created_at: string;
  closed_by: { id: number; email: string; full_name: string | null } | null;
  closed_at: string | null;
}

export async function createLooseGearJob(vesselName: string, imoNo: string): Promise<LooseGearJob> {
  const response = await api.post<LooseGearJob>("/loose-gear-jobs", { vessel_name: vesselName, imo_no: imoNo || null });
  return response.data;
}

export async function listLooseGearJobs(vesselName: string, status?: "open" | "closed"): Promise<LooseGearJob[]> {
  const response = await api.get<LooseGearJob[]>("/loose-gear-jobs", { params: { vessel_name: vesselName, status_filter: status } });
  return response.data;
}

export async function reserveCertNo(jobNo: string): Promise<{ cert_no: string; job_no: string }> {
  const response = await api.post<{ cert_no: string; job_no: string }>(`/loose-gear-jobs/${encodeURIComponent(jobNo)}/reserve-cert-no`);
  return response.data;
}

export async function closeLooseGearJob(jobNo: string): Promise<LooseGearJob> {
  const response = await api.post<LooseGearJob>(`/loose-gear-jobs/${encodeURIComponent(jobNo)}/close`);
  return response.data;
}
