// Minimal DB row shapes for tables NOT covered by lib/types/tradingConfig.ts.
// If a column is missing when a task needs it, add it here and commit alongside
// the task that needs it. Keep this in sync with the Supabase schema.

export type Uuid = string;
export type Timestamp = string; // ISO 8601 string as returned by supabase-js

export interface AccountRow {
  id: Uuid;
  user_id: Uuid;
  label: string | null;
  first_name: string | null;
  last_name: string | null;
  created_at: Timestamp;
}

export type InstanceStatus = 'running' | 'stopped' | 'error' | 'provisioning';

export interface BotInstanceRow {
  id: Uuid;
  account_id: Uuid;
  ip_address: string | null;
  provider: string | null;
  region: string | null;
  status: InstanceStatus;
  server_label: string | null;
  created_at: Timestamp;
}

export type BotStatus = 'running' | 'scan_only' | 'stopped';
export type VolumeRegime = 'NORMAL' | 'ELEVATED' | 'SPIKE' | 'COOLDOWN' | 'RECOVERY';

export interface BotHeartbeatRow {
  id: number;
  account_id: Uuid;
  timestamp: Timestamp;
  status: BotStatus;
  volume_regime: VolumeRegime | null;
  signals_detected: number;
  open_exposure_cents: number;
  daily_pnl_cents: number | null;
  fail_safe_status: string | null;
  fail_safe_reason: string | null;
  config_snapshot: { version: number | null; [key: string]: unknown } | null;
}

export interface BotControlRow {
  id?: Uuid;
  account_id: Uuid;
  kill_switch: boolean;
  kill_switch_set_by?: string | null;
  kill_switch_set_at?: Timestamp | null;
  updated_at: Timestamp;
}

// Alias for the version audit row — lib/types/tradingConfig.ts's ConfigVersionEntry
// models the API response; this one models the Supabase row.
export interface BotConfigVersionRow {
  id: Uuid;
  account_id: Uuid;
  version: number;
  deployed_at: Timestamp;
  deployed_by: string | null;
  config_snapshot: Record<string, unknown>;
  diff: Record<string, { from: unknown; to: unknown }> | null;
}

export type Origin = 'bot' | 'owner' | 'pending';

export interface KalshiFillRow {
  fill_id: string;
  account_id: Uuid;
  ticker: string;
  side: 'yes' | 'no';
  action: 'buy' | 'sell';
  contracts: number;
  yes_price_cents: number;
  no_price_cents: number;
  fee_cents: number;
  created_time: Timestamp;
  origin: Origin | null;
}

export interface KalshiSettlementRow {
  account_id: Uuid;
  ticker: string;
  market_result: string;
  pnl_cents: number;
  settled_time: Timestamp;
  origin: Origin | null;
}

export interface MarketScanRow {
  id: number;
  account_id: Uuid;
  ticker: string;
  timestamp: Timestamp;
  signal_side: 'yes' | 'no' | null;
  edge: number | null;
  fair_value: number | null;
  base_fair_value: number | null;
  micro_edge_score: number | null;
  dynamic_edge_floor: number | null;
  gate_result: 'passed' | 'rejected' | null;
  gate_values: Record<string, unknown> | null;
  closest_failing_gate: string | null;
}

export type AlertType =
  | 'stale_heartbeat'
  | 'daily_loss'
  | 'kill_switch'
  | 'sync_failure';

export interface AlertLogRow {
  id: Uuid;
  account_id: Uuid;
  created_at: Timestamp;
  alert_type: AlertType;
  details: Record<string, unknown>;
}
