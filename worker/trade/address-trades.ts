import type {
  AddressTradeTarget,
  RawTrade,
  RecentTrade,
  TradeDataset,
  TradeSource,
} from '../../shared/trade.ts'
import { prepareComplexCandidate, prepareTradeDataset } from './matching.ts'
import { toRecentTrade } from './recent.ts'
import { fetchTradeDataset } from './source.ts'
import {
  recentDealYearMonths,
  tradeDatasetKey,
  tradeWindowDates,
} from './window.ts'

const ADDRESS_TRADE_SOURCES = ['apt', 'rowhouse'] as const satisfies
  readonly TradeSource[]
const ADDRESS_TARGET_COMPLEX_ID = 'address-target'
const LEGAL_DONG_CODE_PATTERN = /^\d{10}$/
const TRADE_DATASET_CACHE_KEY_PREFIX = 'trade'
const TRADE_DATASET_CACHE_ORIGIN = 'https://trade-cache.incometax'
const TRADE_DATASET_CACHE_TTL_SECONDS = 24 * 60 * 60
const inFlightDatasets = new Map<
  string,
  Promise<readonly RawTrade[]>
>()

type ReadTradeDataset = (
  dataset: TradeDataset,
  serviceKey: string,
) => Promise<readonly RawTrade[]>

export interface AddressTradeLookupDependencies {
  readonly now?: () => Date
  readonly cache?: Cache
  readonly readDataset?: ReadTradeDataset
}

const defaultCache = (): Cache => {
  const workerCaches = caches as CacheStorage & { readonly default: Cache }
  return workerCaches.default
}

const cacheKey = (dataset: TradeDataset): string =>
  `${TRADE_DATASET_CACHE_KEY_PREFIX}|${tradeDatasetKey(dataset)}`

const cacheRequest = (key: string): Request => {
  const url = new URL('/dataset', TRADE_DATASET_CACHE_ORIGIN)
  url.searchParams.set('key', key)
  return new Request(url)
}

const cacheResponse = (trades: readonly RawTrade[]): Response =>
  Response.json(trades, {
    headers: {
      'cache-control': `public, max-age=${TRADE_DATASET_CACHE_TTL_SECONDS}`,
    },
  })

const readCachedDataset = async (
  dataset: TradeDataset,
  serviceKey: string,
  cache: Cache,
  context: ExecutionContext | undefined,
  readDataset: ReadTradeDataset,
): Promise<readonly RawTrade[]> => {
  const key = cacheKey(dataset)
  const existingRequest = inFlightDatasets.get(key)
  if (existingRequest) return existingRequest

  const request = cacheRequest(key)
  const cached = await cache.match(request)
  if (cached) return cached.json<readonly RawTrade[]>()

  const requestStartedWhileReadingCache = inFlightDatasets.get(key)
  if (requestStartedWhileReadingCache) return requestStartedWhileReadingCache
  if (!serviceKey.trim()) throw new Error('Missing DATA_GO_KR_SERVICE_KEY')

  const pending = readDataset(dataset, serviceKey)
    .then(async (trades) => {
      const cacheWrite = cache.put(request, cacheResponse(trades))
      if (context) context.waitUntil(cacheWrite)
      else await cacheWrite
      return trades
    })
    .finally(() => {
      inFlightDatasets.delete(key)
    })
  inFlightDatasets.set(key, pending)
  return pending
}

const createAddressTradeDatasets = (
  legalDistrictCode: string,
  now: Date,
): readonly TradeDataset[] =>
  recentDealYearMonths(now).flatMap((dealYearMonth) =>
    ADDRESS_TRADE_SOURCES.map((source) => ({
      source,
      legalDistrictCode,
      dealYearMonth,
    })),
  )

export async function lookupAddressTrades(
  target: AddressTradeTarget,
  serviceKey: string,
  context?: ExecutionContext,
  dependencies: AddressTradeLookupDependencies = {},
): Promise<readonly RecentTrade[]> {
  if (!LEGAL_DONG_CODE_PATTERN.test(target.legalDongCode)) {
    throw new TypeError('legalDongCode must be a 10-digit code')
  }

  const now = dependencies.now?.() ?? new Date()
  const datasets = createAddressTradeDatasets(
    target.legalDongCode.slice(0, 5),
    now,
  )
  const cache = dependencies.cache ?? defaultCache()
  const readDataset = dependencies.readDataset ?? ((dataset, key) =>
    fetchTradeDataset(
      dataset.source,
      key,
      dataset.legalDistrictCode,
      dataset.dealYearMonth,
    ))
  const rawTrades: RawTrade[] = []
  for (const dataset of datasets) {
    rawTrades.push(
      ...await readCachedDataset(
        dataset,
        serviceKey,
        cache,
        context,
        readDataset,
      ),
    )
  }

  const candidate = prepareComplexCandidate({
    complexId: ADDRESS_TARGET_COMPLEX_ID,
    name: target.complexName,
    legalAddress: target.jibunAddress,
    legalDongCode: target.legalDongCode,
  })
  const window = tradeWindowDates(now)
  const result = await prepareTradeDataset(
    datasets[0],
    rawTrades,
    [candidate],
    window.cutoffDate,
    window.windowEndDate,
  )
  return result.trades.map(toRecentTrade)
}
