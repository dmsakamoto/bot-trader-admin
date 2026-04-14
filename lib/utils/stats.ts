/** Annualized Sharpe ratio from daily P&L values (in cents). */
export function computeSharpe(dailyReturns: number[]): number | null {
  if (dailyReturns.length < 2) return null
  const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length
  const variance =
    dailyReturns.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (dailyReturns.length - 1)
  const std = Math.sqrt(variance)
  if (std === 0) return null
  return (mean / std) * Math.sqrt(252)
}
