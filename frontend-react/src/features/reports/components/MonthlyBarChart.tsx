interface Point {
  label: string;
  value: number;
}

/**
 * Single-series magnitude bar chart — one hue (brand navy), horizontal
 * bars (label + proportional width), a native-title hover tooltip
 * showing the exact value, and an always-visible data table underneath
 * so the numbers are never locked inside a visual-only chart. Kept
 * dependency-free, matching this app's existing chart (see
 * features/finance/components/ProfitChart.tsx) rather than introducing
 * a charting library for two small reports.
 */
export default function MonthlyBarChart({ points, unit = "" }: { points: Point[]; unit?: string }) {
  const max = Math.max(...points.map((p) => p.value), 1);

  if (points.every((p) => p.value === 0)) {
    return <p className="reports-empty">No data yet for this period.</p>;
  }

  return (
    <div>
      <div className="reports-bar-chart" role="img" aria-label="Bar chart — see the table below for exact values">
        {points.map((p) => (
          <div key={p.label} className="reports-bar-row" title={`${p.label}: ${p.value.toLocaleString()}${unit}`}>
            <span className="reports-bar-label">{p.label}</span>
            <div className="reports-bar-track">
              <div className="reports-bar-fill" style={{ width: `${(p.value / max) * 100}%` }} />
            </div>
            <span className="reports-bar-value">{p.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
      <details className="reports-table-toggle">
        <summary>View as table</summary>
        <table className="reports-table reports-table--compact">
          <thead>
            <tr>
              <th>Period</th>
              <th style={{ textAlign: "right" }}>Count</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.label}>
                <td>{p.label}</td>
                <td style={{ textAlign: "right", fontFamily: "monospace" }}>{p.value.toLocaleString()}{unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
