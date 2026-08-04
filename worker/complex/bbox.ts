import type { ComplexBboxResponse, ComplexSummary } from '../../shared/complex'

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
  readonly building_count: number
  readonly household_count: number
  readonly lat: number
  readonly lng: number
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
})

export const queryComplexes = async (
  database: D1Database,
  bounds: Bounds,
): Promise<ComplexBboxResponse> => {
  const result = await database
    .prepare(
      `SELECT complex_id, name, legal_address, road_address,
              legal_dong_code, approval_date, building_count,
              household_count, lat, lng
         FROM complex
        WHERE lat BETWEEN ?1 AND ?2
          AND lng BETWEEN ?3 AND ?4
        ORDER BY household_count DESC, complex_id ASC
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
