export interface TradingConfigRow {
  id: string
  account_id: string
  version: number
  status: 'draft' | 'active'
  deployed_at: string | null
  deployed_by: string | null

  // Key Risk Parameters
  daily_loss_limit: number | null
  target_series: string | null
  max_signals_per_run: number | null
  max_position_size: number | null
  max_portfolio_exposure: number | null
  kelly_gate_enabled: boolean | null
  kelly_multiplier: number | null
  hard_price_ceiling_cents: number | null
  allow_duplicate_positions: boolean | null
  certainty_weight_floor: number | null

  // Key Trading Rules
  min_edge: number | null
  min_contracts_per_trade: number | null

  // Probability-Band Admission
  prob_band_high_min: number | null
  prob_band_mid_min: number | null
  prob_band_low_min: number | null
  prob_band_edge_tol_high: number | null
  prob_band_edge_tol_mid: number | null
  prob_band_edge_tol_low: number | null

  // Order Execution
  order_type_priority: string | null
  child_clip_size: number | null
  max_spread_cents: number | null

  // Limit Order Execution
  reprice_wait_seconds: number | null
  reprice_steps: string | null
  reprice_missing_quote_grace_attempts: number | null
  max_fill_latency_seconds: number | null
  fail_safe_enabled: boolean | null
  fail_safe_lookback_runs: number | null
  fail_safe_min_fill_rate: number | null
  fail_safe_min_attempts: number | null

  // Directional Guard
  directional_guard_enabled: boolean | null
  directional_guard_yes_min_bias: number | null
  directional_guard_no_max_bias: number | null

  // Micro Edge
  micro_edge_enabled: boolean | null
  micro_edge_min_score: number | null
  micro_edge_spread_penalty_per_cent: number | null
  micro_edge_thin_book_penalty: number | null
  micro_edge_time_pressure_penalty: number | null

  // Dynamic Edge
  dynamic_edge_enabled: boolean | null
  dynamic_edge_spread_premium: number | null
  dynamic_edge_depth_discount: number | null

  // Entry Window
  entry_window_strict: boolean | null
  entry_window_minutes: number | null

  // Overrides
  target_size_enabled: boolean | null
  target_contracts_per_trade: number | null
  ewma_lambda: number | null
  max_probability_adjustment: number | null

  // Volume / Vol Regime Guard
  volume_regime_enabled: boolean | null
  volume_rvol_spike: number | null
  volume_rvol_elevated: number | null
  volume_rvol_exit: number | null
  vol_ratio_spike: number | null
  vol_ratio_elevated: number | null
  regime_cooldown_minutes: number | null
  regime_recovery_minutes: number | null
  volume_rvol_weekend_spike: number | null

  // High-Volume Execution Guards
  min_top_book_size: number | null
  weak_regime_single_contract_enabled: boolean | null
  weak_regime_spread_cents: number | null
  weak_regime_max_top_book: number | null

  // Overnight Deep ITM
  overnight_deep_itm_enabled: boolean | null
  overnight_deep_itm_min_moneyness_pct: number | null
  overnight_deep_itm_min_edge: number | null
  overnight_deep_itm_min_probability: number | null
  overnight_deep_itm_max_contracts: number | null
  overnight_deep_itm_max_spread_cents: number | null

  // ITM Bias
  itm_bias_enabled: boolean | null
  itm_bias_hours_max: number | null
  itm_bias_spot_buffer_pct: number | null
  itm_bias_max_add: number | null

  created_at: string
  updated_at: string
}

/** Metadata-only columns excluded from config values */
export const CONFIG_META_KEYS = [
  'id', 'account_id', 'version', 'status', 'deployed_at', 'deployed_by',
  'created_at', 'updated_at',
] as const

/** GET /api/bot/config response */
export interface TradingConfigResponse {
  draft: TradingConfigRow
  active: TradingConfigRow | null
}

/** GET /api/bot/config/versions response */
export interface ConfigVersionEntry {
  id: string
  version: number
  config_snapshot: Record<string, unknown>
  diff: Record<string, { from: unknown; to: unknown }> | null
  deployed_by: string
  deployed_at: string
}

/** POST /api/bot/config/deploy response */
export interface DeployResponse {
  version: number
  deployed_at: string
  diff: Record<string, { from: unknown; to: unknown }>
}
