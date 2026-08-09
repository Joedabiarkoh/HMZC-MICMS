import api from "../../../api/axios";

// backend-fastapi/app/api/routes/jobs.py, mounted at /api/jobs. See
// JobPicker.tsx for where these are called from — a technician must
// create or select an open Job for a vessel before a new certificate
// of ANY equipment type can be created (requested directly: "the job
// creation number should be for all the certificate").

export interface Job {
  id: number;
  job_no: string;
  vessel_name: string;
  imo_no: string | null;
  po_number: string | null;
  po_pending: boolean;
  customer_name: string | null;
  status: "open" | "closed";
  next_item_seq: number;
  certificate_count: number;
  created_by: { id: number; email: string; full_name: string | null } | null;
  created_at: string;
  closed_by: { id: number; email: string; full_name: string | null } | null;
  closed_at: string | null;
}

export interface CreateJobInput {
  vesselName: string;
  imoNo: string;
  poNumber: string;
  poPending: boolean;
  customerName: string;
}

export async function createJob(input: CreateJobInput): Promise<Job> {
  const response = await api.post<Job>("/jobs", {
    vessel_name: input.vesselName,
    imo_no: input.imoNo || null,
    po_number: input.poNumber || null,
    po_pending: input.poPending,
    customer_name: input.customerName || null,
  });
  return response.data;
}

export async function listJobs(vesselName: string, status?: "open" | "closed"): Promise<Job[]> {
  const response = await api.get<Job[]>("/jobs", { params: { vessel_name: vesselName, status_filter: status } });
  return response.data;
}

export async function reserveCertNo(jobNo: string): Promise<{ cert_no: string; job_no: string }> {
  const response = await api.post<{ cert_no: string; job_no: string }>(`/jobs/${encodeURIComponent(jobNo)}/reserve-cert-no`);
  return response.data;
}

export async function closeJob(jobNo: string): Promise<Job> {
  const response = await api.post<Job>(`/jobs/${encodeURIComponent(jobNo)}/close`);
  return response.data;
}

export async function setJobPo(jobNo: string, poNumber: string): Promise<Job> {
  const response = await api.post<Job>(`/jobs/${encodeURIComponent(jobNo)}/set-po`, { po_number: poNumber });
  return response.data;
}
