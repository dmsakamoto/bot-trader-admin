import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { aggregateDailyPnl, pctReturn, trailingPnl } from '@/lib/metrics/pnl';
import { computeSharpe } from '@/lib/utils/stats';
import type { AccountRow, KalshiSettlementRow } from '@/lib/types/db';
import type { TradingConfigRow } from '@/lib/types/tradingConfig';

export interface ConfigSummaryRow {
  account: AccountRow;
  config: TradingConfigRow | null;
  weekPct: number;
  monthPct: number;
  sharpe7d: number | null;
}

export async function getConfigSummary(): Promise<ConfigSummaryRow[]> {
  const db = createServiceClient();
  const now = new Date();
  const thirtyOneDaysAgoIso = new Date(now.getTime() - 31 * 86_400_000).toISOString();

  const [accounts, configs, settlements] = await Promise.all([
    db.from('accounts').select('*').returns<AccountRow[]>(),
    db.from('bot_trading_config').select('*').eq('status', 'active').returns<TradingConfigRow[]>(),
    db.from('kalshi_settlements').select('*')
      .in('origin', ['bot', 'pending'])
      .gte('settled_time', thirtyOneDaysAgoIso).returns<KalshiSettlementRow[]>(),
  ]);
  for (const q of [accounts, configs, settlements]) if (q.error) throw q.error;

  const cfgByAccount = new Map((configs.data ?? []).map((c) => [c.account_id, c]));
  const settlementsByAccount = new Map<string, KalshiSettlementRow[]>();
  for (const s of settlements.data ?? []) {
    const arr = settlementsByAccount.get(s.account_id) ?? [];
    arr.push(s); settlementsByAccount.set(s.account_id, arr);
  }

  return (accounts.data ?? []).map<ConfigSummaryRow>((account) => {
    const cfg = cfgByAccount.get(account.id) ?? null;
    const settle = settlementsByAccount.get(account.id) ?? [];
    const exposure = cfg?.max_portfolio_exposure ?? 0;
    const daily = aggregateDailyPnl(settle);
    const last7Cents = daily.slice(-7).map((d) => d.pnlCents);
    return {
      account, config: cfg,
      weekPct: pctReturn(trailingPnl(settle, now, 7), exposure),
      monthPct: pctReturn(trailingPnl(settle, now, 30), exposure),
      sharpe7d: computeSharpe(last7Cents),
    };
  });
}
