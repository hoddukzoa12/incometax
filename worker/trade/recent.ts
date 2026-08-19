import type { RecentTrade, StagedTrade } from '../../shared/trade.ts'

export const toRecentTrade = (trade: StagedTrade): RecentTrade => ({
  tradeId: trade.tradeId,
  source: trade.source,
  matchLevel: trade.matchLevel,
  dealDate: trade.dealDate,
  dealAmount: trade.dealAmount,
  exclusiveArea: trade.exclusiveArea,
  floor: trade.floor,
})
