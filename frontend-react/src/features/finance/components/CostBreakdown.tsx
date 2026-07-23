interface CostBreakdownProps {
  labour: number;
  parts: number;
  travel: number;
  other?: number;
}

export default function CostBreakdown({
  labour,
  parts,
  travel,
  other = 0,
}: CostBreakdownProps) {
  const total = labour + parts + travel + other;
  return (
    <div className="cost-breakdown">
      <p>Labour: ${labour.toLocaleString()}</p>
      <p>Parts: ${parts.toLocaleString()}</p>
      <p>Travel: ${travel.toLocaleString()}</p>
      {other > 0 && <p>Other: ${other.toLocaleString()}</p>}
      <p className="cost-breakdown__total">Total Cost: ${total.toLocaleString()}</p>
    </div>
  );
}
