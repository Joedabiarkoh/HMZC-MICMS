import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../inspections.css";
import { useInspections } from "../hooks/useInspections";
import { useAuth } from "../../../context/AuthContext";
import { INSPECTION_TYPES } from "../data/inspectionChecklists";
import { EquipmentTypeKey } from "../types/inspection.types";
import { hasPermission, PERM } from "../../auth/types/auth.types";
import { confirmAction } from "../../../components/ConfirmDialog";

/**
 * The previous standalone tool had a "Certificate Log" tab for exactly
 * this — browsing and reopening saved certificates — but it never got
 * built in this React port (openCertificate/deleteCertificate existed on
 * the hook, unused). Built now because "admin can see who issued what,
 * when, and keep track" needs somewhere to actually see that list.
 * issuedBy/issuedAt (backend-authoritative, see inspection.api.ts) are
 * shown to everyone, not just admins — delete is the only admin-gated
 * action, matching the standalone tool's original permission split.
 */
export default function CertificateLog() {
  const { certificates, syncError, pendingSyncCount, retrySync, deleteCertificate } = useInspections();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const list = Object.values(certificates)
    .filter((c) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        c.certNo.toLowerCase().includes(q) ||
        (c.vesselName || "").toLowerCase().includes(q) ||
        (c.imoNo || "").toLowerCase().includes(q) ||
        (c.issuedBy || c.savedBy || "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => (b.issuedAt || b.savedAt || "").localeCompare(a.issuedAt || a.savedAt || ""));

  function handleOpen(certNo: string, type: EquipmentTypeKey) {
    navigate(`/inspections?type=${type}&open=${encodeURIComponent(certNo)}`);
  }

  return (
    <div className="inspections-page">
      <div className="insp-topbar">
        <div>
          <h1>Certificate Log</h1>
          <p>HMZC LTD — Marine Engineering Services</p>
        </div>
      </div>

      <div style={{ padding: "10px 20px 0" }}>
        <div style={{ fontSize: 11.5, color: "var(--insp-muted)" }}>
          {hasPermission(user, PERM.CERT_VIEW_ALL)
            ? "Showing every certificate issued company-wide."
            : "Showing only certificates you've issued yourself. Contact an administrator if you need to see someone else's."}
        </div>
      </div>
      <div style={{ padding: "16px 20px" }}>
        {syncError && (
          <div style={{ background: "#FBF0E2", border: "1px solid #B4690E", color: "#7A4A08", borderRadius: 6, padding: "8px 12px", fontSize: 12, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <span>{syncError}</span>
            {pendingSyncCount > 0 && (
              <button className="insp-btn insp-btn-outline" style={{ padding: "3px 10px", fontSize: 11 }} onClick={retrySync}>Retry Now</button>
            )}
          </div>
        )}
        <input
          type="text"
          placeholder="Search by certificate no., vessel, IMO, or issuer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: "8px 10px", border: "1px solid #C9D1D8", borderRadius: 6, fontSize: 13, minWidth: 320, marginBottom: 14 }}
        />
        <table className="users-table" style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden", border: "1px solid #DCE1E5" }}>
          <thead>
            <tr>
              <th>Cert No.</th><th>Type</th><th>Vessel / IMO</th><th>Status</th>
              <th>Issued By</th><th>Issued At</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 24, color: "#6B7480" }}>No certificates yet.</td></tr>
            )}
            {list.map((c) => (
              <tr key={c.certNo}>
                <td>{c.certNo}</td>
                <td><span className="insp-badge" style={{ background: "#455A73" }}>{INSPECTION_TYPES[c.type]?.typeName || c.type}</span></td>
                <td>{c.vesselName || "—"}{c.imoNo ? ` / ${c.imoNo}` : ""}</td>
                <td>{(c.status || "draft").toUpperCase()}</td>
                <td>{c.issuedBy || c.savedBy || "—"}{!c.issuedBy && c.savedBy ? " (not yet synced)" : ""}</td>
                <td>{c.issuedAt ? new Date(c.issuedAt).toLocaleString() : c.savedAt ? new Date(c.savedAt).toLocaleString() : "—"}</td>
                <td>
                  <button className="insp-btn insp-btn-outline" style={{ marginRight: 6 }} onClick={() => handleOpen(c.certNo, c.type)}>Open</button>
                  {hasPermission(user, PERM.CERT_DELETE) && (
                    <button
                      className="insp-btn"
                      style={{ background: "#B3382C", color: "#fff" }}
                      onClick={async () => {
                        const ok = await confirmAction({
                          title: "Delete certificate?",
                          message: `Certificate ${c.certNo} will be permanently deleted. This cannot be undone.`,
                          confirmLabel: "Delete",
                          danger: true,
                        });
                        if (ok) deleteCertificate(c.certNo);
                      }}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
