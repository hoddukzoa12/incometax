import { describe, expect, expectTypeOf, it } from 'vitest'

import type {
  ComprehensiveResidenceRecognitionInput,
} from '../shared/comprehensive-residence-recognition'
import type {
  ActualResidencePeriod,
  ComprehensiveTaxCreditResidencePeriod,
} from '../shared/ownership'
import { calculateHoldingTax } from '../src/holding/calc'
import { calculateComprehensiveResidenceRecognition } from '../src/holding/comprehensive-residence-recognition'
import { TAX_RULES_BY_YEAR } from '../src/rules'
import { meetsMinimumActualResidenceYears } from '../src/validation/ownership-period'

const ACTUAL_THREE_YEARS = {
  basis: 'actualResidence',
  years: 3,
} as const satisfies ActualResidencePeriod

const RECOGNITION_RULES =
  TAX_RULES_BY_YEAR[2027].comprehensiveTax.taxCredit
    .residenceRecognition

const createUnavoidableRelocation = (
  overrides: Partial<
    Extract<
      ComprehensiveResidenceRecognitionInput,
      { readonly kind: 'unavoidableRelocation' }
    >
  > = {},
): ComprehensiveResidenceRecognitionInput => ({
  kind: 'unavoidableRelocation',
  continuousResidenceStartDate: '2017-06-01',
  relocationDate: '2020-06-01',
  recognitionEndDate: '2024-06-01',
  reason: { kind: 'jobChangeOrTransfer' },
  destination: 'otherCityOrCounty',
  ...overrides,
})

