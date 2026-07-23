import { useState } from "react";
import { vesselLookup, VesselLookupResult } from "../services/inspection.api";

interface Props {
  vesselName: string;
  imoNo: string;
  onOpenCertificate: (certNo: string, equipmentType: string) => void;
}

/**
 * Requested directly: when searching a vessel by IMO or Name, both
 * must correspond; confirm the vessel exists; check if it's been
 * worked on before; offer to view old reports or create a new
 * inspection. What this actually checks (see inspection.api.ts's
 * vesselLookup and the backend's own comment for the full reasoning):
 *
 * - The IMO's check-digit — proves the number is well-formed, not that
 *   a real registered ship holds it.
 * - Whether this IMO or name has been recorded before in OUR OWN
 *   certificate history under a conflicting name/IMO.
 * - Prior inspection history for this vessel, with a way to open one.
 *
 * Deliberately does not call MarineTraffic (needs a paid API key this
 * project doesn't have) or Equasis (whose own terms explicitly
 * prohibit automated/API access) — see the root README for the full
 * reasoning. "Confirm the vessel exists" against a live external
 * registry isn't something this build can do; what it can do is make
 * sure this system's own records about the vessel are internally
 * consistent, and that's what this panel actually checks.
 */
export default function VesselLookupPanel({ vesselName, imoNo, onOpenCertificate }: Props) {
  const [result, setResult] = useState<VesselLookupResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkedFor, setCheckedFor] = useState("");

  async function handleCheck() {
    if (!vesselName.trim() && !imoNo.trim()) return;
    setChecking(true);
    try {
      const r = await vesselLookup(imoNo.trim(), vesselName.trim());
      setResult(r);
      setCheckedFor(`${vesselName.trim()}|${imoNo.trim()}`);
    } finally {
      setChecking(false);
    }
  }

  const isStale = result !== null && checkedFor !== `${vesselName.trim()}|${imoNo.trim()}`;

  return (
    <div style={{ background: "#F4F6F7", border: "1px solid #DCE1E5", borderRadius: 6, padding: "10px 12px", margin: "6px 0 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          className="insp-btn insp-btn-outline"
          style={{ padding: "5px 12px", fontSize: 11.5 }}
          onClick={handleCheck}
          disabled={checking || (!vesselName.trim() && !imoNo.trim())}
        >
          {checking ? "Checking..." : "Check Vessel"}
        </button>
        {isStale && <span style={{ fontSize: 11, color: "var(--insp-amber)" }}>Name/IMO changed since last check — check again.</span>}
      </div>

      {result && !isStale && (
        <div style={{ marginTop: 10, fontSize: 12 }}>
          {result.imo_provided && (
            <div style={{ color: result.imo_checksum_valid ? "var(--insp-green)" : "var(--insp-red)", fontWeight: 600, marginBottom: 4 }}>
              {result.imo_checksum_valid
                ? "IMO number is well-formed (passes the check-digit)."
                : "IMO number doesn't pass the check-digit — double-check it for a typo. This only checks the number's format, not that a real ship holds it."}
            </div>
          )}

          {result.name_imo_conflict && (
            <div style={{ background: "#FBF0E2", border: "1px solid #B4690E", borderRadius: 5, padding: "6px 9px", color: "#7A4A08", marginBottom: 6 }}>
              <strong>Name/IMO don't match our records:</strong> {result.conflict_detail}
            </div>
          )}

          {result.history.length === 0 ? (
            <p style={{ color: "var(--insp-muted)", margin: "4px 0 0" }}>No prior inspections found for this vessel in our system.</p>
          ) : (
            <>
              <p style={{ margin: "4px 0 4px", fontWeight: 600, color: "var(--insp-navy)" }}>
                {result.history.length} prior inspection{result.history.length === 1 ? "" : "s"} found:
              </p>
              <table style={{ width: "100%", fontSize: 11.5, borderCollapse: "collapse" }}>
                <tbody>
                  {result.history.map((h) => (
                    <tr key={h.id} style={{ borderTop: "1px solid #DCE1E5" }}>
                      <td style={{ padding: "4px 6px" }}>{h.cert_no}</td>
                      <td style={{ padding: "4px 6px" }}>{h.vessel_name || "—"}</td>
                      <td style={{ padding: "4px 6px" }}>{h.status}</td>
                      <td style={{ padding: "4px 6px" }}>{h.date_of_servicing || "—"}</td>
                      <td style={{ padding: "4px 6px" }}>{h.issued_by?.full_name || h.issued_by?.email || "—"}</td>
                      <td style={{ padding: "4px 6px" }}>
                        <button
                          type="button"
                          className="insp-btn insp-btn-outline"
                          style={{ padding: "2px 8px", fontSize: 10.5 }}
                          onClick={() => onOpenCertificate(h.cert_no, h.equipment_type)}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
}
