export type VarType = 'int' | 'float' | 'boolean' | 'enum' | 'text'

export interface TradingVar {
  key: string
  label: string
  type: VarType
  unit?: string
  min?: number
  max?: number
  step?: number
  options?: string[]
  description?: string
  fullWidth?: boolean
}

export interface VarGroup {
  id: string
  label: string
  vars: TradingVar[]
}

export const TRADING_CONFIG_SCHEMA: VarGroup[] = [
  {
    id: 'key_risk',
    label: 'Key Risk Parameters',
    vars: [
      { key: 'daily_loss_limit', label: 'Daily Loss Limit', type: 'int', unit: 'cents', min: 1, description: 'Max daily loss in cents before bot stops trading' },
      { key: 'target_series', label: 'Target Series', type: 'enum', options: ['ALL', 'BTC', 'ETH'] },
      { key: 'max_signals_per_run', label: 'Max Signals Per Run', type: 'int', min: 1, description: 'Max signals to evaluate per bot loop' },
      { key: 'max_position_size', label: 'Max Position Size', type: 'int', unit: 'cents', min: 1, description: 'Max size of a single position. Must be ≤ Max Portfolio Exposure.' },
      { key: 'max_portfolio_exposure', label: 'Max Portfolio Exposure', type: 'int', unit: 'cents', min: 1, description: 'Max total portfolio exposure across all positions' },
      { key: 'kelly_gate_enabled', label: 'Kelly Gate Enabled', type: 'boolean' },
      { key: 'kelly_multiplier', label: 'Kelly Multiplier', type: 'float', min: 0.0, max: 1.0, step: 0.05, description: 'Fraction of Kelly criterion to use for sizing' },
      { key: 'hard_price_ceiling_cents', label: 'Hard Price Ceiling', type: 'int', unit: 'cents', min: 1, max: 99 },
      { key: 'allow_duplicate_positions', label: 'Allow Duplicate Positions', type: 'boolean' },
      { key: 'certainty_weight_floor', label: 'Certainty Weight Floor', type: 'float', min: 0.0, max: 1.0, step: 0.05 },
    ],
  },
  {
    id: 'key_trading',
    label: 'Key Trading Rules',
    vars: [
      { key: 'min_edge', label: 'Min Edge', type: 'float', min: -0.10, max: 0.10, step: 0.01 },
      { key: 'min_contracts_per_trade', label: 'Min Contracts Per Trade', type: 'int', min: 1 },
    ],
  },
  {
    id: 'prob_band',
    label: 'Probability-Band Admission',
    vars: [
      { key: 'prob_band_high_min', label: 'High Band Min Probability', type: 'float', min: 0.01, max: 1.0, step: 0.01 },
      { key: 'prob_band_edge_tol_high', label: 'High Band Edge Tolerance', type: 'float', min: -0.10, max: 0.0, step: 0.01, description: 'Most strict (most negative). Must be ≤ Mid tolerance.' },
      { key: 'prob_band_mid_min', label: 'Mid Band Min Probability', type: 'float', min: 0.01, max: 1.0, step: 0.01 },
      { key: 'prob_band_edge_tol_mid', label: 'Mid Band Edge Tolerance', type: 'float', min: -0.10, max: 0.0, step: 0.01 },
      { key: 'prob_band_low_min', label: 'Low Band Min Probability', type: 'float', min: 0.01, max: 1.0, step: 0.01 },
      { key: 'prob_band_edge_tol_low', label: 'Low Band Edge Tolerance', type: 'float', min: -0.10, max: 0.0, step: 0.01, description: 'Least strict (closest to 0). Must be ≥ Mid tolerance.' },
    ],
  },
  {
    id: 'order_exec',
    label: 'Order Execution',
    vars: [
      { key: 'order_type_priority', label: 'Order Type Priority', type: 'enum', options: ['MARKET', 'LIMIT'] },
      { key: 'child_clip_size', label: 'Child Clip Size', type: 'int', unit: 'contracts', min: 1 },
      { key: 'max_spread_cents', label: 'Max Spread', type: 'int', unit: 'cents', min: 1 },
    ],
  },
  {
    id: 'limit_order',
    label: 'Limit Order Execution',
    vars: [
      { key: 'reprice_wait_seconds', label: 'Reprice Wait', type: 'int', unit: 'seconds', min: 1 },
      { key: 'reprice_steps', label: 'Reprice Steps', type: 'text', description: 'Comma-separated non-negative integers, e.g. 0,2,4,6,8' },
      { key: 'reprice_missing_quote_grace_attempts', label: 'Missing Quote Grace Attempts', type: 'int', min: 0 },
      { key: 'max_fill_latency_seconds', label: 'Max Fill Latency', type: 'int', unit: 'seconds', min: 1 },
      { key: 'fail_safe_enabled', label: 'Fail-Safe Enabled', type: 'boolean' },
      { key: 'fail_safe_lookback_runs', label: 'Fail-Safe Lookback Runs', type: 'int', min: 1 },
      { key: 'fail_safe_min_fill_rate', label: 'Fail-Safe Min Fill Rate', type: 'float', min: 0.0, max: 1.0, step: 0.01 },
      { key: 'fail_safe_min_attempts', label: 'Fail-Safe Min Attempts', type: 'int', min: 1 },
    ],
  },
  {
    id: 'directional_guard',
    label: 'Directional Guard',
    vars: [
      { key: 'directional_guard_enabled', label: 'Directional Guard Enabled', type: 'boolean' },
      { key: 'directional_guard_yes_min_bias', label: 'Yes Min Bias', type: 'float', step: 0.01 },
      { key: 'directional_guard_no_max_bias', label: 'No Max Bias', type: 'float', step: 0.01 },
    ],
  },
  {
    id: 'micro_edge',
    label: 'Micro Edge',
    vars: [
      { key: 'micro_edge_enabled', label: 'Micro Edge Enabled', type: 'boolean' },
      { key: 'micro_edge_min_score', label: 'Min Score', type: 'float', min: 0.0, step: 0.001 },
      { key: 'micro_edge_spread_penalty_per_cent', label: 'Spread Penalty Per Cent', type: 'float', min: 0.0, step: 0.0001 },
      { key: 'micro_edge_thin_book_penalty', label: 'Thin Book Penalty', type: 'float', min: 0.0, step: 0.001 },
      { key: 'micro_edge_time_pressure_penalty', label: 'Time Pressure Penalty', type: 'float', min: 0.0, step: 0.001 },
    ],
  },
  {
    id: 'dynamic_edge',
    label: 'Dynamic Edge',
    vars: [
      { key: 'dynamic_edge_enabled', label: 'Dynamic Edge Enabled', type: 'boolean' },
      { key: 'dynamic_edge_spread_premium', label: 'Spread Premium', type: 'float', min: 0.0, step: 0.001 },
      { key: 'dynamic_edge_depth_discount', label: 'Depth Discount', type: 'float', min: 0.0, step: 0.001 },
    ],
  },
  {
    id: 'entry_window',
    label: 'Entry Window',
    vars: [
      { key: 'entry_window_strict', label: 'Strict Entry Window', type: 'boolean' },
      { key: 'entry_window_minutes', label: 'Entry Window', type: 'int', unit: 'minutes', min: 1 },
    ],
  },
  {
    id: 'itm_bias',
    label: 'ITM Bias',
    vars: [
      { key: 'itm_bias_enabled', label: 'ITM Bias Enabled', type: 'boolean', description: 'Enable/disable ITM probability bias adjustment' },
      { key: 'itm_bias_hours_max', label: 'Hours Max', type: 'int', unit: 'hours', min: 1, description: 'Apply ITM bias only within this many hours of expiry' },
      { key: 'itm_bias_spot_buffer_pct', label: 'Spot Buffer', type: 'float', min: 0.0, max: 0.10, step: 0.005, unit: '%', description: 'Spot must be this far ITM to apply bias (fraction of strike)' },
      { key: 'itm_bias_max_add', label: 'Max Probability Boost', type: 'float', min: 0.0, max: 0.10, step: 0.005, description: 'Maximum probability boost from ITM bias' },
    ],
  },
  {
    id: 'overrides',
    label: 'Overrides',
    vars: [
      { key: 'target_size_enabled', label: 'Target Size Enabled', type: 'boolean' },
      { key: 'target_contracts_per_trade', label: 'Target Contracts Per Trade', type: 'int', min: 1 },
      { key: 'ewma_lambda', label: 'EWMA Lambda', type: 'float', min: 0.01, max: 0.99, step: 0.01, description: 'Exponential weighting for vol estimation. Strictly between 0 and 1.' },
      { key: 'max_probability_adjustment', label: 'Max Probability Adjustment', type: 'float', min: 0.01, max: 1.0, step: 0.01 },
    ],
  },
  {
    id: 'volume_regime',
    label: 'Volume / Vol Regime Guard',
    vars: [
      { key: 'volume_regime_enabled', label: 'Volume Regime Enabled', type: 'boolean', fullWidth: true },
      { key: 'regime_cooldown_minutes', label: 'Regime Cooldown', type: 'int', unit: 'minutes', min: 1 },
      { key: 'regime_recovery_minutes', label: 'Recovery Period', type: 'int', unit: 'minutes', min: 1, description: 'After cooldown expires, trade at half size with tighter edge for this many minutes before returning to normal' },
      { key: 'volume_rvol_elevated', label: 'RVol Elevated Threshold', type: 'float', min: 0.01, step: 0.1 },
      { key: 'vol_ratio_elevated', label: 'Vol Ratio Elevated', type: 'float', min: 0.01, step: 0.1 },
      { key: 'volume_rvol_spike', label: 'RVol Spike Threshold', type: 'float', min: 0.01, step: 0.1 },
      { key: 'vol_ratio_spike', label: 'Vol Ratio Spike', type: 'float', min: 0.01, step: 0.1 },
      { key: 'volume_rvol_exit', label: 'RVol Exit Threshold', type: 'float', min: 0.01, step: 0.1 },
      { key: 'volume_rvol_weekend_spike', label: 'RVol Weekend Spike', type: 'float', min: 0.01, step: 0.1 },
    ],
  },
  {
    id: 'high_volume',
    label: 'High-Volume Execution Guards',
    vars: [
      { key: 'min_top_book_size', label: 'Min Top Book Size', type: 'int', min: 0 },
      { key: 'weak_regime_single_contract_enabled', label: 'Weak Regime Single Contract', type: 'boolean' },
      { key: 'weak_regime_spread_cents', label: 'Weak Regime Spread', type: 'int', unit: 'cents', min: 0 },
      { key: 'weak_regime_max_top_book', label: 'Weak Regime Max Top Book', type: 'int', min: 0 },
    ],
  },
  {
    id: 'overnight_itm',
    label: 'Overnight Deep ITM',
    vars: [
      { key: 'overnight_deep_itm_enabled', label: 'Overnight Deep ITM Enabled', type: 'boolean' },
      { key: 'overnight_deep_itm_min_moneyness_pct', label: 'Min Moneyness', type: 'float', min: 0.01, max: 1.0, step: 0.01, unit: '%' },
      { key: 'overnight_deep_itm_min_edge', label: 'Min Edge', type: 'float', min: 0.01, max: 1.0, step: 0.01 },
      { key: 'overnight_deep_itm_min_probability', label: 'Min Probability', type: 'float', min: 0.01, max: 1.0, step: 0.01 },
      { key: 'overnight_deep_itm_max_contracts', label: 'Max Contracts', type: 'int', min: 1 },
      { key: 'overnight_deep_itm_max_spread_cents', label: 'Max Spread', type: 'int', unit: 'cents', min: 1 },
    ],
  },
]

