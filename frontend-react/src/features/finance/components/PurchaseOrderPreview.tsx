import { useEffect, useState } from "react";
import FinanceLetterhead from "./FinanceLetterhead";
import { getCompanyInfo } from "../../auth/services/auth.api";
import { CompanyInfo } from "../../auth/types/auth.types";
import { formatPOMoney, PO_STATUS_LABELS, POLine, POStatus } from "../types/purchaseOrder.types";
import "../../inspections/inspections.css";
import "../../inspections/assets/cssVars";

// The terms page shown is the company's PO terms from Settings (seeded by
// migration 0027 from the approved PO 25-0022 wording).
export interface POPreviewData {
  poNo: string;
  status: POStatus;
  revision: number;
  orderDate: string;
  deliveryDate: string;
  deliveryTerms: string;
  quoteRef: string;
  subject: string;
  jobNo: string;
  vendorName: string;
  vendorVat: string;
  vendorPhone: string;
  vendorEmail: string;
  vendorPhysicalAddress: string;
  vendorPostalAddress: string;
  deliveryAddress: string;
  deliveryContactPhone: string;
  deliveryContactEmail: string;
  currency: string;
  lines: POLine[];
  subtotal: number;
  total: number;
  notes: string;
  writtenByName: string | null;
  writtenByTitle: string | null;
  writtenBySignatureUrl: string | null;
  approvedByName: string | null;
  approvedByTitle: string | null;
  approvedBySignatureUrl: string | null;
  approvedAt: string | null;
}

function termLine(line: string, i: number) {
  const idx = line.indexOf(":");
  if (idx > 0 && idx < 60) {
    return <p key={i} style={{ margin: "0 0 6px" }}><strong>{line.slice(0, idx + 1)}</strong>{line.slice(idx + 1)}</p>;
  }
  return <p key={i} style={{ margin: "0 0 6px" }}>{line}</p>;
}

const cell: React.CSSProperties = { border: "1px solid #C9D1D8", padding: "4px 7px", fontSize: 11.5, verticalAlign: "top" };
const head: React.CSSProperties = { ...cell, background: "#1F3B5C", color: "#fff", fontWeight: 700 };
const label: React.CSSProperties = { ...cell, background: "#F1F4F7", fontWeight: 700, width: "18%" };

function SignatureBox({ title, name, role, signatureUrl, when }: {
  title: string; name: string | null; role: string | null; signatureUrl: string | null; when?: string | null;
}) {
  return (
    <div style={{ flex: 1, border: "1px solid #C9D1D8", padding: 8, minHeight: 90 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: "#1F3B5C", textTransform: "uppercase" }}>{title}</div>
      {name ? (
        <>
          {signatureUrl && <img src={signatureUrl} alt={`${name} signature`} style={{ maxHeight: 44, maxWidth: "100%", display: "block", margin: "4px 0" }} />}
          <div style={{ fontSize: 12, fontWeight: 700 }}>{name}</div>
          {role && <div style={{ fontSize: 11 }}>{role}</div>}
          {when && <div style={{ fontSize: 10.5, color: "#6B7480" }}>{when}</div>}
        </>
      ) : (
        <div style={{ fontSize: 11.5, color: "#6B7480", marginTop: 22 }}>Awaiting approval</div>
      )}
    </div>
  );
}

/**
 * On-screen / browser-print rendering of a purchase order: shared letterhead,
 * the order, signature boxes, then the terms page. The downloadable PDF is
 * rendered server-side (core/po_pdf.py) from the same data.
 */
