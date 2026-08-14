import {
  addressApartmentIdentity,
  type AddressComplexSearchRequest,
  type AddressComplexSearchResult,
  type AddressUnitOptionsRequest,
  type ApartmentOfficialPriceRequest,
  type ApartmentUnitOptionsResult,
  type OfficialPriceBatchResponse,
  type OfficialPriceLookupResult,
} from '../../shared/official-price'
import type {
  AddressTradeTarget,
  AddressTradesResponse,
} from '../../shared/trade'
import { SIDEBAR_MESSAGES } from '../messages/sidebar'
import {
  InvalidSidebarApiResponseError,
  isAddressTradesResponse,
  isOfficialPriceResult,
  isRecord,
  isUnitOption,
  isUnitOptionsResult,
  responseJson,
} from './api-validation'

const ADDRESS_COMPLEXES_ENDPOINT = '/api/address/complexes'
const ADDRESS_UNIT_OPTIONS_ENDPOINT = '/api/address/unit-options'
const ADDRESS_TRADES_ENDPOINT = '/api/address/trades'
const REALTY_PRICES_ENDPOINT = '/api/realty-prices'
const PNU_PATTERN = /^\d{19}$/u

const CLIENT_FETCHER: typeof fetch = (input, init) =>
  globalThis.fetch(input, init)

const isAddressComplexSearchResult = (
  value: unknown,
): value is AddressComplexSearchResult => {
  if (!isRecord(value)) return false
  if (value.status === 'noData') return true
  if (value.status === 'failed') {
    return isRecord(value.failure) &&
      typeof value.failure.kind === 'string' &&
      typeof value.failure.message === 'string' &&
      typeof value.failure.retryable === 'boolean'
  }
  return value.status === 'found' &&
    typeof value.pnu === 'string' && PNU_PATTERN.test(value.pnu) &&
    Array.isArray(value.complexes) &&
    value.complexes.every(isUnitOption)
}

const isOfficialPriceBatchResponse = (
  value: unknown,
): value is OfficialPriceBatchResponse =>
  isRecord(value) &&
  Array.isArray(value.results) &&
  value.results.every(isOfficialPriceResult)

export async function fetchAddressComplexes(
  request: AddressComplexSearchRequest,
  signal: AbortSignal,
  fetcher: typeof fetch = CLIENT_FETCHER,
): Promise<AddressComplexSearchResult> {
  const response = await fetcher(ADDRESS_COMPLEXES_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  })
  if (!response.ok) throw new Error(SIDEBAR_MESSAGES.addressComplexFailed)
  const body = await responseJson(response, SIDEBAR_MESSAGES.addressComplexFailed)
  if (!isAddressComplexSearchResult(body)) {
    throw new InvalidSidebarApiResponseError(
      SIDEBAR_MESSAGES.addressComplexFailed,
    )
  }
  return body
}

export async function fetchAddressUnitOptions(
  request: AddressUnitOptionsRequest,
  signal: AbortSignal,
  fetcher: typeof fetch = CLIENT_FETCHER,
): Promise<ApartmentUnitOptionsResult> {
  const response = await fetcher(ADDRESS_UNIT_OPTIONS_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  })
  if (!response.ok) throw new Error(SIDEBAR_MESSAGES.unitSourceUnavailable)
  const body = await responseJson(response, SIDEBAR_MESSAGES.unitSourceInvalid)
  const expectedKey = addressApartmentIdentity(request.pnu, request.aptCode)
  if (!isUnitOptionsResult(body) || body.key !== expectedKey) {
    throw new InvalidSidebarApiResponseError(SIDEBAR_MESSAGES.unitSourceInvalid)
  }
  return body
}

export async function fetchAddressTrades(
  request: AddressTradeTarget,
  signal: AbortSignal,
  fetcher: typeof fetch = CLIENT_FETCHER,
): Promise<AddressTradesResponse> {
  const response = await fetcher(ADDRESS_TRADES_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  })
  if (!response.ok) throw new Error(SIDEBAR_MESSAGES.tradesFailed)
  const body = await responseJson(response, SIDEBAR_MESSAGES.tradesFailed)
  if (!isAddressTradesResponse(body)) {
    throw new InvalidSidebarApiResponseError(SIDEBAR_MESSAGES.tradesFailed)
  }
  return body
}

export async function fetchAddressOfficialPrice(
  request: ApartmentOfficialPriceRequest,
  signal: AbortSignal,
  fetcher: typeof fetch = CLIENT_FETCHER,
): Promise<OfficialPriceLookupResult> {
  const response = await fetcher(REALTY_PRICES_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items: [request] }),
    signal,
  })
  if (!response.ok) throw new Error(SIDEBAR_MESSAGES.priceRequestFailed)
  const body = await responseJson(response, SIDEBAR_MESSAGES.priceResponseInvalid)
  if (
    !isOfficialPriceBatchResponse(body) ||
    body.results.length !== 1 ||
    body.results[0].key !== request.key
  ) {
    throw new InvalidSidebarApiResponseError(
      SIDEBAR_MESSAGES.priceResponseInvalid,
    )
  }
  return body.results[0]
}
