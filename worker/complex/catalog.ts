import type {
  ComplexLookupStatus,
  ComplexStagingRecord,
} from '../../shared/complex'
import {
  COMPLEX_NOT_FOUND_MESSAGE,
  decodeComplexId,
  INVALID_COMPLEX_ID_MESSAGE,
} from './request'

const BAD_REQUEST_STATUS = 400
const NOT_FOUND_STATUS = 404
const MAXIMUM_SEARCH_RESULTS = 20
const MAXIMUM_SEARCH_QUERY_LENGTH = 100

interface ComplexCatalogRow {
  readonly complex_id: string
  readonly name: string
  readonly legal_address: string
  readonly road_address: string | null
  readonly legal_dong_code: string
  readonly approval_date: string | null
  readonly building_count: number | null
  readonly household_count: number | null
  readonly lat: number | null
  readonly lng: number | null
  readonly place_url: string | null
  readonly lookup_status: Exclude<ComplexLookupStatus, 'pending'>
  readonly backfill_reason: string | null
}

const SELECT_COMPLEX_FIELDS = `complex_id, name, legal_address, road_address,
  legal_dong_code, approval_date, building_count, household_count, lat, lng,
  place_url, lookup_status, backfill_reason`

const toComplexRecord = (row: ComplexCatalogRow): ComplexStagingRecord => ({
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
  placeUrl: row.place_url,
  lookupStatus: row.lookup_status,
  backfillReason: row.backfill_reason,
})

const escapeLikePattern = (value: string): string =>
  value.replace(/[\\%_]/g, '\\$&')

const WHITESPACE_PATTERN = /\s+/gu

/**
 * 띄어쓰기를 지운다. 주소는 `서울 강남구 삼성동 189` 로 저장돼 있는데 사람은
 * `삼성동189` 로도 친다. 저장된 띄어쓰기를 정확히 맞혀야만 찾히면 안 된다.
 *
 * 검색어와 컬럼 양쪽에 같은 정규화를 걸어야 두 표기가 **같은 순서**로 나온다.
 * 한쪽만 걸면 결과는 나오는데 순위가 달라진다.
 */
const withoutWhitespace = (value: string): string =>
  value.replace(WHITESPACE_PATTERN, '')

/** SQL 안에서 같은 정규화를 하는 식. 컬럼마다 되풀이되므로 한 곳에서 만든다. */
const squashed = (column: string): string => `REPLACE(${column}, ' ', '')`

const NAME = squashed('name')
const LEGAL_ADDRESS = squashed('legal_address')
const ROAD_ADDRESS = squashed(`COALESCE(road_address, '')`)

export const searchComplexes = async (
  database: D1Database,
  query: string,
): Promise<readonly ComplexStagingRecord[]> => {
  const needle = withoutWhitespace(query)
  const escaped = escapeLikePattern(needle)
  const prefixPattern = `${escaped}%`
  const containsPattern = `%${escaped}%`
  const result = await database.prepare(
    `SELECT ${SELECT_COMPLEX_FIELDS}
      FROM complex
      WHERE lookup_status != 'pending'
        AND (
          ${NAME} LIKE ?1 ESCAPE '\\'
          OR ${LEGAL_ADDRESS} LIKE ?1 ESCAPE '\\'
          OR ${ROAD_ADDRESS} LIKE ?1 ESCAPE '\\'
        )
      ORDER BY CASE
                 WHEN ${NAME} = ?2 THEN 0
                 WHEN ${LEGAL_ADDRESS} = ?2 OR ${ROAD_ADDRESS} = ?2 THEN 1
                 WHEN ${NAME} LIKE ?3 ESCAPE '\\' THEN 2
                 WHEN ${NAME} LIKE ?1 ESCAPE '\\' THEN 3
                 WHEN ${LEGAL_ADDRESS} LIKE ?3 ESCAPE '\\'
                   OR ${ROAD_ADDRESS} LIKE ?3 ESCAPE '\\' THEN 4
                 ELSE 5
               END,
               household_count IS NULL,
               household_count DESC,
               name ASC,
               complex_id ASC
      LIMIT ?4`,
  ).bind(
    containsPattern,
    needle,
    prefixPattern,
    MAXIMUM_SEARCH_RESULTS,
  ).all<ComplexCatalogRow>()
  return result.results.map(toComplexRecord)
}

export const findComplex = async (
  database: D1Database,
  complexId: string,
): Promise<ComplexStagingRecord | null> => {
  const row = await database.prepare(
    `SELECT ${SELECT_COMPLEX_FIELDS}
       FROM complex
      WHERE complex_id = ?1
        AND lookup_status != 'pending'`,
  ).bind(complexId).first<ComplexCatalogRow>()
  return row ? toComplexRecord(row) : null
}

export const handleComplexSearch = async (
  url: URL,
  database: D1Database,
): Promise<Response> => {
  const query = url.searchParams.get('q')?.trim() ?? ''
  if (!query || query.length > MAXIMUM_SEARCH_QUERY_LENGTH) {
    return Response.json(
      { error: '검색어는 1자 이상 100자 이하여야 합니다.' },
      { status: BAD_REQUEST_STATUS },
    )
  }
  return Response.json(await searchComplexes(database, query), {
    headers: { 'cache-control': 'public, max-age=60' },
  })
}

export const handleComplexDetail = async (
  database: D1Database,
  encodedComplexId: string,
): Promise<Response> => {
  const complexId = decodeComplexId(encodedComplexId)
  if (!complexId) {
    return Response.json(
      { error: INVALID_COMPLEX_ID_MESSAGE },
      { status: BAD_REQUEST_STATUS },
    )
  }
  const result = await findComplex(database, complexId)
  if (!result) {
    return Response.json(
      { error: COMPLEX_NOT_FOUND_MESSAGE },
      { status: NOT_FOUND_STATUS },
    )
  }
  return Response.json(result, {
    headers: { 'cache-control': 'public, max-age=300' },
  })
}
