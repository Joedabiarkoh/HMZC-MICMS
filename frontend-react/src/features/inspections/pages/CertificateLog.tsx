import { Fragment, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../inspections.css";
import { useInspections } from "../hooks/useInspections";
import { useAuth } from "../../../context/AuthContext";
import { INSPECTION_TYPES } from "../data/inspectionChecklists";
import { EquipmentTypeKey } from "../types/inspection.types";
import { groupCertificatesByVessel, VesselGroup } from "../data/groupCertificatesByVessel";
import { hasPermission, PERM } from "../../auth/types/auth.types";
import { confirmAction } from "../../../components/ConfirmDialog";
import { exportRowsToCsv } from "../../../utils/exportCsv";

/**
 * The previous standalone tool had a "Certificate Log" tab for exactly
 * this — browsing and reopening saved certificates — but it never got
 * built in this React port (openCertificate/deleteCertificate existed on
 * the hook, unused). Built now because "admin can see who issued what,
 * when, and keep track" needs somewhere to actually see that list.
 * issuedBy/issuedAt (backend-authoritative, see inspection.api.ts) are
 * shown to everyone, not just admins — delete is the only admin-gated
 * action, matching the standalone tool's original permission split.
 *
 * Grouped by vessel, not a flat per-certificate table — requested
 * directly: individual certificates shouldn't surface on their own here,
 * only once a vessel is selected or matched by search, mirroring how
 * VesselSearch.tsx already works. A vessel with no name/IMO on file
 * (shouldn't normally happen, but old/incomplete records exist) falls
 * into its own "(vessel not recorded)" group rather than being hidden.
 */
export default function CertificateLog() {
  const { certificates, syncError, pendingSyncCount, retrySync, deleteCertificate } = useInspections();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const groups = useMemo<VesselGroup[]>(
    () => groupCertificatesByVessel(certificates, search),
    [certificates, search]
  );

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleOpen(certNo: string, type: EquipmentTypeKey) {
    navigate(`/inspections?type=${type}&open=${encodeURIComponent(certNo)}`);
  }

  function handleExportCsv() {
    const rows = groups.flatMap((group) => group.certs);
    exportRowsToCsv(`certificate-log-${new Date().toISOString().slice(0, 10)}`, rows, [
      { header: "Certificate No", value: (c) => c.certNo },
      { header: "Type", value: (c) => INSPECTION_TYPES[c.type]?.typeName || c.type },
      { header: "Vessel", value: (c) => c.vesselName },
      { header: "IMO No", value: (c) => c.imoNo },
      { header: "Status", value: (c) => c.status },
      { header: "Issued By", value: (c) => c.issuedBy || c.savedBy },
      { header: "Issued At", value: (c) => c.issuedAt || c.savedAt },
    ]);
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
            ? "Showing every certificate issued company-wide, grouped by vessel."
            : "Showing only certificates you've issued yourself, grouped by vessel. Contact an administrator if you need to see someone else's."}
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
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Search by vessel, IMO, certificate no., or issuer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "8px 10px", border: "1px solid #C9D1D8", borderRadius: 6, fontSize: 13, minWidth: 320 }}
          />
          <button type="button" className="insp-btn insp-btn-outline" onClick={handleExportCsv} disabled={groups.length === 0}>
            Export CSV
          </button>
        </div>
        <table className="users-table" style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden", border: "1px solid #DCE1E5" }}>
          <thead>
            <tr>
              <th>Vessel</th><th>IMO No.</th><th>Certificates</th><th>Latest Status</th><th>Latest Date</th><th></th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: 24, color: "#6B7480" }}>No certificates yet.</td></tr>
            )}
            {groups.map((group) => {
              const latest = group.certs[0];
              const isOpen = expanded.has(group.key);
              return (
                <Fragment key={group.key}>
                  <tr
                    style={{ cursor: "pointer", background: isOpen ? "#EAF1E7" : undefined }}
                    onClick={() => toggle(group.key)}
                  >
                    <td>{group.vesselName || "(vessel not recorded)"}</td>
                    <td>{group.imoNo || "—"}</td>
                    <td>{group.certs.length}</td>
                    <td>{(latest?.status || "draft").toUpperCase()}</td>
                    <td>{latest?.issuedAt ? new Date(latest.issuedAt).toLocaleString() : latest?.savedAt ? new Date(latest.savedAt).toLocaleString() : "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="insp-btn insp-btn-outline"
                        style={{ padding: "3px 10px", fontSize: 11 }}
                        onClick={(e) => { e.stopPropagation(); toggle(group.key); }}
                      >
                        {isOpen ? "Hide" : "View"}
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={6} style={{ padding: 0, background: "#F8F9FA" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead>
                            <tr style={{ fontSize: 11, color: "var(--insp-muted)" }}>
                              <th style={{ padding: "6px 12px", textAlign: "left" }}>Cert No.</th>
                              <th style={{ padding: "6px 12px", textAlign: "left" }}>Type</th>
                              <th style={{ padding: "6px 12px", textAlign: "left" }}>Status</th>
                              <th style={{ padding: "6px 12px", textAlign: "left" }}>Issued By</th>
                              <th style={{ padding: "6px 12px", textAlign: "left" }}>Issued At</th>
                              <th style={{ padding: "6px 12px", textAlign: "left" }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.certs.map((c) => (
                              <tr key={c.certNo} style={{ borderTop: "1px solid #E4E8EB" }}>
                                <td style={{ padding: "6px 12px" }}>{c.certNo}</td>
                                <td style={{ padding: "6px 12px" }}><span className="insp-badge" style={{ background: "#455A73" }}>{INSPECTION_TYPES[c.type]?.typeName || c.type}</span></td>
                                <td style={{ padding: "6px 12px" }}>{(c.status || "draft").toUpperCase()}</td>
                                <td style={{ padding: "6px 12px" }}>{c.issuedBy || c.savedBy || "—"}{!c.issuedBy && c.savedBy ? " (not yet synced)" : ""}</td>
                                <td style={{ padding: "6px 12px" }}>{c.issuedAt ? new Date(c.issuedAt).toLocaleString() : c.savedAt ? new Date(c.savedAt).toLocaleString() : "—"}</td>
                                <td style={{ padding: "6px 12px" }}>
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
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
