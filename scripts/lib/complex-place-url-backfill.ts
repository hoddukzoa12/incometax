import type {
  HttpAttemptMeasurement,
  HttpMetricsObserver,
  HttpRetryMeasurement,
} from './http.ts'
import {
  DetailApiAttemptLimitError,
  DetailRequestController,
} from './complex-detail-backfill.ts'
import {
  isKakaoQuotaExceededError,
  normalizeKakaoQueryName,
  searchKakaoKeywordDocuments,
} from './kakao-complex-search.ts'
import {
  kakaoPlaceDistanceMeters,
  KAKAO_PLACE_MAX_DISTANCE_METERS,
  rankKakaoPlaceCandidates,
} from './kakao-place-match.ts'

export type ComplexPlaceUrlCheckpointStatus =
  | 'filled'
  | 'noResult'
  | 'tooFar'
  | 'candidateMismatch'
  | 'missingCoordinates'
  | 'responseError'

export const COMPLEX_PLACE_URL_RETRY_STATUSES = [
  'candidateMismatch',
  'noResult',
] as const satisfies readonly ComplexPlaceUrlCheckpointStatus[]

export interface ComplexPlaceUrlTarget {
  readonly complexId: string
  readonly name: string
  readonly legalAddress: string
  readonly lat: number | null
  readonly lng: number | null
}

export interface ComplexPlaceUrlOutcome {
  readonly complexId: string
  readonly status: ComplexPlaceUrlCheckpointStatus
  readonly placeUrl: string | null
  readonly apiAttempts: number
  readonly reason: string | null
}

export type ComplexPlaceUrlLookupResult =
  | { readonly kind: 'outcome'; readonly outcome: ComplexPlaceUrlOutcome }
  | {
      readonly kind: 'budgetExhausted'
      readonly complexId: string
      readonly apiAttempts: 0
    }
  | {
      readonly kind: 'quotaExceeded'
      readonly complexId: string
      readonly apiAttempts: number
      readonly reason: string
    }

interface ComplexPlaceUrlLookupOptions {
  readonly restApiKey: string
  readonly target: ComplexPlaceUrlTarget
  readonly requestController: DetailRequestController
  readonly recordHttpAttempt: (measurement: HttpAttemptMeasurement) => void
  readonly recordHttpRetry: (measurement: HttpRetryMeasurement) => void
}

const MAXIMUM_CHECKPOINT_REASON_LENGTH = 1_000

const errorReason = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error)
  return message.slice(0, MAXIMUM_CHECKPOINT_REASON_LENGTH)
}

export const buildKakaoPlaceUrlQuery = (
  target: Pick<ComplexPlaceUrlTarget, 'legalAddress' | 'name'>,
): string =>
  `${target.legalAddress} ${normalizeKakaoQueryName(target.name)}`.trim()

const outcome = (
  target: ComplexPlaceUrlTarget,
  status: ComplexPlaceUrlCheckpointStatus,
  apiAttempts: number,
  reason: string | null,
  placeUrl: string | null = null,
): ComplexPlaceUrlLookupResult => ({
  kind: 'outcome',
  outcome: {
    complexId: target.complexId,
    status,
    placeUrl,
    apiAttempts,
    reason,
  },
})

export const lookupComplexPlaceUrl = async ({
  restApiKey,
  target,
  requestController,
  recordHttpAttempt,
  recordHttpRetry,
}: ComplexPlaceUrlLookupOptions): Promise<ComplexPlaceUrlLookupResult> => {
  // A URL cannot be accepted without comparing Kakao's coordinates to our
  // stored complex coordinates. Skip the request instead of guessing by name.
  if (target.lat === null || target.lng === null) {
    return outcome(
      target,
      'missingCoordinates',
      0,
      'Stored complex coordinates are missing; Kakao candidate was not requested',
    )
  }
  const storedCoordinates = { lat: target.lat, lng: target.lng }

  let apiAttempts = 0
  const observer: HttpMetricsObserver = {
    beforeAttempt: requestController.beforeAttempt,
    recordAttempt: (measurement) => {
      apiAttempts += 1
      recordHttpAttempt(measurement)
    },
    recordRetry: recordHttpRetry,
  }

  try {
    const documents = await searchKakaoKeywordDocuments(
      buildKakaoPlaceUrlQuery(target),
      restApiKey,
      observer,
    )
    if (documents.length === 0) {
      return outcome(
        target,
        'noResult',
        apiAttempts,
        'Kakao keyword search returned no results',
      )
    }

    const ranked = rankKakaoPlaceCandidates(
      {
        name: target.name,
        legalAddress: target.legalAddress,
        ...storedCoordinates,
      },
      documents,
    )
    const selected = ranked.at(0)
    if (selected !== undefined) {
      return outcome(
        target,
        'filled',
        apiAttempts,
        null,
        selected.candidate.placeUrl,
      )
    }

    const distances = documents.map((document) => ({
      document,
      distanceMeters: kakaoPlaceDistanceMeters(storedCoordinates, document),
    }))
    const nearest = [...distances].sort(
      (left, right) => left.distanceMeters - right.distanceMeters,
    ).at(0)
    const nearby = distances.filter(
      ({ distanceMeters }) =>
        distanceMeters <= KAKAO_PLACE_MAX_DISTANCE_METERS,
    )
    if (nearby.length === 0) {
      return outcome(
        target,
        'tooFar',
        apiAttempts,
        `Nearest Kakao result is ${Math.round(nearest?.distanceMeters ?? 0)}m away`,
      )
    }
    return outcome(
      target,
      'candidateMismatch',
      apiAttempts,
      `Nearby Kakao results failed lot/category/name validation: ${nearby
        .slice(0, 3)
        .map(({ document }) =>
          `${document.placeName} [${document.categoryName}] @ ${document.legalAddress}`,
        )
        .join('; ')}`,
    )
  } catch (error) {
    if (error instanceof DetailApiAttemptLimitError && apiAttempts === 0) {
      return {
        kind: 'budgetExhausted',
        complexId: target.complexId,
        apiAttempts: 0,
      }
    }
    if (isKakaoQuotaExceededError(error)) {
      return {
        kind: 'quotaExceeded',
        complexId: target.complexId,
        apiAttempts,
        reason: errorReason(error),
      }
    }
    return outcome(
      target,
      'responseError',
      apiAttempts,
      errorReason(error),
    )
  }
}
