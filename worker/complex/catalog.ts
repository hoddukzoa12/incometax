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

export const searchComplexes = async (
  database: D1Database,
  query: string,
): Promise<readonly ComplexStagingRecord[]> => {
  const escaped = escapeLikePattern(query)
  const prefixPattern = `${escaped}%`
  const containsPattern = `%${escaped}%`
  const result = await database.prepare(
    `SELECT ${SELECT_COMPLEX_FIELDS}
      FROM complex
      WHERE lookup_status != 'pending'
        AND (
          name LIKE ?1 ESCAPE '\\'
          OR legal_address LIKE ?1 ESCAPE '\\'
          OR COALESCE(road_address, '') LIKE ?1 ESCAPE '\\'
        )
      ORDER BY CASE
                 WHEN name = ?2 THEN 0
                 WHEN legal_address = ?2 OR road_address = ?2 THEN 1
                 WHEN name LIKE ?3 ESCAPE '\\' THEN 2
                 WHEN name LIKE ?1 ESCAPE '\\' THEN 3
                 WHEN legal_address LIKE ?3 ESCAPE '\\'
                   OR road_address LIKE ?3 ESCAPE '\\' THEN 4
                 ELSE 5
               END,
               household_count IS NULL,
               household_count DESC,
               name ASC,
               complex_id ASC
      LIMIT ?4`,
  ).bind(
    containsPattern,
    query,
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
