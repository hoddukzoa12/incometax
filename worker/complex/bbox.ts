import type { ComplexBboxResponse, ComplexSummary } from '../../shared/complex'
import type { RecentTrade, TradeMatchLevel, TradeSource } from '../../shared/trade'

const BAD_REQUEST_STATUS = 400
const MAXIMUM_COMPLEX_RESULTS = 500
const RESULT_QUERY_LIMIT = MAXIMUM_COMPLEX_RESULTS + 1
const CACHE_CONTROL_VALUE = 'public, max-age=60'

interface Bounds {
  readonly south: number
  readonly west: number
  readonly north: number
  readonly east: number
}

interface ComplexRow {
  readonly complex_id: string
  readonly name: string
  readonly legal_address: string
  readonly road_address: string | null
  readonly legal_dong_code: string
  readonly approval_date: string | null
  readonly building_count: number | null
  readonly household_count: number | null
  readonly lat: number
  readonly lng: number
  readonly latest_trade_id: string | null
  readonly latest_trade_source: TradeSource | null
  readonly latest_trade_match_level: TradeMatchLevel | null
  readonly latest_trade_date: string | null
  readonly latest_trade_amount: number | null
  readonly latest_trade_area: number | null
  readonly latest_trade_floor: number | null
}

const coordinate = (
  searchParams: URLSearchParams,
  name: keyof Bounds,
  minimum: number,
  maximum: number,
): number => {
  const raw = searchParams.get(name)
  if (raw === null || raw.trim() === '') {
    throw new TypeError(`Missing ${name}`)
  }
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new TypeError(`Invalid ${name}`)
  }
  return parsed
}

export const parseBounds = (searchParams: URLSearchParams): Bounds => {
  const bounds = {
    south: coordinate(searchParams, 'south', -90, 90),
    west: coordinate(searchParams, 'west', -180, 180),
    north: coordinate(searchParams, 'north', -90, 90),
    east: coordinate(searchParams, 'east', -180, 180),
  }
  if (bounds.south >= bounds.north) {
    throw new TypeError('south must be less than north')
  }
  if (bounds.west >= bounds.east) {
    throw new TypeError('west must be less than east')
  }
  return bounds
}

const toLatestTrade = (row: ComplexRow): RecentTrade | null => {
  if (
    !row.latest_trade_id ||
    !row.latest_trade_source ||
    !row.latest_trade_match_level ||
    !row.latest_trade_date ||
    row.latest_trade_amount === null ||
    row.latest_trade_area === null
  ) {
    return null
  }
  return {
    tradeId: row.latest_trade_id,
    source: row.latest_trade_source,
    matchLevel: row.latest_trade_match_level,
    dealDate: row.latest_trade_date,
    dealAmount: row.latest_trade_amount,
    exclusiveArea: row.latest_trade_area,
    floor: row.latest_trade_floor,
  }
}

const toSummary = (row: ComplexRow): ComplexSummary => ({
  complexId: row.complex_id,
  name: row.name,
  legalAddress: row.legal_address,
  roadAddress: row.road_address,
  legalDongCode: row.legal_dong_code,
  approvalDate: row.approval_date,
  buildingCount: row.building_count,
  householdCount: row.household_count,
  lat: row.lat,
  lng: row.lng,
  latestTrade: toLatestTrade(row),
})

export const queryComplexes = async (
  database: D1Database,
  bounds: Bounds,
): Promise<ComplexBboxResponse> => {
  const result = await database
    .prepare(
      `SELECT complex.complex_id, complex.name, complex.legal_address,
              complex.road_address, complex.legal_dong_code,
              complex.approval_date, complex.building_count,
              complex.household_count, complex.lat, complex.lng,
              latest.trade_id AS latest_trade_id,
              latest.source AS latest_trade_source,
              latest.match_level AS latest_trade_match_level,
              latest.deal_date AS latest_trade_date,
              latest.deal_amount AS latest_trade_amount,
              latest.exclusive_area AS latest_trade_area,
              latest.floor AS latest_trade_floor
         FROM complex
         LEFT JOIN trade AS latest
           ON latest.trade_id = (
             SELECT candidate.trade_id
               FROM trade AS candidate
              WHERE candidate.complex_id = complex.complex_id
              ORDER BY candidate.deal_date DESC, candidate.trade_id ASC
              LIMIT 1
           )
        WHERE complex.lat BETWEEN ?1 AND ?2
          AND complex.lng BETWEEN ?3 AND ?4
        ORDER BY complex.household_count DESC, complex.complex_id ASC
        LIMIT ?5`,
    )
    .bind(
      bounds.south,
      bounds.north,
      bounds.west,
      bounds.east,
      RESULT_QUERY_LIMIT,
    )
    .all<ComplexRow>()

  const truncated = result.results.length > MAXIMUM_COMPLEX_RESULTS
  return {
    items: result.results.slice(0, MAXIMUM_COMPLEX_RESULTS).map(toSummary),
    truncated,
  }
}

export const handleComplexBbox = async (
  url: URL,
  database: D1Database,
): Promise<Response> => {
  let bounds: Bounds
  try {
    bounds = parseBounds(url.searchParams)
  } catch (error) {
    if (!(error instanceof TypeError)) throw error
    return Response.json(
      { error: error.message },
      { status: BAD_REQUEST_STATUS },
    )
  }
  const result = await queryComplexes(database, bounds)
  return Response.json(result, {
    headers: { 'cache-control': CACHE_CONTROL_VALUE },
  })
}