describe('calculateComprehensiveResidenceRecognition', () => {
  it('defaults to no recognition and is not effective under current law', () => {
    expect(
      calculateComprehensiveResidenceRecognition(
        ACTUAL_THREE_YEARS,
        undefined,
        RECOGNITION_RULES,
      ),
    ).toEqual({
      status: 'notRequested',
      creditPeriod: {
        basis: 'comprehensiveTaxCreditResidence',
        actualYears: 3,
        recognizedYears: 0,
        years: 3,
      },
    })

    expect(
      calculateComprehensiveResidenceRecognition(
        ACTUAL_THREE_YEARS,
        createUnavoidableRelocation(),
        TAX_RULES_BY_YEAR[2026].comprehensiveTax.taxCredit
          .residenceRecognition,
      ),
    ).toMatchObject({
      status: 'notEffective',
      creditPeriod: { recognizedYears: 0, years: 3 },
    })
  })

  it('caps unavoidable-relocation recognition at exactly three years', () => {
    const exactlyAtCap = calculateComprehensiveResidenceRecognition(
      ACTUAL_THREE_YEARS,
      createUnavoidableRelocation({
        recognitionEndDate: '2023-06-01',
      }),
      RECOGNITION_RULES,
    )
    const aboveCap = calculateComprehensiveResidenceRecognition(
      ACTUAL_THREE_YEARS,
      createUnavoidableRelocation({
        recognitionEndDate: '2024-06-01',
      }),
      RECOGNITION_RULES,
    )

    expect(exactlyAtCap).toMatchObject({
      status: 'computed',
      creditPeriod: { recognizedYears: 3, years: 6 },
    })
    expect(aboveCap).toMatchObject({
      status: 'computed',
      creditPeriod: { recognizedYears: 3, years: 6 },
    })
  })

  it('requires all three unavoidable-relocation conditions', () => {
    const result = calculateComprehensiveResidenceRecognition(
      ACTUAL_THREE_YEARS,
      createUnavoidableRelocation({
        continuousResidenceStartDate: '2019-12-02',
        relocationDate: '2020-06-01',
        reason: {
          kind: 'medicalTreatmentOrCare',
          requiredTreatmentYears: 0.5,
        },
        destination: 'sameCityOrCounty',
      }),
      RECOGNITION_RULES,
    )

    expect(result).toEqual({
      status: 'notQualified',
      kind: 'unavoidableRelocation',
      failedConditions: [
        'minimumContinuousResidence',
        'qualifyingReason',
        'qualifyingDestination',
      ],
      creditPeriod: {
        basis: 'comprehensiveTaxCreditResidence',
        actualYears: 3,
        recognizedYears: 0,
        years: 3,
      },
    })
  })

  it.each([
    {
      reason: {
        kind: 'medicalTreatmentOrCare' as const,
        requiredTreatmentYears: 1,
      },
      destination: 'otherCityOrCounty' as const,
    },
    {
      reason: {
        kind: 'supportDirectAncestor' as const,
        directAncestorAge: 60,
      },
      destination: 'qualifyingUrbanRuralAreaMove' as const,
    },
    {
      reason: { kind: 'overseasStudyOrEmployment' as const },
      destination: 'overseas' as const,
    },
    {
      reason: { kind: 'similarUnavoidableReason' as const },
      destination: 'otherCityOrCounty' as const,
    },
  ])('accepts a qualifying $reason.kind boundary', ({
    reason,
    destination,
  }) => {
    const result = calculateComprehensiveResidenceRecognition(
      ACTUAL_THREE_YEARS,
      createUnavoidableRelocation({ reason, destination }),
      RECOGNITION_RULES,
    )

    expect(result).toMatchObject({ status: 'computed' })
  })

  it('reports an opted-in but incomplete condition as unknown', () => {
    const result = calculateComprehensiveResidenceRecognition(
      ACTUAL_THREE_YEARS,
      createUnavoidableRelocation({
        reason: { kind: 'medicalTreatmentOrCare' },
        destination: undefined,
      }),
      RECOGNITION_RULES,
    )

    expect(result).toEqual({
      status: 'notComputed',
      kind: 'unavoidableRelocation',
      missingInputs: ['requiredTreatmentYears', 'destination'],
      creditPeriod: null,
    })
  })

  it('recognizes half of a construction span including a fractional year', () => {
    const result = calculateComprehensiveResidenceRecognition(
      ACTUAL_THREE_YEARS,
      {
        kind: 'redevelopmentConstruction',
        continuousResidenceStartDate: '2018-01-01',
        managementDispositionApprovalDate: '2020-01-01',
        occupancyAvailableDate: '2023-01-01',
        demolitionBeforeApproval: {
          kind: 'notDemolishedBeforeApproval',
        },
      },
      RECOGNITION_RULES,
    )

    expect(result).toMatchObject({
      status: 'computed',
      kind: 'redevelopmentConstruction',
      creditPeriod: {
        actualYears: 3,
        recognizedYears: 1.5,
        years: 4.5,
      },
    })
  })

  it('uses the six-month pre-demolition reference for continuity', () => {
    const belowMinimum = calculateComprehensiveResidenceRecognition(
      ACTUAL_THREE_YEARS,
      {
        kind: 'redevelopmentConstruction',
        continuousResidenceStartDate: '2019-03-01',
        managementDispositionApprovalDate: '2021-06-01',
        occupancyAvailableDate: '2023-06-01',
        demolitionBeforeApproval: {
          kind: 'demolishedBeforeApproval',
          demolitionDate: '2020-06-01',
        },
      },
      RECOGNITION_RULES,
    )
    const exactlyAtMinimum = calculateComprehensiveResidenceRecognition(
      ACTUAL_THREE_YEARS,
      {
        kind: 'redevelopmentConstruction',
        continuousResidenceStartDate: '2018-12-01',
        managementDispositionApprovalDate: '2021-06-01',
        occupancyAvailableDate: '2023-06-01',
        demolitionBeforeApproval: {
          kind: 'demolishedBeforeApproval',
          demolitionDate: '2020-06-01',
        },
      },
      RECOGNITION_RULES,
    )

    expect(belowMinimum).toMatchObject({
      status: 'notQualified',
      failedConditions: ['minimumContinuousResidence'],
      creditPeriod: { recognizedYears: 0 },
    })
    expect(exactlyAtMinimum).toMatchObject({
      status: 'computed',
      creditPeriod: { recognizedYears: 1 },
    })
  })

  it('rejects invalid or reversed recognition dates', () => {
    expect(() =>
      calculateComprehensiveResidenceRecognition(
        ACTUAL_THREE_YEARS,
        createUnavoidableRelocation({ relocationDate: '2020-02-30' }),
        RECOGNITION_RULES,
      ),
    ).toThrow(RangeError)
    expect(() =>
      calculateComprehensiveResidenceRecognition(
        ACTUAL_THREE_YEARS,
        createUnavoidableRelocation({
          recognitionEndDate: '2019-06-01',
        }),
        RECOGNITION_RULES,
      ),
    ).toThrow(RangeError)
  })
})

