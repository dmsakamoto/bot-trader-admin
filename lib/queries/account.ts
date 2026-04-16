import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { computeSharpe } from '@/lib/utils/stats';
import { aggregateDailyPnl, pctReturn, trailingPnl } from '@/lib/metrics/pnl';
import type {
  AccountRow, BotInstanceRow, BotHeartbeatRow, BotControlRow,
  BotConfigVersionRow, KalshiFillRow, KalshiSettlementRow, MarketScanRow,
} from '@/lib/types/db';
import type { TradingConfigRow } from '@/lib/types/tradingConfig';
import type { DailyPnl } from '@/lib/metrics/types';

export interface AccountDetail {
  account: AccountRow;
  instance: BotInstanceRow | null;
  latestHeartbeat: BotHeartbeatRow | null;
  control: BotControlRow | null;
  activeConfig: TradingConfigRow | null;
  versions: BotConfigVersionRow[];
  heartbeats: BotHeartbeatRow[];         // last 50
  scans: MarketScanRow[];                // last 100
  fills: KalshiFillRow[];                // last 50
  settlements: KalshiSettlementRow[];    // last 50 (also drives metrics below)
  daily30: DailyPnl[];                   // last 30 days (cents-only, derive % at render)
  today: { cents: number; pct: number };
  week: { cents: number; pct: number };
  month: { cents: number; pct: number };
  sharpe7d: number | null;
  sharpe30d: number | null;
}

export async function getAccountDetail(accountId: string): Promise<AccountDetail | null> {
  const db = createServiceClient();
  const now = new Date();
  const thirtyOneDaysAgoIso = new Date(now.getTime() - 31 * 86_400_000).toISOString();

  const [account, instance, control, activeConfig, versions, heartbeats, scans, fills, settlements] =
    await Promise.all([
      db.from('accounts').select('*').eq('id', accountId).single<AccountRow>(),
      db.from('bot_instances').select('*').eq('account_id', accountId).maybeSingle<BotInstanceRow>(),
      db.from('bot_control').select('*').eq('account_id', accountId).maybeSingle<BotControlRow>(),
      // Filter to the deployed row — draft/active model means 2 rows per account.
      db.from('bot_trading_config').select('*').eq('account_id', accountId)
        .eq('status', 'active').maybeSingle<TradingConfigRow>(),
      db.from('bot_config_versions').select('*').eq('account_id', accountId)
        .order('deployed_at', { ascending: false }).limit(100).returns<BotConfigVersionRow[]>(),
      db.from('bot_heartbeat').select('*').eq('account_id', accountId)
        .order('timestamp', { ascending: false }).limit(50).returns<BotHeartbeatRow[]>(),
      db.from('market_scans').select('*').eq('account_id', accountId)
        .order('timestamp', { ascending: false }).limit(100).returns<MarketScanRow[]>(),
      db.from('kalshi_fills').select('*').eq('account_id', accountId)
        .order('created_time', { ascending: false }).limit(50).returns<KalshiFillRow[]>(),
      db.from('kalshi_settlements').select('*').eq('account_id', accountId)
        .in('origin', ['bot', 'pending'])
        .gte('settled_time', thirtyOneDaysAgoIso)
        .order('settled_time', { ascending: false }).returns<KalshiSettlementRow[]>(),
    ]);

  if (account.error) {
    if (account.error.code === 'PGRST116') return null; // not found
    throw account.error;
  }

  const settlementRows = settlements.data ?? [];
  const exposure = activeConfig.data?.max_portfolio_exposure ?? 0;
  const daily30 = aggregateDailyPnl(settlementRows);

  const todayC = trailingPnl(settlementRows, now, 1);
  const weekC = trailingPnl(settlementRows, now, 7);
  const monthC = trailingPnl(settlementRows, now, 30);

  const last7Cents = daily30.slice(-7).map((d) => d.pnlCents);
  const sharpe7d = computeSharpe(last7Cents);
  const sharpe30d = computeSharpe(daily30.map((d) => d.pnlCents));

  return {
    account: account.data,
    instance: instance.data ?? null,
    control: control.data ?? null,
    activeConfig: activeConfig.data ?? null,
    versions: versions.data ?? [],
    heartbeats: heartbeats.data ?? [],
    scans: scans.data ?? [],
    fills: fills.data ?? [],
    settlements: settlementRows.slice(0, 50),
    latestHeartbeat: (heartbeats.data ?? [])[0] ?? null,
    daily30,
    today: { cents: todayC, pct: pctReturn(todayC, exposure) },
    week: { cents: weekC, pct: pctReturn(weekC, exposure) },
    month: { cents: monthC, pct: pctReturn(monthC, exposure) },
    sharpe7d,
    sharpe30d,
  };
}
