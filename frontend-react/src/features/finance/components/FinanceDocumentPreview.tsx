import { useEffect, useState } from "react";
import { HMZC_LOGO_DATA_URI } from "../../inspections/assets/logo";
import CertificateQR from "../../inspections/components/CertificateQR";
import { getCompanyInfo } from "../../auth/services/auth.api";
import { CompanyInfo } from "../../auth/types/auth.types";
import { LineItem } from "../types/finance.types";
import "../../inspections/inspections.css"; // reuses .insp-letterhead/.insp-print-chk/.insp-badge etc. rather than duplicating them in finance.css

interface Props {
  kind: "INVOICE" | "QUOTATION";
  docNo: string;
  customer: string;
  vesselName: string | null;
  imoNo: string | null;
  status: string;
  lineItems: LineItem[];
  subtotal: number;
  discountTotal: number;
  total: number;
  issuedBy: string | null;
  issuedAt: string | null;
}

const watermarkStyle = { ["--insp-watermark-url" as any]: `url(${HMZC_LOGO_DATA_URI})` };

/**
 * "make the invoice have same characteristics as the certificate" — same
 * letterhead (logo + Cabinda/Luanda addresses), the same per-document QR
 * code, and the same faint watermark used on every certificate page
 * (CertificatePreview.tsx), applied here to invoices and quotations.
 */
export default function FinanceDocumentPreview({
  kind, docNo, customer, vesselName, imoNo, status, lineItems, subtotal, discountTotal, total, issuedBy, issuedAt,
}: Props) {
  // Self-fetched rather than threaded down as a prop from InvoiceForm.tsx/
  // QuotationForm.tsx — this is a rarely-changing, company-wide constant
  // (see Settings' Company Information section), not per-document state
  // either of those forms otherwise owns. Any signed-in user can read it
  // (see api/routes/settings.py's read_company_info) since Finance/Sales
  // staff print these documents daily, not just admins.
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  useEffect(() => {
    getCompanyInfo().then(setCompanyInfo).catch(() => {});
  }, []);
  const peppolId = companyInfo?.peppol_id || null;
  // Requested directly, invoices only — a quotation isn't a payment
  // demand yet, so printing bank details on one is premature. Shown
  // only once at least one field has actually been filled in via
  // Settings, so a freshly-deployed instance with nothing configured
  // doesn't print an empty "Supplier Bank Account Details" block.
  const hasBankDetails = kind === "INVOICE" && !!companyInfo && [
    companyInfo.bank_name, companyInfo.bank_address, companyInfo.bank_town, companyInfo.bank_postcode,
    companyInfo.bank_country, companyInfo.bank_beneficiary, companyInfo.bank_account_number,
    companyInfo.bank_sort_code, companyInfo.bank_swift_code, companyInfo.bank_iban,
  ].some(Boolean);

  return (
    <div className="finance-doc-page" style={watermarkStyle}>
      <div className="insp-letterhead">
        <img src={HMZC_LOGO_DATA_URI} alt="HMZC LTD" />
        <div className="insp-lh-right" style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div>
            HMZC LTD — Marine Engineering Services<br />
            Cabinda HQ: Urbanização 4 De Abril, Cabinda, Angola<br />
            Luanda, Benfica Rua Bento Raimundo.<br />
            admin@hmzchealthinmarine.com&nbsp;|&nbsp;+244 972 320 300
            {peppolId && <><br />PEPPOL ID: {peppolId}</>}
          </div>
          <CertificateQR payload={`HMZC ${kind}\nNo: ${docNo}\nCustomer: ${customer || "—"}\nTotal: $${total.toFixed(2)}`} size={54} />
        </div>
      </div>

      <div className="insp-cert-title-row">
        <h2>{kind === "INVOICE" ? "Invoice" : "Quotation"}</h2>
        <span className="insp-badge" style={{ background: kind === "INVOICE" ? "var(--insp-navy)" : "var(--insp-teal)" }}>{status.toUpperCase()}</span>
      </div>

      <table className="insp-id-table">
        <tbody>
          <tr>
            <td className="insp-label-cell">{kind === "INVOICE" ? "Invoice No." : "Quotation No."}</td><td>{docNo}</td>
            <td className="insp-label-cell">Customer</td><td>{customer || "—"}</td>
          </tr>
          <tr>
            <td className="insp-label-cell">Vessel</td><td>{vesselName || "—"}</td>
            <td className="insp-label-cell">IMO No.</td><td>{imoNo || "—"}</td>
          </tr>
        </tbody>
      </table>

      <table className="insp-print-chk" style={{ marginTop: 12 }}>
        <thead><tr><th>Code</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Discount</th><th>Line Total</th></tr></thead>
        <tbody>
          {lineItems.map((item, i) => (
            <tr key={i}>
              <td style={{ fontFamily: "monospace" }}>{item.code}</td>
              <td>{item.description}</td>
              <td>{item.quantity}</td>
              <td>${item.unit_price.toFixed(2)}</td>
              <td>{item.discount_percent > 0 ? `${item.discount_percent}%` : "—"}</td>
              <td>${item.line_total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="finance-totals">
        <div className="finance-totals-row"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
        <div className="finance-totals-row"><span>Discount</span><span>-${discountTotal.toFixed(2)}</span></div>
        <div className="finance-totals-row grand"><span>Total</span><span>${total.toFixed(2)}</span></div>
      </div>

      {hasBankDetails && companyInfo && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--insp-navy)", textTransform: "uppercase", letterSpacing: ".03em", marginBottom: 4 }}>
            Supplier Bank Account Details
          </div>
          <table className="insp-id-table">
            <tbody>
              <tr>
                <td className="insp-label-cell">Bank Name</td><td>{companyInfo.bank_name || "—"}</td>
                <td className="insp-label-cell">Beneficiary</td><td>{companyInfo.bank_beneficiary || "—"}</td>
              </tr>
              <tr>
                <td className="insp-label-cell">Bank Address</td><td colSpan={3}>{companyInfo.bank_address || "—"}</td>
              </tr>
              <tr>
                <td className="insp-label-cell">Town</td><td>{companyInfo.bank_town || "—"}</td>
                <td className="insp-label-cell">Account Number</td><td>{companyInfo.bank_account_number || "—"}</td>
              </tr>
              <tr>
                <td className="insp-label-cell">Postcode</td><td>{companyInfo.bank_postcode || "—"}</td>
                <td className="insp-label-cell">Sort Number</td><td>{companyInfo.bank_sort_code || "—"}</td>
              </tr>
              <tr>
                <td className="insp-label-cell">Country</td><td>{companyInfo.bank_country || "—"}</td>
                <td className="insp-label-cell">Swift Number</td><td>{companyInfo.bank_swift_code || "—"}</td>
              </tr>
              {companyInfo.bank_iban && (
                <tr>
                  <td className="insp-label-cell">IBAN Code</td><td colSpan={3}>{companyInfo.bank_iban}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 24, borderTop: "1px solid #B9C0C6", paddingTop: 8, fontSize: 10, color: "var(--insp-muted)" }}>
        {issuedBy && <div>Issued by {issuedBy}{issuedAt ? ` — ${new Date(issuedAt).toLocaleString()}` : ""}</div>}
        <div style={{ marginTop: 4 }}>
          This {kind === "INVOICE" ? "invoice" : "quotation"} was generated by HMZC LTD's certification platform.
          Prices reflect HMZC's internal price list at the time of issue and are not subject to change once issued
          {kind === "INVOICE" ? "." : "; a formal invoice will confirm final pricing."}
        </div>
      </div>
    </div>
  );
}
