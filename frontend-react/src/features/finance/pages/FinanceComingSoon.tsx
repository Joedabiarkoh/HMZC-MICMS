import "../finance.css";

interface Props {
  title: string;
  note: string;
}

/**
 * Payments, Expenses, Job Costing, and Financial Reports all had a
 * fully-built-looking UI (forms, tables, export buttons) wired to
 * backend endpoints that don't exist — GET /finance/payments,
 * /finance/expenses, /finance/job-costing/{job}, /finance/reports/{type}
 * were never implemented server-side. Confirmed directly in a readiness
 * review: clicking anything on these pages either silently did nothing
 * (a .catch(console.error) swallowing the failure) or would throw
 * visibly, and none of the four even imported finance.css, so they'd
 * have rendered unstyled regardless. Unstyled and silently broken is
 * worse than admitting the truth — this replaces all four with the
 * same honest "not built yet" pattern already used for Firefighting
 * Equipment and Loose Gear in the Inspections module
 * (see ../../inspections/pages/ComingSoon.tsx), rather than leaving
 * something that looks finished but doesn't work.
 */
export default function FinanceComingSoon({ title, note }: Props) {
  return (
    <div className="finance-page">
      <h1>{title}</h1>
      <div
        style={{
          margin: "20px 0",
          padding: 24,
          background: "#fff",
          border: "1px dashed var(--insp-line, #DCE1E5)",
          borderRadius: 10,
        }}
      >
        <span className="finance-status-pill draft" style={{ marginBottom: 10, display: "inline-block" }}>
          Coming Soon
        </span>
        <p style={{ color: "#6B7480", fontSize: 13, lineHeight: 1.6, marginBottom: 0 }}>{note}</p>
      </div>
    </div>
  );
}
