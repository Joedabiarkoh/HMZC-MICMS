interface FinanceCardProps {
  label: string;
  value: string;
}

export default function FinanceCard({ label, value }: FinanceCardProps) {
  return (
    <div className="finance-card">
      <p className="finance-card__label">{label}</p>
      <h2 className="finance-card__value">{value}</h2>
    </div>
  );
}
