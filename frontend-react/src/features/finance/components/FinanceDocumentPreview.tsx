import { useEffect, useRef, useState } from "react";
import CertificateQR from "../../inspections/components/CertificateQR";
import { getCompanyInfo } from "../../auth/services/auth.api";
import { CompanyInfo } from "../../auth/types/auth.types";
import { LineItem } from "../types/finance.types";
import { formatMoney } from "../data/currencies";
import { useFillToPageMultiple } from "../../../hooks/useFillToPageMultiple";
import "../../inspections/inspections.css"; // reuses .insp-letterhead/.insp-print-chk/.insp-badge etc. rather than duplicating them in finance.css
// Side-effect only — see CertificatePreview.tsx's own import of this
// and cssVars.ts's own comment for why the logo/stamp are referenced
// via CSS variables (--insp-watermark-url/--insp-stamp-url) here too,
// rather than an <img src="data:..."> carrying its own copy.
import "../../inspections/assets/cssVars";

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
  // Every amount above (and every line item's unit_price/line_total) is
  // always USD — currency/exchangeRate (units of `currency` per 1 USD)
  // are applied here, at display time, to show what actually prints.
  currency: string;
  exchangeRate: number;
  // Short condition bullets printed to the left of the totals block —
  // quotation-only (undefined/empty on an invoice), editable per
  // document (see ConditionsEditor.tsx), distinct from the company-wide
  // Terms and Conditions legal text below (which prints on invoices).
  conditions?: string[];
  issuedBy: string | null;
  issuedAt: string | null;
}

// Each line of terms_conditions is "Label: clause text" (see
// NotificationSettings.tsx's own note on this convention) except the
// opening preamble paragraph, which has no label — indexOf(": ") only
// matches within the first 60 characters so a colon appearing naturally
// inside a long unlabeled paragraph doesn't get mistaken for one.
function renderTermsLine(line: string, i: number) {
  const idx = line.indexOf(": ");
  if (idx > 0 && idx < 60) {
    return (
      <p key={i} style={{ margin: "0 0 8px", breakInside: "avoid" }}>
        <strong>{line.slice(0, idx + 1)}</strong>{line.slice(idx + 1)}
      </p>
    );
  }
  return <p key={i} style={{ margin: "0 0 8px", breakInside: "avoid" }}>{line}</p>;
}

/**
 * "make the invoice have same characteristics as the certificate" — same
 * letterhead (logo + Cabinda/Luanda addresses), the same per-document QR
 * code, and the same faint watermark used on every certificate page
 * (CertificatePreview.tsx), applied here to invoices and quotations.
 */
