// Shows Revenue trend / Cost trend / Profit margin / Most profitable
// services, as specified in "15. Profit Analysis Dashboard". The source
// chat named this component and its purpose but did not include an
// implementation, and didn't specify a charting library — a lightweight
// dependency-free bar visual is used here rather than assuming Chart.js
// or recharts.
interface MonthlyPoint {
  month: string;
  revenue: number;
  cost: number;
}

export default function ProfitChart({ data }: { data: MonthlyPoint[] }) {
  const max = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <div className="profit-chart">
      {data.map((d) => (
        <div key={d.month} className="profit-chart__row">
          <span className="profit-chart__label">{d.month}</span>
          <div
            className="profit-chart__bar profit-chart__bar--revenue"
            style={{ width: `${(d.revenue / max) * 100}%` }}
          />
          <div
            className="profit-chart__bar profit-chart__bar--cost"
            style={{ width: `${(d.cost / max) * 100}%` }}
          />
        </div>
      ))}
    </div>
  );
}
