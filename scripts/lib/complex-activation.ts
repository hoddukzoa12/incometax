export const MINIMUM_EXPECTED_COMPLEX_COUNT = 20_000
export const MAX_KAKAO_NOT_FOUND_RATIO = 0.25
export const MAX_KAKAO_REJECTED_RATIO = 0.02

export const REQUIRED_COMPLEX_REGION_PREFIXES = {
  seoul: '11',
  busan: '26',
  gyeonggi: '41',
  jeju: '50',
} as const

type RequiredRegion = keyof typeof REQUIRED_COMPLEX_REGION_PREFIXES
type RequiredRegionCount = `${RequiredRegion}_count`

export type StagingValidation = {
  readonly total_count: number
  readonly geocoded_count: number
  readonly pending_count: number
  readonly matched_count: number
  readonly not_found_count: number
  readonly rejected_count: number
} & Readonly<Record<RequiredRegionCount, number>>

export type ComplexActivationReadiness =
  | { readonly ready: true }
  | { readonly ready: false; readonly reason: string }

interface ComplexActivationInput {
  readonly expectedCount: number
  readonly validation: StagingValidation
  readonly failedLookupCount: number
  readonly coverageGuardExceeded: boolean
}

const REQUIRED_REGIONS = Object.keys(
  REQUIRED_COMPLEX_REGION_PREFIXES,
) as RequiredRegion[]

const requiredRegionsPresent = (validation: StagingValidation): boolean =>
  REQUIRED_REGIONS.every((region) => validation[`${region}_count`] > 0)

export const evaluateComplexActivationReadiness = ({
  expectedCount,
  validation,
  failedLookupCount,
  coverageGuardExceeded,
}: ComplexActivationInput): ComplexActivationReadiness => {
  if (expectedCount < MINIMUM_EXPECTED_COMPLEX_COUNT) {
    return {
      ready: false,
      reason: `Expected complex count ${expectedCount} is below the absolute floor ${MINIMUM_EXPECTED_COMPLEX_COUNT}`,
    }
  }
  // Every verified K-apt list row stays in staging. Lookup misses are modeled
  // by lookup_status, so legacy exclusion rows must not reduce this count.
  if (validation.total_count !== expectedCount) {
    return {
      ready: false,
      reason: `Staging count ${validation.total_count} does not match source count ${expectedCount}`,
    }
  }
  if (failedLookupCount !== 0) {
    return {
      ready: false,
      reason: `${failedLookupCount} complex lookup request(s) failed`,
    }
  }
  if (coverageGuardExceeded) {
    return {
      ready: false,
      reason: 'Kakao not-found coverage guard was exceeded',
    }
  }

  const lookupStatusCount =
    validation.pending_count +
    validation.matched_count +
    validation.not_found_count +
    validation.rejected_count
  if (
    validation.pending_count !== 0 ||
    lookupStatusCount !== validation.total_count
  ) {
    return {
      ready: false,
      reason: 'Complex staging contains incomplete lookup statuses',
    }
  }
  if (validation.geocoded_count !== validation.matched_count) {
    return {
      ready: false,
      reason: 'Geocoded and matched complex counts do not agree',
    }
  }

  const notFoundRatio = validation.not_found_count / validation.total_count
  if (notFoundRatio > MAX_KAKAO_NOT_FOUND_RATIO) {
    return {
      ready: false,
      reason: 'Kakao not-found coverage guard was exceeded',
    }
  }
  const rejectedRatio = validation.rejected_count / validation.total_count
  if (rejectedRatio > MAX_KAKAO_REJECTED_RATIO) {
    return {
      ready: false,
      reason: 'Kakao rejected coverage guard was exceeded',
    }
  }
  if (!requiredRegionsPresent(validation)) {
    return {
      ready: false,
      reason: 'Required regional samples are missing',
    }
  }

  return { ready: true }
}
