import type {
  ComplexMatchCandidate,
  ComplexTradesResponse,
  RawTrade,
  RecentTrade,
  StagedTrade,
  TradeDataset,
} from '../../shared/trade'
import { prepareComplexCandidate, prepareTradeDataset } from './matching'
import { fetchTradeDataset } from './source'
import { recentDealYearMonths, tradeWindowDates } from './window'

const APARTMENT_TRADE_SOURCE = 'apt'
const TRADE_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1_000
const TRADE_LOOKUP_CONCURRENCY = 4

export interface ComplexTradeTarget extends ComplexMatchCandidate {
  readonly tradeCachedAt: string | null
}

export interface ComplexTradeStore {
  findTarget(complexId: string): Promise<ComplexTradeTarget | null>
  readTrades(complexId: string): Promise<readonly RecentTrade[]>
  replaceTrades(
    complexId: string,
    trades: readonly StagedTrade[],
    cachedAt: string,
  ): Promise<void>
}

export interface ComplexTradeLookupDependencies {
  readonly now?: () => Date
  readonly readDataset?: (
    dataset: TradeDataset,
    serviceKey: string,
  ) => Promise<readonly RawTrade[]>
  readonly log?: (message: string) => void
}

const validCachedAt = (cachedAt: string | null, now: Date): boolean => {
  if (!cachedAt) return false
  const cachedTime = Date.parse(cachedAt)
  return Number.isFinite(cachedTime) &&
    now.getTime() - cachedTime < TRADE_CACHE_MAX_AGE_MS
}

const matchingRate = (matchedCount: number, activeCount: number): string =>
  activeCount === 0
    ? '0.00'
    : ((matchedCount / activeCount) * 100).toFixed(2)

const toRecentTrade = (trade: StagedTrade): RecentTrade => ({
  tradeId: trade.tradeId,
  source: trade.source,
  matchLevel: trade.matchLevel,
  dealDate: trade.dealDate,
  dealAmount: trade.dealAmount,
  exclusiveArea: trade.exclusiveArea,
  floor: trade.floor,
})

const loadDatasets = async (
  datasets: readonly TradeDataset[],
  serviceKey: string,
  readDataset: NonNullable<ComplexTradeLookupDependencies['readDataset']>,
): Promise<readonly RawTrade[]> => {
  const trades: RawTrade[] = []
  for (
    let offset = 0;
    offset < datasets.length;
    offset += TRADE_LOOKUP_CONCURRENCY
  ) {
    const batch = await Promise.all(
      datasets
        .slice(offset, offset + TRADE_LOOKUP_CONCURRENCY)
        .map((dataset) => readDataset(dataset, serviceKey)),
    )
    trades.push(...batch.flat())
  }
  return trades
}

export async function lookupComplexTrades(
  store: ComplexTradeStore,
  complexId: string,
  serviceKey: string,
  dependencies: ComplexTradeLookupDependencies = {},
): Promise<ComplexTradesResponse | null> {
  const now = dependencies.now?.() ?? new Date()
  dependencies.log?.(`실거래가 캐시 확인 ${complexId}`)
  const target = await store.findTarget(complexId)
  if (!target) return null
  dependencies.log?.(
    `실거래가 캐시 상태 ${complexId} cached=${String(
      validCachedAt(target.tradeCachedAt, now),
    )}`,
  )

  if (validCachedAt(target.tradeCachedAt, now)) {
    return { complexId, items: await store.readTrades(complexId) }
  }
  if (!serviceKey.trim()) throw new Error('Missing DATA_GO_KR_SERVICE_KEY')

  const legalDistrictCode = target.legalDongCode.slice(0, 5)
  const dealYearMonths = recentDealYearMonths(now)
  const readDataset = dependencies.readDataset ?? ((dataset, key) =>
    fetchTradeDataset(
      dataset.source,
      key,
      dataset.legalDistrictCode,
      dataset.dealYearMonth,
    ))
  const datasets = dealYearMonths.map((dealYearMonth) => ({
    source: APARTMENT_TRADE_SOURCE,
    legalDistrictCode,
    dealYearMonth,
  }) satisfies TradeDataset)
  const rawTrades = await loadDatasets(datasets, serviceKey, readDataset)
  dependencies.log?.(
    `실거래가 원천 조회 완료 ${complexId} rows=${rawTrades.length}`,
  )
  const window = tradeWindowDates(now)
  const result = await prepareTradeDataset(
    datasets[0],
    rawTrades,
    [prepareComplexCandidate(target)],
    window.cutoffDate,
    window.windowEndDate,
  )
  const cachedAt = now.toISOString()
  dependencies.log?.(
    `실거래가 매칭 완료 ${complexId} matched=${result.trades.length}`,
  )
  await store.replaceTrades(complexId, result.trades, cachedAt)

  dependencies.log?.(
    [
      `실거래가 온디맨드 조회 ${complexId}`,
      `raw=${result.stats.rawCount}`,
      `active=${result.stats.activeCount}`,
      `matched=${result.stats.matchedCount}`,
      `matchRate=${matchingRate(
        result.stats.matchedCount,
        result.stats.activeCount,
      )}%`,
      `canceled=${result.stats.canceledCount}`,
      `unmatched=${result.stats.unmatchedCount}`,
    ].join(' '),
  )
  return {
    complexId,
    items: result.trades.map(toRecentTrade),
  }
}
