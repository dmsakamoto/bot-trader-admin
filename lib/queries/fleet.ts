import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { computeSharpe } from '@/lib/utils/stats';
import { aggregateDailyPnl, pctReturn, trailingPnl } from '@/lib/metrics/pnl';
import type {
  AccountRow, BotInstanceRow, BotHeartbeatRow, BotControlRow, KalshiSettlementRow,
} from '@/lib/types/db';
import type { TradingConfigRow } from '@/lib/types/tradingConfig';

export interface FleetRow {
  account: AccountRow;
  instance: BotInstanceRow | null;
  heartbeat: BotHeartbeatRow | null;
  control: BotControlRow | null;
  config: TradingConfigRow | null;
  todayPnlCents: number;
  todayPctReturn: number;
  sharpe7d: number | null;
  configMismatch: boolean;
}

export async function getFleetOverview(): Promise<FleetRow[]> {
  const db = createServiceClient();
  const now = new Date();
  const sevenDaysAgoIso = new Date(now.getTime() - 8 * 86_400_000).toISOString();

  const [accounts, instances, heartbeats, controls, configs, settlements] = await Promise.all([
    db.from('accounts').select('*').returns<AccountRow[]>(),
    db.from('bot_instances').select('*').returns<BotInstanceRow[]>(),
    db.from('bot_heartbeat')
      .select('*')
      .order('timestamp', { ascending: false })
      .returns<BotHeartbeatRow[]>(),
    db.from('bot_control').select('*').returns<BotControlRow[]>(),
    // IMPORTANT: bot_trading_config has 2 rows per account (draft + active).
    // We always want the deployed config. Filter by status='active'.
    db.from('bot_trading_config').select('*').eq('status', 'active').returns<TradingConfigRow[]>(),
    // Include both 'bot' and 'pending' origins to match bundle endpoint behavior
    // (cron-synced settlements land as 'pending' until the next bot sync).
    db.from('kalshi_settlements')
      .select('*')
      .in('origin', ['bot', 'pending'])
      .gte('settled_time', sevenDaysAgoIso)
      .returns<KalshiSettlementRow[]>(),
  ]);

  for (const q of [accounts, instances, heartbeats, controls, configs, settlements]) {
    if (q.error) throw q.error;
  }

  const latestHeartbeat = new Map<string, BotHeartbeatRow>();
  for (const hb of heartbeats.data ?? []) {
    if (!latestHeartbeat.has(hb.account_id)) latestHeartbeat.set(hb.account_id, hb);
  }
  const instanceByAccount = new Map((instances.data ?? []).map((i) => [i.account_id, i]));
  const controlByAccount = new Map((controls.data ?? []).map((c) => [c.account_id, c]));
  const configByAccount = new Map((configs.data ?? []).map((c) => [c.account_id, c]));
  const settlementsByAccount = new Map<string, KalshiSettlementRow[]>();
  for (const s of settlements.data ?? []) {
    const arr = settlementsByAccount.get(s.account_id) ?? [];
    arr.push(s); settlementsByAccount.set(s.account_id, arr);
  }

  return (accounts.data ?? []).map<FleetRow>((account) => {
    const hb = latestHeartbeat.get(account.id) ?? null;
    const cfg = configByAccount.get(account.id) ?? null;
    const settle = settlementsByAccount.get(account.id) ?? [];
    const todayPnlCents = trailingPnl(settle, now, 1);
    const exposure = cfg?.max_portfolio_exposure ?? 0;
    const daily = aggregateDailyPnl(settle);
    // Sharpe takes daily P&L in cents (per bot-trader-web's stats.ts).
    const sharpe7d = computeSharpe(daily.map((d) => d.pnlCents));
    const actualVersion = hb?.config_snapshot?.version ?? null;
    const configMismatch =
      cfg != null && actualVersion != null && cfg.version !== actualVersion;
    return {
      account,
      instance: instanceByAccount.get(account.id) ?? null,
      heartbeat: hb,
      control: controlByAccount.get(account.id) ?? null,
      config: cfg,
      todayPnlCents,
      todayPctReturn: pctReturn(todayPnlCents, exposure),
      sharpe7d,
      configMismatch,
    };
  });
}
