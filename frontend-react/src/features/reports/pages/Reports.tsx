import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../reports.css";
import { useAuth } from "../../../context/AuthContext";
import { hasPermission, PERM } from "../../auth/types/auth.types";
import { exportRowsToCsv } from "../../../utils/exportCsv";
import { fetchCertificatesSummary, fetchExpiringCertificates, runExpiryRemindersNow } from "../services/reports.api";
import { CertificatesSummary, ExpiringCertificate } from "../types/reports.types";
import MonthlyBarChart from "../components/MonthlyBarChart";

/**
 * Requested directly: "certificate expiry is 1 year period,
 * reporting/analytics, CSV/Excel export." Certificates-side reporting is
 * genuinely new (see backend-fastapi's app/api/routes/reports.py) —
 * finance already has a working revenue dashboard + chart at
 * /finance/dashboard (see FinanceDashboard.tsx/ProfitChart.tsx), which
 * this deliberately links to rather than duplicates.
 *
 * No RequirePermission wrapper on this page's route (see App.tsx) —
 * unlike a page that needs exactly one permission, this one has two
 * independent sections gated on two different permissions (certificates
 * .view_all vs finance.view), and someone could reasonably have only
 * one of them (e.g. Sales has the former, not the latter; the Finance
 * role has the reverse). Each section below decides its own visibility,
 * same pattern as e.g. /account/change-password having no wrapper at all.
 */
