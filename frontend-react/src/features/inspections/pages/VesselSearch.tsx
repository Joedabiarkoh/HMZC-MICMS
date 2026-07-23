import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../inspections.css";
import { listVessels, vesselLookup, VesselSummary, VesselHistoryEntry } from "../services/inspection.api";
import { INSPECTION_TYPES } from "../data/inspectionChecklists";
import { useAuth } from "../../../context/AuthContext";
import { hasPermission, PERM } from "../../auth/types/auth.types";

/**
 * Requested directly: a vessel search structured like CRALOG's Inspections
 * filter (a search bar, summary stat tiles, a results table) — search or
 * browse vessels first, then from a selected vessel choose between
 * starting a new inspection or reviewing everything already done for it,
 * instead of the old flow where a vessel only ever came up incidentally
 * while already filling in a new certificate's Statement form.
 *
 * CRALOG's own filter bar has fields this project doesn't track anywhere
 * (Flag, Owner, Class, Employment, Period, State) — a real ship registry's
 * fields, not something HMZC's own certificate records carry. Copying
 * those inputs in without any backing data would just be dead UI, so the
 * filter here is scoped to what's actually queryable: vessel name / IMO
 * (free-text, matches either), mirrored against the same fields
 * list_vessels (api/routes/certificates.py) actually filters on.
 */
