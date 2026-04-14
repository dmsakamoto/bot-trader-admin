import type { AccountDetail } from '@/lib/queries/account';

const fmtCents = (c: number) => `$${(c / 100).toFixed(2)}`;
const fmtPct = (p: number) => `${(p * 100).toFixed(2)}%`;

function Card({ label, cents, pct }: { label: string; cents: number; pct: number }) {
  const pos = cents >= 0;
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="text-xs uppercase text-neutral-500">{label}</div>
      <div className={`text-xl font-semibold ${pos ? 'text-green-300' : 'text-red-300'}`}>
        {fmtCents(cents)}
      </div>
      <div className="text-xs text-neutral-400">{fmtPct(pct)}</div>
    </div>
  );
}

export function PerformanceCards({ d }: { d: AccountDetail }) {
  return (
    <div className="grid grid-cols-5 gap-4">
      <Card label="Today P&L" cents={d.today.cents} pct={d.today.pct} />
      <Card label="7d P&L" cents={d.week.cents} pct={d.week.pct} />
      <Card label="30d P&L" cents={d.month.cents} pct={d.month.pct} />
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
        <div className="text-xs uppercase text-neutral-500">7d Sharpe</div>
        <div className="text-xl font-semibold">{d.sharpe7d?.toFixed(2) ?? '—'}</div>
      </div>
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
        <div className="text-xs uppercase text-neutral-500">30d Sharpe</div>
        <div className="text-xl font-semibold">{d.sharpe30d?.toFixed(2) ?? '—'}</div>
      </div>
    </div>
  );
}