export default function Reports() {
  const { user } = useAuth();
  const canViewCertificates = hasPermission(user, PERM.CERT_VIEW_ALL);
  const canViewFinance = hasPermission(user, PERM.FIN_VIEW);
  const isAdmin = user?.role === "admin";

  const [summary, setSummary] = useState<CertificatesSummary | null>(null);
  const [expiring, setExpiring] = useState<ExpiringCertificate[]>([]);
  const [loading, setLoading] = useState(canViewCertificates);
  const [error, setError] = useState<string | null>(null);
  const [runningReminders, setRunningReminders] = useState(false);
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!canViewCertificates) return;
    Promise.all([fetchCertificatesSummary(12), fetchExpiringCertificates()])
      .then(([s, e]) => {
        setSummary(s);
        setExpiring(e);
      })
      .catch((err) => setError(err?.response?.data?.detail || "Could not load certificate reports."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewCertificates]);

  function exportExpiringCsv() {
    exportRowsToCsv(`expiring-certificates-${new Date().toISOString().slice(0, 10)}`, expiring, [
      { header: "Certificate No", value: (r) => r.cert_no },
      { header: "Equipment Type", value: (r) => r.equipment_type },
      { header: "Vessel", value: (r) => r.vessel_name },
      { header: "Date of Servicing", value: (r) => r.date_of_servicing },
      { header: "Expiry Date", value: (r) => r.expiry_date },
      { header: "Days Until Expiry", value: (r) => r.days_until_expiry },
      { header: "Status", value: (r) => (r.overdue ? "Overdue" : "Expiring Soon") },
    ]);
  }

  function exportMonthlyCsv() {
    if (!summary) return;
    exportRowsToCsv(`certificates-issued-by-month-${new Date().toISOString().slice(0, 10)}`, summary.monthly, [
      { header: "Month", value: (r) => r.month },
      { header: "Certificates Issued", value: (r) => r.count },
    ]);
  }

  async function handleRunReminders() {
    setRunningReminders(true);
    setReminderMessage(null);
    try {
      const result = await runExpiryRemindersNow();
      if (result.skipped) {
        setReminderMessage(result.reason || "Reminders are not configured.");
      } else if (result.email_failed) {
        setReminderMessage("Found certificates to remind about, but the email failed to send — will retry automatically.");
      } else {
        setReminderMessage(`Sent a reminder for ${result.reminded} certificate(s).`);
      }
    } catch (err: any) {
      setReminderMessage(err?.response?.data?.detail || "Could not run the reminder check.");
    } finally {
      setRunningReminders(false);
    }
  }

  if (!canViewCertificates && !canViewFinance) {
    return (
      <div className="reports-page">
        <h1>Reports &amp; Analytics</h1>
        <p className="reports-no-access">You don't have access to any reports. Contact your administrator if you believe this is wrong.</p>
      </div>
    );
  }

  return (
    <div className="reports-page">
      <h1>Reports &amp; Analytics</h1>
      <p className="reports-subtitle">HMZC LTD — Marine Engineering Services</p>

      {canViewCertificates && (
        <>
          <section className="reports-section">
            <div className="reports-toolbar">
              <div>
                <h2>Expiring Soon</h2>
                <p className="reports-section-note">
                  Certificates are valid for one year from date of servicing. Shows every finalized certificate
                  expiring within 30 days, and anything already overdue.
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {isAdmin && (
                  <button type="button" className="reports-btn" onClick={handleRunReminders} disabled={runningReminders}>
                    {runningReminders ? "Checking…" : "Send Reminder Emails Now"}
                  </button>
                )}
                <button type="button" className="reports-btn" onClick={exportExpiringCsv} disabled={expiring.length === 0}>
                  Export CSV
                </button>
              </div>
            </div>
            {reminderMessage && <p className="reports-section-note">{reminderMessage}</p>}
            {loading ? (
              <p className="reports-empty">Loading…</p>
            ) : expiring.length === 0 ? (
              <p className="reports-empty">Nothing expiring soon.</p>
            ) : (
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>Certificate No</th>
                    <th>Type</th>
                    <th>Vessel</th>
                    <th>Expiry Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {expiring.map((c) => (
                    <tr key={c.cert_no}>
                      <td>{c.cert_no}</td>
                      <td>{c.equipment_type}</td>
                      <td>{c.vessel_name || "—"}</td>
                      <td>{c.expiry_date}</td>
                      <td>
                        {c.overdue ? (
                          <span className="reports-status-pill overdue">Overdue by {Math.abs(c.days_until_expiry)}d</span>
                        ) : (
                          <span className="reports-status-pill expiring-soon">Expiring in {c.days_until_expiry}d</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="reports-section">
            <div className="reports-toolbar">
              <h2>Certificates Issued (Last 12 Months)</h2>
              <button type="button" className="reports-btn" onClick={exportMonthlyCsv} disabled={!summary}>
                Export CSV
              </button>
            </div>
            {error && <p className="reports-section-note">{error}</p>}
            {loading || !summary ? (
              <p className="reports-empty">Loading…</p>
            ) : (
              <>
                <div className="reports-cards">
                  <div className="reports-card">
                    <div className="reports-card__label">Total Finalized</div>
                    <div className="reports-card__value">{summary.total_finalized}</div>
                  </div>
                </div>
                <MonthlyBarChart points={summary.monthly.map((m) => ({ label: m.month, value: m.count }))} />
                {summary.by_equipment_type.length > 0 && (
                  <>
                    <h3 style={{ fontSize: 13, color: "var(--insp-navy)", margin: "16px 0 8px" }}>By Equipment Type</h3>
                    <MonthlyBarChart
                      points={summary.by_equipment_type.slice(0, 10).map((t) => ({ label: t.equipment_type, value: t.count }))}
                    />
                  </>
                )}
              </>
            )}
          </section>
        </>
      )}

      {canViewFinance && (
        <section className="reports-section">
          <h2>Finance Reports</h2>
          <p className="reports-section-note">
            Revenue trends, outstanding invoices, and pending quotations are on the{" "}
            <Link to="/finance">Finance Dashboard</Link>. Export lists to CSV directly from the{" "}
            <Link to="/finance/quotations">Quotations</Link> and <Link to="/finance/invoices">Invoices</Link> pages.
          </p>
        </section>
      )}
    </div>
  );
}
