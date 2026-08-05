import type {
  ComplexLookupStatus,
  ComplexStagingRecord,
} from '../../shared/complex'

const COMPLEX_SEARCH_ENDPOINT = '/api/complexes/search'
const SEARCH_LOOKUP_STATUSES = new Set<ComplexLookupStatus>([
  'matched',
  'notFound',
  'rejected',
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const nullableString = (value: unknown): boolean =>
  value === null || typeof value === 'string'

const nullableNumber = (value: unknown): boolean =>
  value === null || (typeof value === 'number' && Number.isFinite(value))

export const isComplexRecord = (value: unknown): value is ComplexStagingRecord => {
  if (!isRecord(value)) return false
  return typeof value.complexId === 'string' &&
    typeof value.name === 'string' &&
    typeof value.legalAddress === 'string' &&
    nullableString(value.roadAddress) &&
    typeof value.legalDongCode === 'string' &&
    nullableString(value.approvalDate) &&
    nullableNumber(value.buildingCount) &&
    nullableNumber(value.householdCount) &&
    nullableNumber(value.lat) &&
    nullableNumber(value.lng) &&
    typeof value.lookupStatus === 'string' &&
    SEARCH_LOOKUP_STATUSES.has(value.lookupStatus as ComplexLookupStatus) &&
    nullableString(value.backfillReason)
}

export async function fetchComplexSearch(
  query: string,
  signal: AbortSignal,
): Promise<readonly ComplexStagingRecord[]> {
  const url = new URL(COMPLEX_SEARCH_ENDPOINT, window.location.origin)
  url.searchParams.set('q', query)
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Complex search failed: ${response.status}`)
  const body: unknown = await response.json()
  if (!Array.isArray(body) || !body.every(isComplexRecord)) {
    throw new TypeError('Complex search response is invalid')
  }
  return body
}
