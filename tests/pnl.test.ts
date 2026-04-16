import { describe, it, expect } from 'vitest';
import {
  aggregateDailyPnl, pctReturn, trailingPnl,
} from '@/lib/metrics/pnl';
import type { KalshiSettlementRow } from '@/lib/types/db';

function s(settled_time: string, pnl_cents: number): KalshiSettlementRow {
  return {
    account_id: 'acct',
    ticker: 'T',
    market_result: 'yes',
    pnl_cents,
    settled_time,
    origin: 'bot',
  };
}

describe('aggregateDailyPnl', () => {
  it('returns empty array for no settlements', () => {
    expect(aggregateDailyPnl([])).toEqual([]);
  });
  it('groups by UTC date and sums pnl, sorted ascending', () => {
    const rows = [
      s('2026-04-15T00:30:00Z', 200),
      s('2026-04-14T01:00:00Z', 100),
      s('2026-04-14T20:00:00Z', -50),
    ];
    expect(aggregateDailyPnl(rows)).toEqual([
      { date: '2026-04-14', pnlCents: 50 },
      { date: '2026-04-15', pnlCents: 200 },
    ]);
  });
});

describe('pctReturn', () => {
  it('divides cents by exposure', () => {
    expect(pctReturn(500, 10_000)).toBe(0.05);
  });
  it('returns 0 when exposure is 0', () => {
    expect(pctReturn(500, 0)).toBe(0);
  });
  it('returns 0 when exposure is null', () => {
    expect(pctReturn(500, null)).toBe(0);
  });
});

describe('trailingPnl', () => {
  const rows = [
    s('2026-04-10T12:00:00Z', 100),
    s('2026-04-12T12:00:00Z', 200),
    s('2026-04-14T12:00:00Z', 50),
  ];
  it('sums within window inclusive of now', () => {
    expect(trailingPnl(rows, new Date('2026-04-14T23:00:00Z'), 7)).toBe(350);
  });
  it('excludes settlements older than window', () => {
    expect(trailingPnl(rows, new Date('2026-04-14T23:00:00Z'), 2)).toBe(50);
  });
  it('returns 0 when none in window', () => {
    expect(trailingPnl(rows, new Date('2026-05-01T00:00:00Z'), 3)).toBe(0);
  });
});
