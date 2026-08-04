import {
  type ComplexDraft,
  normalizeKaptBasisResponse,
  UnusableKaptBasisError,
} from './complex-normalizer.ts'
import { readKaptBasis } from './complex-source.ts'
import type { HttpMetricsObserver } from './http.ts'

const MAX_UNUSABLE_DETAIL_RETRIES = 2
const UNUSABLE_DETAIL_RETRY_BASE_DELAY_MS = 500

const delay = async (milliseconds: number): Promise<void> => {
  await new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))
}

export const findUnusableBasisError = (
  error: unknown,
): UnusableKaptBasisError | null => {
  let current = error
  while (current instanceof Error) {
    if (current instanceof UnusableKaptBasisError) return current
    current = current.cause
  }
  return null
}

export const readComplexBasisDetail = async (
  serviceKey: string,
  complexId: string,
  observer?: HttpMetricsObserver,
  recordBackoff?: (durationMs: number) => void,
): Promise<ComplexDraft> => {
  for (
    let retry = 0;
    retry <= MAX_UNUSABLE_DETAIL_RETRIES;
    retry += 1
  ) {
    try {
      return await readKaptBasis(
        serviceKey,
        complexId,
        (payload) => normalizeKaptBasisResponse(payload, complexId),
        observer,
      )
    } catch (error) {
      if (
        !(error instanceof UnusableKaptBasisError) ||
        retry >= MAX_UNUSABLE_DETAIL_RETRIES
      ) {
        throw error
      }
      const startedAt = performance.now()
      await delay(UNUSABLE_DETAIL_RETRY_BASE_DELAY_MS * 2 ** retry)
      recordBackoff?.(performance.now() - startedAt)
    }
  }
  throw new Error(`K-apt basis retry loop ended unexpectedly for ${complexId}`)
}
