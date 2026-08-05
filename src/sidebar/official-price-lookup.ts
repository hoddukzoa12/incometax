import type {
  OfficialPriceLookupStage,
  OfficialPriceRequest,
  OfficialPriceResolutionResult,
} from '../../shared/official-price'
import { SIDEBAR_MESSAGES } from '../messages/sidebar'
import {
  fetchOfficialPrice,
  fetchPnu,
  InvalidSidebarApiResponseError,
} from './api'

const CLIENT_FETCHER: typeof fetch = (input, init) =>
  globalThis.fetch(input, init)

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError'

const failedResolution = (
  key: string,
  lookupStage: OfficialPriceLookupStage,
  error: unknown,
): OfficialPriceResolutionResult => {
  const invalidResponse = error instanceof InvalidSidebarApiResponseError
  return {
    key,
    status: 'failed',
    lookupStage,
    failure: {
      kind: invalidResponse ? 'invalidSourceResponse' : 'sourceUnavailable',
      message: error instanceof Error
        ? error.message
        : SIDEBAR_MESSAGES.priceUnexpectedFailure,
      retryable: !invalidResponse,
    },
  }
}

export async function lookupOfficialPriceByAddress(
  request: OfficialPriceRequest,
  signal: AbortSignal,
  fetcher: typeof fetch = CLIENT_FETCHER,
): Promise<OfficialPriceResolutionResult> {
  let pnu: string | null
  try {
    pnu = await fetchPnu(request.address, signal, fetcher)
  } catch (error) {
    if (isAbortError(error)) throw error
    return failedResolution(request.key, 'addressToPnu', error)
  }

  if (!pnu) {
    return {
      key: request.key,
      status: 'noData',
      lookupStage: 'addressToPnu',
      reason: 'addressNotFound',
    }
  }

  try {
    const result = await fetchOfficialPrice(
      { ...request, pnu },
      signal,
      fetcher,
    )
    return { ...result, lookupStage: 'officialPrice' }
  } catch (error) {
    if (isAbortError(error)) throw error
    return failedResolution(request.key, 'officialPrice', error)
  }
}
