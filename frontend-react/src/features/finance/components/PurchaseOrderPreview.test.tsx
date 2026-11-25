import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PurchaseOrderPreview, { POPreviewData } from "./PurchaseOrderPreview";

vi.mock("../../auth/services/auth.api", () => ({
  getCompanyInfo: () => Promise.resolve({
    company_legal_name: null, company_nif: null, company_phones: null, peppol_id: null,
    po_terms_conditions: "Payment: 30 days from invoice.\nWarranty: 12 months.",
  }),
}));
vi.mock("../../inspections/components/CertificateQR", () => ({ default: () => null }));

const data: POPreviewData = {
  poNo: "25-0022", status: "approved", revision: 1, orderDate: "2025-03-01", deliveryDate: "2025-03-15",
  deliveryTerms: "DAP", quoteRef: "Q-77", subject: "Foam", jobNo: "J-1", vendorName: "Acme Marine",
  vendorVat: "VAT1", vendorPhone: "", vendorEmail: "", vendorPhysicalAddress: "", vendorPostalAddress: "",
  deliveryAddress: "Cabinda", deliveryContactPhone: "", deliveryContactEmail: "", currency: "ZAR",
  lines: [{ code: "F1", description: "Foam", quantity: 2, unit: "ea", unit_price: 913.5, line_total: 1827 }],
  subtotal: 1827, total: 1827, notes: "", writtenByName: "A Writer", writtenByTitle: "Buyer",
  writtenBySignatureUrl: null, approvedByName: "B Boss", approvedByTitle: "Director",
  approvedBySignatureUrl: null, approvedAt: null,
};

describe("PurchaseOrderPreview", () => {
  it("shows the NIF letterhead, the order, signatures and the terms page", async () => {
    render(<PurchaseOrderPreview d={data} />);
    expect(screen.getByText(/NIF: 5001114387/)).toBeTruthy();
    expect(screen.getByText("Acme Marine")).toBeTruthy();
    expect(screen.getAllByText("ZAR 1,827.00").length).toBeGreaterThan(0);
    expect(screen.getByText("B Boss")).toBeTruthy();
    expect(await screen.findByText(/Warranty:/)).toBeTruthy();
  });

  it("shows 'Awaiting approval' until someone has approved", () => {
    render(<PurchaseOrderPreview d={{ ...data, approvedByName: null, status: "pending_approval" }} />);
    expect(screen.getByText("Awaiting approval")).toBeTruthy();
  });
});
