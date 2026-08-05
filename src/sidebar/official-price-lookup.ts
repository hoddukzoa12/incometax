import type {
  ComplexOfficialPriceRequest,
  OfficialPriceResolutionResult,
} from '../../shared/official-price'
import { SIDEBAR_MESSAGES } from '../messages/sidebar'
import {
  fetchComplexOfficialPrice,
  InvalidSidebarApiResponseError,
} from './api'

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
