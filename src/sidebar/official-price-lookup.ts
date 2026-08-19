import type {
  ComplexOfficialPriceRequest,
  OfficialPriceResolutionResult,
} from '../../shared/official-price'
import type { AddressComplexSelection } from '../../shared/search'
import { SIDEBAR_MESSAGES } from '../messages/sidebar'
import {
  fetchComplexOfficialPrice,
  InvalidSidebarApiResponseError,
} from './api'
import { fetchAddressOfficialPrice } from './address-api'

const CLIENT_FETCHER: typeof fetch = (input, init) =>
  globalThis.fetch(input, init)

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError'

const failedResolution = (
  key: string,
  error: unknown,
): OfficialPriceResolutionResult => {
  const invalidResponse = error instanceof InvalidSidebarApiResponseError
  return {
    key,
    status: 'failed',
    lookupStage: 'officialPrice',
    failure: {
      kind: invalidResponse ? 'invalidSourceResponse' : 'sourceUnavailable',
      message: error instanceof Error
        ? error.message
        : SIDEBAR_MESSAGES.priceUnexpectedFailure,
      retryable: !invalidResponse,
    },
  }
}

export async function lookupOfficialPriceForComplex(
  complexId: string,
  request: ComplexOfficialPriceRequest,
  signal: AbortSignal,
  fetcher: typeof fetch = CLIENT_FETCHER,
): Promise<OfficialPriceResolutionResult> {
  try {
    const result = await fetchComplexOfficialPrice(
      complexId,
      request,
      signal,
      fetcher,
    )
    return { ...result, lookupStage: 'officialPrice' }
  } catch (error) {
    if (isAbortError(error)) throw error
    return failedResolution(request.key, error)
  }
}

export async function lookupOfficialPriceForAddress(
  complex: AddressComplexSelection,
  query: {
    readonly key: string
    readonly dong: string
    readonly room: string
  },
  signal: AbortSignal,
  fetcher: typeof fetch = CLIENT_FETCHER,
): Promise<OfficialPriceResolutionResult> {
  try {
    const result = await fetchAddressOfficialPrice({
      assetKind: 'apartment',
      key: query.key,
      address: complex.address,
      complexName: complex.complexName,
      dong: query.dong,
      room: query.room,
      pnu: complex.pnu,
      aptCode: complex.aptCode,
    }, signal, fetcher)
    return { ...result, lookupStage: 'officialPrice' }
  } catch (error) {
    if (isAbortError(error)) throw error
    return failedResolution(query.key, error)
  }
}
