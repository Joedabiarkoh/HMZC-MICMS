interface Payment {
  invoice: string;
  amount: number;
  status: "PAID" | "PARTIAL" | "OVERDUE" | string;
}

interface PaymentStatusProps {
  payments: Payment[];
}

export default function PaymentStatus({ payments }: PaymentStatusProps) {
  return (
    <table className="finance-table">
      <thead>
        <tr>
          <th>Invoice</th>
          <th>Amount</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {payments.map((p) => (
          <tr key={p.invoice}>
            <td>{p.invoice}</td>
            <td>${p.amount.toLocaleString()}</td>
            <td className={`status status--${p.status.toLowerCase()}`}>
              {p.status}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