describe('recognition integration and eligibility isolation', () => {
  it('crosses the five-year residence-credit band only when recognized', () => {
    const item = {
      assetKind: 'apartment',
      officialPrice: 2_000_000_000,
      ownershipShare: 1,
      isSoleHouseholdOwner: true,
      residency: 'residing',
      areaKind: 'general',
      holdingYears: 8,
      residenceYears: 4,
    } as const
    const common = {
      year: 2028 as const,
      householdHomeCount: 1,
      items: [item],
      ownerAge: 0,
      priorYearTax: {
        propertyBaseTax: 10_000_000,
        comprehensiveTaxAfterCreditBeforeBurdenCap: 10_000_000,
      },
    }
    const withoutRecognition = calculateHoldingTax(common)
    const withRecognition = calculateHoldingTax({
      ...common,
      comprehensiveResidenceRecognition: {
        kind: 'redevelopmentConstruction',
        continuousResidenceStartDate: '2018-01-01',
        managementDispositionApprovalDate: '2020-01-01',
        occupancyAvailableDate: '2022-01-01',
        demolitionBeforeApproval: {
          kind: 'notDemolishedBeforeApproval',
        },
      },
    })

    expect(withoutRecognition.comprehensiveTax.taxCredit).toMatchObject({
      status: 'computed',
      residencePeriodRate: 0,
    })
    expect(withRecognition.comprehensiveTax.taxCredit).toMatchObject({
      status: 'computed',
      residencePeriodRate: 0.2,
    })
  })

  it('stops tax calculation when an opted-in recognition is incomplete', () => {
    const result = calculateHoldingTax({
      year: 2028,
      householdHomeCount: 1,
      items: [
        {
          assetKind: 'apartment',
          officialPrice: 2_000_000_000,
          ownershipShare: 1,
          isSoleHouseholdOwner: true,
          residency: 'residing',
          areaKind: 'general',
          holdingYears: 8,
          residenceYears: 3,
        },
      ],
      ownerAge: 62,
      priorYearTax: {
        propertyBaseTax: 10_000_000,
        comprehensiveTaxAfterCreditBeforeBurdenCap: 10_000_000,
      },
      comprehensiveResidenceRecognition: {
        kind: 'unavoidableRelocation',
        reason: { kind: 'jobChangeOrTransfer' },
      },
    })

    expect(result.calculationStatus).toBe('missingInputs')
    expect(result.totalTax).toBeNull()
    expect(result.comprehensiveTax.residenceRecognition).toMatchObject({
      status: 'notComputed',
      missingInputs: [
        'continuousResidenceStartDate',
        'relocationDate',
        'recognitionEndDate',
        'destination',
      ],
    })
    expect(result.comprehensiveTax.taxCredit).toEqual({
      status: 'notComputed',
      missingInputs: ['comprehensiveResidenceRecognition'],
      amount: null,
    })
  })

  it('makes deduction-only residence periods unusable by eligibility checks', () => {
    const deductionOnlyPeriod = {
      basis: 'comprehensiveTaxCreditResidence',
      actualYears: 1,
      recognizedYears: 3,
      years: 4,
    } as const satisfies ComprehensiveTaxCreditResidencePeriod

    expectTypeOf(deductionOnlyPeriod).not.toMatchTypeOf<
      ActualResidencePeriod
    >()
    expectTypeOf(meetsMinimumActualResidenceYears)
      .parameter(0)
      .toEqualTypeOf<ActualResidencePeriod>()
    expect(
      meetsMinimumActualResidenceYears(ACTUAL_THREE_YEARS, 2),
    ).toBe(true)
  })
})
