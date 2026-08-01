import api from "../../../api/axios";
import { SupplierBoardingSubmission } from "../types/supplier.types";

// Blob downloads go through axios (not a plain <a href>) so the Bearer
// token from the request interceptor (src/api/axios.ts) actually gets
// attached — same pattern as finance.api.ts's downloadBlob.
async function downloadBlob(url: string, filename: string): Promise<void> {
  const response = await api.get(url, { responseType: "blob" });
  const blobUrl = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}

export async function downloadBoardingTemplate(): Promise<void> {
  await downloadBlob("/suppliers/boarding-template", "New Supplier Form.xlsx");
}

export async function listBoardingSubmissions(): Promise<SupplierBoardingSubmission[]> {
  const response = await api.get<SupplierBoardingSubmission[]>("/suppliers/boarding");
  return response.data;
}

export async function uploadBoardingSubmission(supplierName: string, notes: string, file: File): Promise<SupplierBoardingSubmission> {
  const form = new FormData();
  form.append("supplier_name", supplierName);
  form.append("notes", notes);
  form.append("file", file);
  const response = await api.post<SupplierBoardingSubmission>("/suppliers/boarding", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function downloadBoardingSubmission(submission: SupplierBoardingSubmission): Promise<void> {
  await downloadBlob(`/suppliers/boarding/${submission.id}/download`, submission.original_filename);
}

export async function deleteBoardingSubmission(id: number): Promise<void> {
  await api.delete(`/suppliers/boarding/${id}`);
}
