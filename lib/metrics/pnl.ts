import type { KalshiSettlementRow } from '@/lib/types/db';
import type { DailyPnl } from '@/lib/metrics/types';

function isoDate(utc: Date): string {
  return utc.toISOString().slice(0, 10);
}

export function aggregateDailyPnl(settlements: KalshiSettlementRow[]): DailyPnl[] {
  const byDate = new Map<string, number>();
  for (const s of settlements) {
    const d = isoDate(new Date(s.settled_time));
    byDate.set(d, (byDate.get(d) ?? 0) + s.pnl_cents);
  }
  return [...byDate.keys()].sort().map((date) => ({ date, pnlCents: byDate.get(date)! }));
}

export function pctReturn(pnlCents: number, exposureCents: number | null | undefined): number {
  if (!exposureCents) return 0;
  return pnlCents / exposureCents;
}

export function trailingPnl(
  settlements: KalshiSettlementRow[],
  now: Date,
  days: number,
): number {
  const cutoff = now.getTime() - days * 86_400_000;
  const nowMs = now.getTime();
  return settlements
    .filter((s) => {
      const t = new Date(s.settled_time).getTime();
      return t >= cutoff && t <= nowMs;
    })
    .reduce((acc, s) => acc + s.pnl_cents, 0);
}