export default function PurchaseOrderPreview({ d }: { d: POPreviewData }) {
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  useEffect(() => {
    getCompanyInfo().then(setCompany).catch(() => {});
  }, []);
  const terms = (company?.po_terms_conditions || "").split("\n").filter((l) => l.trim());
  const money = (n: number) => formatPOMoney(n, d.currency);

  return (
    <div className="finance-doc-page">
      <table className="insp-page-frame">
        <thead><tr><td>
          <FinanceLetterhead companyInfo={company} qrPayload={`HMZC PURCHASE ORDER\nNo: ${d.poNo || "—"}\nVendor: ${d.vendorName || "—"}\nTotal: ${money(d.total)}`} />
        </td></tr></thead>
        <tbody><tr><td>
          <div className="insp-cert-title-row">
            <h2>Purchase Order</h2>
            <span className="insp-badge" style={{ background: "var(--insp-navy)" }}>{PO_STATUS_LABELS[d.status].toUpperCase()}</span>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
            <tbody>
              <tr>
                <td style={label}>PO No</td><td style={cell}>{d.poNo || "—"}</td>
                <td style={label}>Order Date</td><td style={cell}>{d.orderDate || "—"}</td>
              </tr>
              <tr>
                <td style={label}>Quote Ref</td><td style={cell}>{d.quoteRef || "—"}</td>
                <td style={label}>Delivery Date</td><td style={cell}>{d.deliveryDate || "—"}</td>
              </tr>
              <tr>
                <td style={label}>Version No</td><td style={cell}>{d.revision}</td>
                <td style={label}>Delivery Terms</td><td style={cell}>{d.deliveryTerms || "—"}</td>
              </tr>
              <tr>
                <td style={label}>Job No</td><td style={cell} colSpan={3}>{d.jobNo || "—"}</td>
              </tr>
            </tbody>
          </table>

          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
            <tbody>
              <tr><td style={{ ...head }} colSpan={4}>Vendor</td></tr>
              <tr>
                <td style={label}>Name</td><td style={cell}>{d.vendorName || "—"}</td>
                <td style={label}>VAT / NIF</td><td style={cell}>{d.vendorVat || "—"}</td>
              </tr>
              <tr>
                <td style={label}>Phone</td><td style={cell}>{d.vendorPhone || "—"}</td>
                <td style={label}>Email</td><td style={cell}>{d.vendorEmail || "—"}</td>
              </tr>
              <tr>
                <td style={label}>Physical address</td><td style={cell}>{d.vendorPhysicalAddress || "—"}</td>
                <td style={label}>Postal address</td><td style={cell}>{d.vendorPostalAddress || "—"}</td>
              </tr>
            </tbody>
          </table>

          {d.subject && <p style={{ fontSize: 12, margin: "4px 0 8px" }}><strong>Subject:</strong> {d.subject}</p>}

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...head, width: 30 }}>#</th>
                <th style={head}>Description</th>
                <th style={{ ...head, width: 50, textAlign: "right" }}>Qty</th>
                <th style={{ ...head, width: 44 }}>Unit</th>
                <th style={{ ...head, width: 90, textAlign: "right" }}>Unit price</th>
                <th style={{ ...head, width: 95, textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {d.lines.map((l, i) => (
                <tr key={i}>
                  <td style={cell}>{i + 1}</td>
                  <td style={cell}>{l.code ? `${l.code} — ` : ""}{l.description}</td>
                  <td style={{ ...cell, textAlign: "right" }}>{l.quantity}</td>
                  <td style={cell}>{l.unit}</td>
                  <td style={{ ...cell, textAlign: "right" }}>{money(l.unit_price)}</td>
                  <td style={{ ...cell, textAlign: "right" }}>{money(l.line_total)}</td>
                </tr>
              ))}
              <tr>
                <td style={{ ...cell, textAlign: "right", fontWeight: 700 }} colSpan={5}>Total</td>
                <td style={{ ...cell, textAlign: "right", fontWeight: 700 }}>{money(d.total)}</td>
              </tr>
            </tbody>
          </table>

          {d.notes && <p style={{ fontSize: 11.5, marginTop: 8 }}><strong>Notes:</strong> {d.notes}</p>}

          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <SignatureBox title="Written by" name={d.writtenByName} role={d.writtenByTitle} signatureUrl={d.writtenBySignatureUrl} />
            <SignatureBox
              title="Approved by"
              name={d.approvedByName}
              role={d.approvedByTitle}
              signatureUrl={d.approvedBySignatureUrl}
              when={d.approvedAt ? new Date(d.approvedAt).toLocaleDateString() : null}
            />
          </div>

          {(d.deliveryAddress || d.deliveryContactPhone || d.deliveryContactEmail) && (
            <p style={{ fontSize: 11.5, marginTop: 12 }}>
              <strong>Deliver to:</strong> {d.deliveryAddress}
              {d.deliveryContactPhone && <> · Tel: {d.deliveryContactPhone}</>}
              {d.deliveryContactEmail && <> · {d.deliveryContactEmail}</>}
            </p>
          )}

          {terms.length > 0 && (
            <div style={{ pageBreakBefore: "always", breakBefore: "page", marginTop: 24, fontSize: 11.5 }}>
              <h3 style={{ color: "#1F3B5C", marginTop: 0 }}>Terms &amp; Conditions</h3>
              {terms.map(termLine)}
            </div>
          )}
        </td></tr></tbody>
      </table>
    </div>
  );
}
