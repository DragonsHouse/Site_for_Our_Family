export function money(value: number | null | undefined, currency = 'USD') {
  return value == null ? '-' : `${value.toLocaleString('uk-UA')} ${currency}`;
}

export function date(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString('uk-UA') : '-';
}

export function SummaryCard({ label, value }: { label: string; value: string }) {
  return <div className="dh-card rounded-2xl p-4"><div className="text-sm text-slate-500">{label}</div><div className="mt-1 text-xl font-semibold text-white">{value}</div></div>;
}
