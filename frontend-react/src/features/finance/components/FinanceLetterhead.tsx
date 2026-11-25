import { ReactNode } from "react";
import { CompanyInfo } from "../../auth/types/auth.types";
import CertificateQR from "../../inspections/components/CertificateQR";

// Mirrors DEFAULT_* in backend-fastapi/app/core/po_terms.py, so the on-screen
// letterhead matches the server-rendered PDF before/without Settings values.
export const DEFAULT_LEGAL_NAME = "HMZC LDA — Prestação de Serviços Lda";
export const DEFAULT_NIF = "5001114387";
export const DEFAULT_PHONES = "+244 972 320 300 / 944 442 255";

interface Props {
  companyInfo: CompanyInfo | null;
  qrPayload: string;
  extra?: ReactNode;
}

/**
 * The one letterhead used by invoices, quotations and purchase orders:
 * company name, registered name + NIF, both offices, phone and e-mail.
 */
export default function FinanceLetterhead({ companyInfo, qrPayload }: Props) {
  const legal = companyInfo?.company_legal_name || DEFAULT_LEGAL_NAME;
  const nif = companyInfo?.company_nif || DEFAULT_NIF;
  const phones = companyInfo?.company_phones || DEFAULT_PHONES;
  const peppolId = companyInfo?.peppol_id || null;
  return (
    <div className="insp-letterhead">
      <div role="img" aria-label="HMZC LTD" className="insp-letterhead-logo" />
      <div className="insp-lh-right" style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div>
          <strong>HMZC LTD — Marine Engineering Services</strong><br />
          {legal} | NIF: {nif}<br />
          Cabinda HQ: Urbanização 4 De Abril, Cabinda, Angola<br />
          Luanda, Benfica Rua Bento Raimundo.<br />
          Tel: {phones}<br />
          admin@hmzchealthinmarine.com
          {peppolId && <><br />PEPPOL ID: {peppolId}</>}
        </div>
        <CertificateQR payload={qrPayload} size={54} />
      </div>
    </div>
  );
}