export default function VesselSearch() {
  const [query, setQuery] = useState("");
  const [vessels, setVessels] = useState<VesselSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selected, setSelected] = useState<VesselSummary | null>(null);
  const [history, setHistory] = useState<VesselHistoryEntry[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = hasPermission(user, PERM.CERT_EDIT);

  function search(q: string) {
    setLoading(true);
    setErr("");
    listVessels(q.trim() || undefined)
      .then(setVessels)
      .catch((e) => setErr(e?.response?.data?.detail || "Could not load vessels."))
      .finally(() => setLoading(false));
  }

  useEffect(() => search(""), []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    search(query);
  }

  async function selectVessel(v: VesselSummary) {
    setSelected(v);
    setHistory(null);
    setHistoryLoading(true);
    try {
      const result = await vesselLookup(v.imo_no || "", v.vessel_name || "");
      setHistory(result.history);
    } finally {
      setHistoryLoading(false);
    }
  }

  function startNewInspectionFor(v: VesselSummary) {
    const params = new URLSearchParams();
    if (v.vessel_name) params.set("vesselName", v.vessel_name);
    if (v.imo_no) params.set("imoNo", v.imo_no);
    params.set("type", v.last_equipment_type);
    navigate(`/inspections?${params.toString()}`);
  }

  const uniqueVessels = vessels.length;
  const totalCertificates = vessels.reduce((sum, v) => sum + v.certificate_count, 0);

  return (
    <div className="inspections-page">
      <div className="insp-topbar">
        <div>
          <h1>Vessels</h1>
          <p>Search a vessel to start a new inspection or review its certificate history.</p>
        </div>
      </div>

      <div style={{ padding: "0 20px" }}>
        <form onSubmit={handleSubmit} style={{ background: "#F4F6F7", border: "1px solid #DCE1E5", borderRadius: 8, padding: 16, marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="insp-field" style={{ flex: "1 1 280px", margin: 0 }}>
            <label>Vessel Name or IMO No.</label>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Ocean Star or 9811000" />
          </div>
          <button className="insp-btn insp-btn-primary" type="submit" style={{ width: "auto", padding: "9px 20px" }} disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </button>
          {query && (
            <button
              type="button"
              className="insp-btn insp-btn-outline"
              style={{ width: "auto", padding: "9px 16px" }}
              onClick={() => { setQuery(""); search(""); }}
            >
              Clear
            </button>
          )}
        </form>

        <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
          <StatTile label="Unique Vessels" value={uniqueVessels} />
          <StatTile label="Total Certificates" value={totalCertificates} />
        </div>

        {err && <div className="auth-error">{err}</div>}

        {!loading && !err && vessels.length === 0 && (
          <p style={{ color: "var(--insp-muted)" }}>No vessels found{query ? ` matching "${query}"` : ""}.</p>
        )}

        {!loading && vessels.length > 0 && (
          <table className="users-table" style={{ marginBottom: 20 }}>
            <thead>
              <tr>
                <th>Vessel Name</th>
                <th>IMO No.</th>
                <th>Certificates</th>
                <th>Last Serviced</th>
                <th>Last Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {vessels.map((v) => (
                <tr
                  key={`${v.vessel_name || ""}|${v.imo_no || ""}`}
                  style={{ cursor: "pointer", background: selected === v ? "#EAF1E7" : undefined }}
                  onClick={() => selectVessel(v)}
                >
                  <td>{v.vessel_name || "—"}</td>
                  <td>{v.imo_no || "—"}</td>
                  <td>{v.certificate_count}</td>
                  <td>{v.last_date_of_servicing || "—"}</td>
                  <td style={{ textTransform: "capitalize" }}>{v.last_status}</td>
                  <td>
                    <button
                      type="button"
                      className="insp-btn insp-btn-outline"
                      style={{ padding: "3px 10px", fontSize: 11 }}
                      onClick={(e) => { e.stopPropagation(); selectVessel(v); }}
                    >
                      Select
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {selected && (
          <div style={{ background: "#F4F6F7", border: "1px solid #DCE1E5", borderRadius: 8, padding: 18, marginBottom: 30 }}>
            <h2 style={{ marginTop: 0 }}>{selected.vessel_name || "(no name on file)"} {selected.imo_no ? `— IMO ${selected.imo_no}` : ""}</h2>
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              {canEdit && (
                <button className="insp-btn insp-btn-primary" style={{ width: "auto", padding: "9px 18px" }} onClick={() => startNewInspectionFor(selected)}>
                  + Start New Inspection
                </button>
              )}
              <span style={{ alignSelf: "center", fontSize: 12, color: "var(--insp-muted)" }}>
                {historyLoading ? "Loading previous inspections..." : `${history?.length ?? 0} previous inspection${(history?.length ?? 0) === 1 ? "" : "s"} for this vessel`}
              </span>
            </div>

            {!historyLoading && history && history.length > 0 && (
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid #DCE1E5" }}>
                    <th style={{ padding: "4px 6px" }}>Cert No.</th>
                    <th style={{ padding: "4px 6px" }}>Type</th>
                    <th style={{ padding: "4px 6px" }}>Status</th>
                    <th style={{ padding: "4px 6px" }}>Date</th>
                    <th style={{ padding: "4px 6px" }}>Issued By</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} style={{ borderTop: "1px solid #DCE1E5" }}>
                      <td style={{ padding: "4px 6px" }}>{h.cert_no}</td>
                      <td style={{ padding: "4px 6px" }}>{INSPECTION_TYPES[h.equipment_type as keyof typeof INSPECTION_TYPES]?.typeName || h.equipment_type}</td>
                      <td style={{ padding: "4px 6px", textTransform: "capitalize" }}>{h.status}</td>
                      <td style={{ padding: "4px 6px" }}>{h.date_of_servicing || "—"}</td>
                      <td style={{ padding: "4px 6px" }}>{h.issued_by?.full_name || h.issued_by?.email || "—"}</td>
                      <td style={{ padding: "4px 6px" }}>
                        <button
                          type="button"
                          className="insp-btn insp-btn-outline"
                          style={{ padding: "2px 8px", fontSize: 10.5 }}
                          onClick={() => navigate(`/inspections?type=${h.equipment_type}&open=${encodeURIComponent(h.cert_no)}`)}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #DCE1E5", borderRadius: 8, padding: "12px 20px", minWidth: 160 }}>
      <div style={{ fontSize: 11, color: "var(--insp-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: "var(--insp-navy)" }}>{value}</div>
    </div>
  );
}
