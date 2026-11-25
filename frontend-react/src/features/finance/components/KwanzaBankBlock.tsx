import { CompanyInfo } from "../../auth/types/auth.types";

// Mirrors DEFAULT_KWANZA_BANK in backend core/po_terms.py (HMZC's BAI account).
export const DEFAULT_KWANZA_BANK = [
  "Bank: BAI — Banco BAI, Luanda, Complexo Garden Towers, Torre BAI, Travessa Ho Chi Minh, Maianga, Angola",
  "Beneficiary: HMZC PRESTAÇÃO DE SERVIÇOS LDA",
  "IBAN: AO06 0040 0000 3118 6064 1513 6",
  "Account No.: 231186064.15.001",
  "SWIFT: BAIPAOLU",
  "NIF: 5001114387",
].join("\n");

/** HMZC's Kwanza bank account, printed on every AOA invoice, quotation and PO. */
export default function KwanzaBankBlock({ companyInfo }: { companyInfo: CompanyInfo | null }) {
  const text = companyInfo?.kwanza_bank_details || DEFAULT_KWANZA_BANK;
  const rows = text.split("\n").filter((l) => l.trim()).map((l) => {
    const i = l.indexOf(":");
    return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : ["", l.trim()];
  });
  return (
    <div style={{ marginTop: 12, breakInside: "avoid" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#1F3B5C", marginBottom: 4 }}>BANK DETAILS (KWANZA ACCOUNT)</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
        <tbody>
          {rows.map(([k, v], i) => (
            <tr key={i}>
              <td style={{ border: "1px solid #C9D1D8", background: "#F1F4F7", fontWeight: 700, padding: "3px 7px", width: "20%" }}>{k}</td>
              <td style={{ border: "1px solid #C9D1D8", padding: "3px 7px" }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
