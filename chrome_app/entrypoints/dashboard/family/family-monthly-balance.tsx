import { useEffect, useState } from 'react';
import { getBackendMonthlyAccountingSummary } from '../../../lib/family-accounting-backend-client';

type BalanceState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; net: number; currency: string };

/** Display the existing canonical monthly net; never calculate or persist money here. */
export function FamilyMonthlyBalance() {
  const [state, setState] = useState<BalanceState>({ status: 'loading' });
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    let active = true;
    const now = new Date();
    setState({ status: 'loading' });
    getBackendMonthlyAccountingSummary(now.getFullYear(), now.getMonth() + 1)
      .then((summary) => { if (active) setState({ status: 'ready', net: summary.totals.net, currency: summary.currency }); })
      .catch(() => { if (active) setState({ status: 'error' }); });
    return () => { active = false; };
  }, [refreshKey]);
  return (
    <div data-testid="family-monthly-balance" className="mt-4 rounded-xl border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-50" aria-live="polite">
      Баланс операцій поточного місяця:{' '}
      {state.status === 'ready' ? <span className="font-semibold text-amber-100">{state.net.toLocaleString('uk-UA')} {state.currency}</span> : null}
      {state.status === 'loading' ? <span>Завантаження…</span> : null}
      {state.status === 'error' ? <span>Дані недоступні. <button type="button" onClick={() => setRefreshKey((value) => value + 1)} className="underline">Оновити дані</button></span> : null}
    </div>
  );
}
