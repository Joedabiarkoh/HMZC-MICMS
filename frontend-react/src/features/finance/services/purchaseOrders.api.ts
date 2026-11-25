import api from "../../../api/axios";
import {
  POAttachment, POSavePayload, POTransitionPayload, POVendor, PurchaseOrder,
} from "../types/purchaseOrder.types";
import { DocumentConflictError } from "./finance.api";

const enc = encodeURIComponent;

function rethrow(e: any): never {
  // 409 = someone saved a newer edit in between (same convention as invoices).
  if (e?.response?.status === 409) {
    throw new DocumentConflictError(e.response.data?.detail || "This purchase order was changed by someone else. Reload it.");
  }
  throw e;
}

export async function listPurchaseOrders(): Promise<PurchaseOrder[]> {
  const r = await api.get<PurchaseOrder[]>("/purchase-orders");
  return r.data;
}

export async function getPurchaseOrder(poNo: string): Promise<PurchaseOrder> {
  const r = await api.get<PurchaseOrder>(`/purchase-orders/${enc(poNo)}`);
  return r.data;
}

export async function listPOVendors(): Promise<POVendor[]> {
  const r = await api.get<POVendor[]>("/purchase-orders/vendors");
  return r.data;
}

export async function savePurchaseOrder(payload: POSavePayload): Promise<PurchaseOrder> {
  try {
    const r = await api.post<PurchaseOrder>("/purchase-orders", payload);
    return r.data;
  } catch (e) {
    return rethrow(e);
  }
}

export async function transitionPurchaseOrder(poNo: string, payload: POTransitionPayload): Promise<PurchaseOrder> {
  try {
    const r = await api.post<PurchaseOrder>(`/purchase-orders/${enc(poNo)}/transition`, payload);
    return r.data;
  } catch (e) {
    return rethrow(e);
  }
}

export async function deletePurchaseOrder(poNo: string): Promise<void> {
  await api.delete(`/purchase-orders/${enc(poNo)}`);
}

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

export async function downloadPurchaseOrderPdf(poNo: string, withAttachments = false): Promise<void> {
  await downloadBlob(`/purchase-orders/${enc(poNo)}/pdf?with_attachments=${withAttachments}`, `PO-${poNo}.pdf`);
}

export async function listPOAttachments(poNo: string): Promise<POAttachment[]> {
  const r = await api.get<POAttachment[]>(`/purchase-orders/${enc(poNo)}/attachments`);
  return r.data;
}

export async function uploadPOAttachment(poNo: string, file: File, label: string): Promise<POAttachment> {
  const form = new FormData();
  form.append("file", file);
  form.append("label", label);
  const r = await api.post<POAttachment>(`/purchase-orders/${enc(poNo)}/attachments`, form);
  return r.data;
}

export async function downloadPOAttachment(poNo: string, att: POAttachment): Promise<void> {
  await downloadBlob(`/purchase-orders/${enc(poNo)}/attachments/${att.id}/download`, att.original_filename);
}

export async function deletePOAttachment(poNo: string, attId: number): Promise<void> {
  await api.delete(`/purchase-orders/${enc(poNo)}/attachments/${attId}`);
}
