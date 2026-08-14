import type { ComplexStagingRecord } from '../../shared/complex'
import type { ComplexTradesResponse } from '../../shared/trade'
import {
  type ApartmentUnitOptionsResult,
  type ComplexOfficialPriceRequest,
  type OfficialPriceLookupResult,
} from '../../shared/official-price'
import { SIDEBAR_MESSAGES } from '../messages/sidebar'
import { isComplexRecord } from '../search/api'
import {
  InvalidSidebarApiResponseError,
  isAddressTradesResponse,
  isOfficialPriceResult,
  isRecord,
  isUnitOptionsResult,
  responseJson,
} from './api-validation'

export { InvalidSidebarApiResponseError } from './api-validation'

const complexDetailEndpoint = (complexId: string): string =>
  `/api/complexes/${encodeURIComponent(complexId)}`

const complexTradesEndpoint = (complexId: string): string =>
  `/api/complexes/${encodeURIComponent(complexId)}/trades`

const complexOfficialPriceEndpoint = (complexId: string): string =>
  `/api/complexes/${encodeURIComponent(complexId)}/official-price`

const complexUnitOptionsEndpoint = (
  complexId: string,
  dong?: string,
  aptCode?: string,
): string => {
  const url = new URL(
    `/api/complexes/${encodeURIComponent(complexId)}/unit-options`,
    window.location.origin,
  )
  if (dong) url.searchParams.set('dong', dong)
  if (aptCode) url.searchParams.set('aptCode', aptCode)
  return url.toString()
}

const CLIENT_FETCHER: typeof fetch = (input, init) =>
  globalThis.fetch(input, init)

const isTradesResponse = (value: unknown): value is ComplexTradesResponse =>
  isRecord(value) &&
  typeof value.complexId === 'string' &&
  isAddressTradesResponse(value)

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
  aptCode?: string,
): Promise<ApartmentUnitOptionsResult> {
  const body = await getJson(complexUnitOptionsEndpoint(complexId, dong, aptCode), signal)
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
