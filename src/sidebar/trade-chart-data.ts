import type { RecentTrade, YearlyTradeAverage } from '../../shared/trade'

export const yearlyTradeAverages = (
  trades: readonly RecentTrade[],
): readonly YearlyTradeAverage[] => {
  const totals = new Map<string, { amount: number; count: number }>()
  for (const trade of trades) {
    const year = trade.dealDate.slice(0, 4)
    const current = totals.get(year) ?? { amount: 0, count: 0 }
    current.amount += trade.dealAmount
    current.count += 1
    totals.set(year, current)
  }
  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([year, total]) => ({
      year,
      averageAmount: Math.round(total.amount / total.count),
      tradeCount: total.count,
    }))
}
