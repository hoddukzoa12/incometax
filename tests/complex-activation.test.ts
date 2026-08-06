import { describe, expect, it } from 'vitest'

import {
  evaluateComplexActivationReadiness,
  MINIMUM_EXPECTED_COMPLEX_COUNT,
  type StagingValidation,
} from '../scripts/lib/complex-activation.ts'
import { activateStaging } from '../scripts/lib/d1-complex.ts'

const COMPLETE_SOURCE_COUNT = 22_259
const LEGACY_EXCLUSION_COUNT = 13

const completeValidation = (
  overrides: Partial<StagingValidation> = {},
): StagingValidation => ({
  total_count: COMPLETE_SOURCE_COUNT,
  geocoded_count: COMPLETE_SOURCE_COUNT,
  seoul_count: 1,
  busan_count: 1,
  gyeonggi_count: 1,
  jeju_count: 1,
  pending_count: 0,
  matched_count: COMPLETE_SOURCE_COUNT,
  not_found_count: 0,
  rejected_count: 0,
  ...overrides,
})

const evaluateCompleteStaging = (
  expectedCount: number,
  validation = completeValidation(),
) =>
  evaluateComplexActivationReadiness({
    expectedCount,
    validation,
    failedLookupCount: 0,
    coverageGuardExceeded: false,
  })

describe('complex activation readiness', () => {
  it('uses the full source count for both entry points despite legacy exclusions', () => {
    const verification = { totalCount: COMPLETE_SOURCE_COUNT }
    const refreshState = {
      expected_count: COMPLETE_SOURCE_COUNT,
      legacyExclusions: Array.from(
        { length: LEGACY_EXCLUSION_COUNT },
        (_, index) => index,
      ),
    }
    const validation = completeValidation({
      total_count: COMPLETE_SOURCE_COUNT,
    })

    const ingestionReadiness = evaluateCompleteStaging(
      verification.totalCount,
      validation,
    )
    const geocodeReadiness = evaluateCompleteStaging(
      refreshState.expected_count,
      validation,
    )

    expect(refreshState.legacyExclusions).toHaveLength(LEGACY_EXCLUSION_COUNT)
    expect(ingestionReadiness).toEqual({ ready: true })
    expect(geocodeReadiness).toEqual(ingestionReadiness)
  })

  it('refuses activation below the absolute source-count floor', async () => {
    const belowFloor = MINIMUM_EXPECTED_COMPLEX_COUNT - 1
    const readiness = evaluateCompleteStaging(
      belowFloor,
      completeValidation({
        total_count: belowFloor,
        geocoded_count: belowFloor,
        matched_count: belowFloor,
      }),
    )

    expect(readiness).toEqual({
      ready: false,
      reason: `Expected complex count ${belowFloor} is below the absolute floor ${MINIMUM_EXPECTED_COMPLEX_COUNT}`,
    })
    await expect(activateStaging(readiness, 'local')).rejects.toThrow(
      'Complex activation refused',
    )
  })
})
