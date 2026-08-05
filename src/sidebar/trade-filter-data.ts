import type { RecentTrade } from '../../shared/trade'

const AREA_DECIMAL_PLACES = 2

export interface TradeAreaOption {
  readonly key: string
  readonly area: number
  readonly count: number
}

export const tradeAreaKey = (area: number): string =>
  area.toFixed(AREA_DECIMAL_PLACES)

export const availableTradeAreas = (
  trades: readonly RecentTrade[],
): readonly TradeAreaOption[] => {
  const areas = new Map<string, TradeAreaOption>()
  for (const trade of trades) {
    const key = tradeAreaKey(trade.exclusiveArea)
    const current = areas.get(key)
    areas.set(key, {
      key,
      area: current?.area ?? trade.exclusiveArea,
      count: (current?.count ?? 0) + 1,
    })
  }
  return [...areas.values()].sort((left, right) => left.area - right.area)
}

export const defaultTradeAreaKey = (
  options: readonly TradeAreaOption[],
): string => options.reduce<TradeAreaOption | null>((mostFrequent, option) => {
  if (!mostFrequent || option.count > mostFrequent.count) return option
  return mostFrequent
}, null)?.key ?? ''

export const filterTradesByArea = (
  trades: readonly RecentTrade[],
  areaKey: string,
): readonly RecentTrade[] => trades.filter(
  (trade) => tradeAreaKey(trade.exclusiveArea) === areaKey,
)

export const availableTradeYears = (
  trades: readonly RecentTrade[],
): readonly string[] => [...new Set(
  trades.map((trade) => trade.dealDate.slice(0, 4)),
)].sort((left, right) => right.localeCompare(left))
