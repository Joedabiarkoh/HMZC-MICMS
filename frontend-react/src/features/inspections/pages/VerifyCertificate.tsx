import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import "../inspections.css";
import { verifyCertificate, CertificateVerifyResult } from "../services/inspection.api";
import { HMZC_LOGO_DATA_URI } from "../assets/logo";

/**
 * Requested directly: the QR code on a printed certificate should stop
 * confirming the certificate once it's been deleted. This is a public
 * page (no sign-in — see App.tsx, it's routed outside RequireAuth) —
 * whoever scans the code on a printed page (a port state inspector, a
 * class surveyor, a client) has no HMZC login and shouldn't need one
 * just to confirm a document they're holding is genuine.
 *
 * Deliberately shows only the same non-sensitive summary already
 * printed on the certificate itself (vessel, IMO, type, status, date,
 * who issued it) — never the full payload (photos, checklist detail,
 * signatures), since this page is reachable by anyone with the link.
 */
export default function VerifyCertificate() {
  const { certNo } = useParams<{ certNo: string }>();
  const [result, setResult] = useState<CertificateVerifyResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!certNo) return;
    verifyCertificate(certNo)
      .then(setResult)
      .catch(() => setErr("Could not reach the verification service. Check your connection and try again."))
      .finally(() => setLoading(false));
  }, [certNo]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--insp-grey-bg)", display: "flex", justifyContent: "center", padding: "40px 16px" }}>
      <div style={{ maxWidth: 480, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <img src={HMZC_LOGO_DATA_URI} alt="HMZC LTD" style={{ height: 36 }} />
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--insp-navy)" }}>HMZC LTD — Certificate Verification</div>
        </div>

        {loading && <p style={{ color: "var(--insp-muted)" }}>Checking certificate…</p>}

        {err && (
          <div style={{ background: "#FBEEEC", border: "1px solid var(--insp-red)", borderRadius: 6, padding: "10px 14px", color: "#7A241B", fontSize: 12.5 }}>
            {err}
          </div>
        )}

        {!loading && !err && result && (
          <div style={{ background: "#fff", border: "1px solid var(--insp-line)", borderRadius: 10, overflow: "hidden" }}>
            {result.valid ? (
              <div style={{ background: "var(--insp-green-light)", borderBottom: "3px solid var(--insp-green)", padding: "18px 20px" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "var(--insp-green)" }}>✓ Valid Certificate</div>
                <div style={{ fontSize: 12, color: "var(--insp-muted)", marginTop: 4 }}>
                  This certificate number exists in HMZC's records.
                </div>
              </div>
            ) : (
              <div style={{ background: "#FBEEEC", borderBottom: "3px solid var(--insp-red)", padding: "18px 20px" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "var(--insp-red)" }}>✗ Not a Valid Certificate</div>
                <div style={{ fontSize: 12, color: "#7A241B", marginTop: 4 }}>
                  This certificate number does not exist in HMZC's records — it may have been deleted, or the number is incorrect.
                </div>
              </div>
            )}

            <div style={{ padding: "16px 20px" }}>
              <table className="insp-id-table" style={{ marginBottom: 0 }}>
                <tbody>
                  <tr><td className="insp-label-cell">Certificate No.</td><td colSpan={3} style={{ fontFamily: "monospace" }}>{result.cert_no}</td></tr>
                  {result.valid && (
                    <>
                      <tr><td className="insp-label-cell">Vessel</td><td>{result.vessel_name || "—"}</td><td className="insp-label-cell">IMO No.</td><td>{result.imo_no || "—"}</td></tr>
                      <tr><td className="insp-label-cell">Type</td><td colSpan={3}>{result.equipment_type || "—"}</td></tr>
                      <tr><td className="insp-label-cell">Status</td><td style={{ textTransform: "capitalize" }}>{result.status || "—"}</td><td className="insp-label-cell">Date</td><td>{result.date_of_servicing || "—"}</td></tr>
                      <tr><td className="insp-label-cell">Issued By</td><td colSpan={3}>{result.issued_by_name || "—"}</td></tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p style={{ fontSize: 11, color: "var(--insp-muted)", marginTop: 16, textAlign: "center" }}>
          This page confirms only that a certificate with this number exists in HMZC's system —
          it is not the certificate itself.
        </p>
      </div>
    </div>
  );
}
