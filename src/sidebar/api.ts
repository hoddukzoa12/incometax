import type { ComplexStagingRecord } from '../../shared/complex'
import type { ComplexTradesResponse, RecentTrade } from '../../shared/trade'
import {
  OFFICIAL_PRICE_FAILURE_KINDS,
  type ApartmentUnitOption,
  type ApartmentUnitOptionsResult,
  type ComplexOfficialPriceRequest,
  type OfficialPriceFailureKind,
  type OfficialPriceLookupResult,
  type OfficialPriceNoDataReason,
} from '../../shared/official-price'
import { SIDEBAR_MESSAGES } from '../messages/sidebar'
import { isComplexRecord } from '../search/api'

const complexDetailEndpoint = (complexId: string): string =>
  `/api/complexes/${encodeURIComponent(complexId)}`

const complexTradesEndpoint = (complexId: string): string =>
  `/api/complexes/${encodeURIComponent(complexId)}/trades`

const complexOfficialPriceEndpoint = (complexId: string): string =>
  `/api/complexes/${encodeURIComponent(complexId)}/official-price`

const complexUnitOptionsEndpoint = (complexId: string, dong?: string): string => {
  const url = new URL(
    `/api/complexes/${encodeURIComponent(complexId)}/unit-options`,
    window.location.origin,
  )
  if (dong) url.searchParams.set('dong', dong)
  return url.toString()
}

const CLIENT_FETCHER: typeof fetch = (input, init) =>
  globalThis.fetch(input, init)

const OFFICIAL_PRICE_FAILURE_KIND_SET = new Set<OfficialPriceFailureKind>(
  OFFICIAL_PRICE_FAILURE_KINDS,
)

const OFFICIAL_PRICE_NO_DATA_REASONS = new Set<OfficialPriceNoDataReason>([
  'addressNotFound',
  'complexNotFound',
  'dongNotFound',
  'roomNotFound',
  'priceNotFound',
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export class InvalidSidebarApiResponseError extends Error {
  override readonly name = 'InvalidSidebarApiResponseError'
}

const isRecentTrade = (value: unknown): value is RecentTrade => {
  if (!isRecord(value)) return false
  return typeof value.tradeId === 'string' &&
    value.source === 'apt' &&
    (value.matchLevel === 'lot' || value.matchLevel === 'candidate') &&
    typeof value.dealDate === 'string' &&
    typeof value.dealAmount === 'number' &&
    Number.isSafeInteger(value.dealAmount) &&
    typeof value.exclusiveArea === 'number' &&
    (value.floor === null || Number.isInteger(value.floor))
}

const isTradesResponse = (value: unknown): value is ComplexTradesResponse =>
  isRecord(value) &&
  typeof value.complexId === 'string' &&
  Array.isArray(value.items) &&
  value.items.every(isRecentTrade)

const isUnitOption = (value: unknown): value is ApartmentUnitOption =>
  isRecord(value) && typeof value.code === 'string' && typeof value.name === 'string'

const isUnitOptionsResult = (
  value: unknown,
): value is ApartmentUnitOptionsResult => {
  if (!isRecord(value) || typeof value.key !== 'string') return false
  if (value.status === 'noData') {
    return value.reason === 'addressNotFound' ||
      value.reason === 'complexNotFound' ||
      value.reason === 'dongNotFound'
  }
  if (value.status === 'failed') {
    return isRecord(value.failure) &&
      typeof value.failure.kind === 'string' &&
      OFFICIAL_PRICE_FAILURE_KIND_SET.has(
        value.failure.kind as OfficialPriceFailureKind,
      ) &&
      typeof value.failure.message === 'string' &&
      typeof value.failure.retryable === 'boolean'
  }
  if (value.status !== 'found' || !isRecord(value.value)) return false
  return typeof value.value.pnu === 'string' &&
    Array.isArray(value.value.dongs) &&
    value.value.dongs.every(isUnitOption) &&
    Array.isArray(value.value.rooms) &&
    value.value.rooms.every(isUnitOption)
}

const isOfficialPriceResult = (value: unknown): value is OfficialPriceLookupResult => {
  if (!isRecord(value) || typeof value.key !== 'string') return false
  if (value.status === 'noData') {
    return typeof value.reason === 'string' &&
      OFFICIAL_PRICE_NO_DATA_REASONS.has(
        value.reason as OfficialPriceNoDataReason,
      )
  }
  if (value.status === 'failed') {
    return isRecord(value.failure) &&
      typeof value.failure.kind === 'string' &&
      OFFICIAL_PRICE_FAILURE_KIND_SET.has(
        value.failure.kind as OfficialPriceFailureKind,
      ) &&
      typeof value.failure.message === 'string' &&
      typeof value.failure.retryable === 'boolean'
  }
  if (value.status !== 'found' || !isRecord(value.value)) return false
  return value.value.assetKind === 'apartment' &&
    typeof value.value.pnu === 'string' &&
    typeof value.value.detailAddress === 'string' &&
    Array.isArray(value.value.items) &&
    value.value.items.every((item) =>
      isRecord(item) &&
      typeof item.baseDate === 'string' &&
      typeof item.price === 'number' &&
      (item.exclusiveArea === null || typeof item.exclusiveArea === 'number'))
}

const responseJson = async (
  response: Response,
  invalidResponseMessage: string,
): Promise<unknown> => {
  try {
    return await response.json()
  } catch {
    throw new InvalidSidebarApiResponseError(invalidResponseMessage)
  }
}

const getJson = async (url: string, signal: AbortSignal): Promise<unknown> => {
  const response = await CLIENT_FETCHER(url, { signal })
  if (!response.ok) throw new Error(`Request failed: ${response.status}`)
  return response.json()
}

export async function fetchComplexDetail(
  complexId: string,
  signal: AbortSignal,
): Promise<ComplexStagingRecord> {
  const body = await getJson(complexDetailEndpoint(complexId), signal)
  if (!isComplexRecord(body)) throw new TypeError('Complex detail is invalid')
  return body
}

export async function fetchComplexTrades(
  complexId: string,
  signal: AbortSignal,
): Promise<ComplexTradesResponse> {
  const body = await getJson(complexTradesEndpoint(complexId), signal)
  if (!isTradesResponse(body) || body.complexId !== complexId) {
    throw new TypeError('Complex trades are invalid')
  }
  return body
}

export async function fetchApartmentUnitOptions(
  complexId: string,
  dong: string | undefined,
  signal: AbortSignal,
): Promise<ApartmentUnitOptionsResult> {
  const body = await getJson(complexUnitOptionsEndpoint(complexId, dong), signal)
  if (!isUnitOptionsResult(body) || body.key !== complexId) {
    throw new TypeError('Apartment unit options are invalid')
  }
  return body
}

export async function fetchComplexOfficialPrice(
  complexId: string,
  request: ComplexOfficialPriceRequest,
  signal: AbortSignal,
  fetcher: typeof fetch = CLIENT_FETCHER,
): Promise<OfficialPriceLookupResult> {
  const response = await fetcher(complexOfficialPriceEndpoint(complexId), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  })
  if (!response.ok) throw new Error(SIDEBAR_MESSAGES.priceRequestFailed)
  const body = await responseJson(response, SIDEBAR_MESSAGES.priceResponseInvalid)
  if (!isOfficialPriceResult(body) || body.key !== request.key) {
    throw new InvalidSidebarApiResponseError(
      SIDEBAR_MESSAGES.priceResponseInvalid,
    )
  }
  return body
}
