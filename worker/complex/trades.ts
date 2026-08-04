import type {
  ComplexTradesResponse,
  RecentTrade,
  TradeMatchLevel,
  TradeSource,
} from '../../shared/trade'

const BAD_REQUEST_STATUS = 400
const NOT_FOUND_STATUS = 404
const DEFAULT_RECENT_TRADE_LIMIT = 20
const MAXIMUM_RECENT_TRADE_LIMIT = 100
const CACHE_CONTROL_VALUE = 'public, max-age=300'
const COMPLEX_NOT_FOUND_MESSAGE = '단지를 찾을 수 없습니다.'

type RecentTradeRow = {
  readonly complex_id: string
  readonly trade_id: string | null
  readonly source: TradeSource | null
  readonly match_level: TradeMatchLevel | null
  readonly deal_date: string | null
  readonly deal_amount: number | null
  readonly exclusive_area: number | null
  readonly floor: number | null
}

const parseLimit = (searchParams: URLSearchParams): number => {
  const raw = searchParams.get('limit')
  if (raw === null) return DEFAULT_RECENT_TRADE_LIMIT
  const value = Number(raw)
  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAXIMUM_RECENT_TRADE_LIMIT
  ) {
    throw new TypeError('Invalid limit')
  }
  return value
}

const toRecentTrade = (row: RecentTradeRow): RecentTrade | null => {
  if (
    !row.trade_id ||
    !row.source ||
    !row.match_level ||
    !row.deal_date ||
    row.deal_amount === null ||
    row.exclusive_area === null
  ) {
    return null
  }
  return {
    tradeId: row.trade_id,
    source: row.source,
    matchLevel: row.match_level,
    dealDate: row.deal_date,
    dealAmount: row.deal_amount,
    exclusiveArea: row.exclusive_area,
    floor: row.floor,
  }
}

export const queryRecentTrades = async (
  database: D1Database,
  complexId: string,
  limit: number,
): Promise<ComplexTradesResponse | null> => {
  const result = await database
    .prepare(
      `SELECT complex.complex_id, trade.trade_id, trade.source,
              trade.match_level, trade.deal_date, trade.deal_amount,
              trade.exclusive_area, trade.floor
         FROM complex
         LEFT JOIN trade ON trade.complex_id = complex.complex_id
        WHERE complex.complex_id = ?1
        ORDER BY trade.deal_date DESC, trade.trade_id ASC
        LIMIT ?2`,
    )
    .bind(complexId, limit)
    .all<RecentTradeRow>()
  const first = result.results[0]
  if (!first) return null
  return {
    complexId: first.complex_id,
    items: result.results
      .map(toRecentTrade)
      .filter((trade): trade is RecentTrade => trade !== null),
  }
}

export const handleComplexTrades = async (
  url: URL,
  database: D1Database,
  encodedComplexId: string,
): Promise<Response> => {
  let complexId: string
  let limit: number
  try {
    complexId = decodeURIComponent(encodedComplexId).trim()
    if (!complexId) throw new TypeError('Invalid complex id')
    limit = parseLimit(url.searchParams)
  } catch (error) {
    if (!(error instanceof TypeError || error instanceof URIError)) throw error
    return Response.json(
      { error: error.message },
      { status: BAD_REQUEST_STATUS },
    )
  }

  const result = await queryRecentTrades(database, complexId, limit)
  if (!result) {
    return Response.json(
      { error: COMPLEX_NOT_FOUND_MESSAGE },
      { status: NOT_FOUND_STATUS },
    )
  }
  return Response.json(result, {
    headers: { 'cache-control': CACHE_CONTROL_VALUE },
  })
}