export default function FinanceDocumentPreview({
  kind, docNo, customer, vesselName, imoNo, status, lineItems, subtotal, discountTotal, total, currency, exchangeRate, conditions, issuedBy, issuedAt,
}: Props) {
  const money = (usdAmount: number) => formatMoney(usdAmount, currency, exchangeRate);
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

  const theadRef = useRef<HTMLTableSectionElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const tfootRef = useRef<HTMLTableSectionElement>(null);
  useFillToPageMultiple(fillRef, theadRef, tfootRef);

  // Requested directly: "all the header and footer static adjustment
  // is for all certificate issued, quotation and invoices" — the
  // letterhead/footer here are wrapped in a real <table> (see
  // inspections.css's own comment on table.insp-page-frame for the
  // full reasoning, including the Paged.js attempt that was tried and
  // reverted). <thead>/<tfoot> repeat reliably on every physical page
  // this document spans; useFillToPageMultiple (see its own comment)
  // pads the content to a whole multiple of one page so a document
  // spanning several pages (a long Terms and Conditions section, say)
  // gets its trailing partial page's footer pushed down to match every
  // other page's position too, not just a single-page document.
  return (
    <div className="finance-doc-page">
      <table className="insp-page-frame">
        <thead ref={theadRef}><tr><td>
          <div className="insp-letterhead">
            <div role="img" aria-label="HMZC LTD" className="insp-letterhead-logo" />
            <div className="insp-lh-right" style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div>
                HMZC LTD — Marine Engineering Services<br />
                Cabinda HQ: Urbanização 4 De Abril, Cabinda, Angola<br />
                Luanda, Benfica Rua Bento Raimundo.<br />
                admin@hmzchealthinmarine.com&nbsp;|&nbsp;+244 972 320 300
                {peppolId && <><br />PEPPOL ID: {peppolId}</>}
              </div>
              <CertificateQR payload={`HMZC ${kind}\nNo: ${docNo}\nCustomer: ${customer || "—"}\nTotal: ${money(total)}`} size={54} />
            </div>
          </div>
        </td></tr></thead>
        <tbody><tr><td><div ref={fillRef} className="insp-page-tbody-fill">

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
              <td>{money(item.unit_price)}</td>
              <td>{item.discount_percent > 0 ? `${item.discount_percent}%` : "—"}</td>
              <td>{money(item.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20 }}>
        {!!conditions?.length && (
          <div className="finance-conditions">
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--insp-navy)", textTransform: "uppercase", letterSpacing: ".03em", marginBottom: 4 }}>
              Conditions
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 10.5, color: "var(--insp-text)", lineHeight: 1.5 }}>
              {conditions.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
        )}
        <div className="finance-totals" style={{ marginLeft: conditions?.length ? 0 : "auto" }}>
          <div className="finance-totals-row"><span>Subtotal</span><span>{money(subtotal)}</span></div>
          <div className="finance-totals-row"><span>Discount</span><span>-{money(discountTotal)}</span></div>
          <div className="finance-totals-row grand"><span>Total</span><span>{money(total)}</span></div>
          {currency !== "USD" && (
            <div className="finance-totals-row" style={{ fontSize: 9.5, color: "var(--insp-muted)" }}>
              <span>USD Equivalent</span><span>${total.toFixed(2)} @ {exchangeRate || 0}</span>
            </div>
          )}
        </div>
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

      {kind === "INVOICE" && !!companyInfo?.terms_conditions && (
        <div style={{ marginTop: 24, breakBefore: "page" } as any}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--insp-navy)", textTransform: "uppercase", letterSpacing: ".03em", marginBottom: 8 }}>
            Terms and Conditions
          </div>
          <div style={{ columnCount: 2, columnGap: 24, fontSize: 9.5, lineHeight: 1.45, color: "#333" }}>
            {companyInfo.terms_conditions.split("\n").filter((l) => l.trim()).map(renderTermsLine)}
          </div>
        </div>
      )}

        </div></td></tr></tbody>
        <tfoot ref={tfootRef}><tr><td>
          <div style={{ marginTop: 24, borderTop: "1px solid #B9C0C6", paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
            <div style={{ fontSize: 10, color: "var(--insp-muted)" }}>
              {issuedBy && <div>Issued by {issuedBy}{issuedAt ? ` — ${new Date(issuedAt).toLocaleString()}` : ""}</div>}
              <div style={{ marginTop: 4 }}>
                This {kind === "INVOICE" ? "invoice" : "quotation"} was generated by HMZC LTD's certification platform.
                Prices reflect HMZC's internal price list at the time of issue and are not subject to change once issued
                {kind === "INVOICE" ? "." : "; a formal invoice will confirm final pricing."}
              </div>
            </div>
            {/* Requested directly: "include this stamp to all certificate,
                and invoice, this is supposed to be the digital stamp of
                HMZC." Invoice-only (quotations weren't asked for) — see
                CertificatePreview.tsx's CertPageFrame for the certificate
                side of the same request. */}
            {kind === "INVOICE" && (
              <div
                role="img"
                aria-label="HMZC Official Stamp"
                style={{
                  height: 60, width: 189, backgroundImage: "var(--insp-stamp-url)", backgroundSize: "contain", backgroundRepeat: "no-repeat", flexShrink: 0,
                  // Requested directly: "the stamp is not showing." See
                  // inspections.css's own comment on .insp-cert-page::before.
                  printColorAdjust: "exact", WebkitPrintColorAdjust: "exact",
                } as any}
              />
            )}
          </div>
        </td></tr></tfoot>
      </table>
    </div>
  );
}