/** All config variable keys (for iteration/validation) */
export const ALL_CONFIG_KEYS = TRADING_CONFIG_SCHEMA.flatMap(g => g.vars.map(v => v.key))

/** Total number of config variables */
export const TOTAL_CONFIG_VARS = ALL_CONFIG_KEYS.length

/** Look up a variable definition by key */
export function getVarDef(key: string): TradingVar | undefined {
  for (const group of TRADING_CONFIG_SCHEMA) {
    const found = group.vars.find(v => v.key === key)
    if (found) return found
  }
  return undefined
}

/** Validate a single value against its schema definition. Returns error string or null. */
export function validateVar(key: string, value: unknown): string | null {
  const def = getVarDef(key)
  if (!def) return `Unknown variable: ${key}`

  if (value === null || value === undefined) return null // NULLs allowed in draft

  if (def.type === 'boolean') {
    if (typeof value !== 'boolean') return `${def.label} must be true or false`
    return null
  }

  if (def.type === 'enum') {
    if (!def.options?.includes(String(value))) return `${def.label} must be one of: ${def.options?.join(', ')}`
    return null
  }

  if (def.type === 'text') {
    if (typeof value !== 'string') return `${def.label} must be text`
    // Validate reprice_steps format
    if (key === 'reprice_steps') {
      const parts = String(value).split(',')
      for (const p of parts) {
        const n = Number(p.trim())
        if (!Number.isInteger(n) || n < 0) return `${def.label} must be comma-separated non-negative integers`
      }
    }
    return null
  }

  // int or float
  const num = Number(value)
  if (!Number.isFinite(num)) return `${def.label} must be a finite number`

  if (def.type === 'int' && !Number.isInteger(num)) return `${def.label} must be an integer`

  if (def.min !== undefined && num < def.min) return `${def.label} must be ≥ ${def.min}`
  if (def.max !== undefined && num > def.max) return `${def.label} must be ≤ ${def.max}`

  return null
}

/** Cross-field validation. Returns array of error strings. */
export function validateCrossField(config: Record<string, unknown>): string[] {
  const errors: string[] = []
  const pos = config.max_position_size as number | null
  const port = config.max_portfolio_exposure as number | null
  if (pos != null && port != null && pos > port) {
    errors.push('Max Position Size must be ≤ Max Portfolio Exposure')
  }

  const tolHigh = config.prob_band_edge_tol_high as number | null
  const tolMid = config.prob_band_edge_tol_mid as number | null
  const tolLow = config.prob_band_edge_tol_low as number | null
  if (tolHigh != null && tolMid != null && tolHigh > tolMid) {
    errors.push('High Band Edge Tolerance must be ≤ Mid Band Edge Tolerance')
  }
  if (tolMid != null && tolLow != null && tolMid > tolLow) {
    errors.push('Mid Band Edge Tolerance must be ≤ Low Band Edge Tolerance')
  }

  return errors
}
