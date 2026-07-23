import { useEffect, useState } from "react";
import { getFinanceSummary } from "../services/finance.api";
import { DashboardSummary } from "../types/finance.types";

// Referenced in the folder structure (hooks/useFinance.ts) but never
// implemented in the chat. Minimal data-fetching hook for the dashboard.
export function useFinance() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getFinanceSummary()
      .then(setSummary)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { summary, loading, error };
}
