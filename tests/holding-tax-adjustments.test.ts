import { describe, expect, it } from 'vitest'

import type { TaxYear } from '../shared/tax-rules'
import { calculateComprehensiveTaxBurdenCap } from '../src/holding/comprehensive-tax-burden-cap'
import { calculateComprehensiveTaxCredit } from '../src/holding/comprehensive-tax-credit'
import { TAX_RULES_BY_YEAR } from '../src/rules'

const CALCULATED_TAX = 10_000_000
const NO_PERIOD = { holdingYears: 0, residenceYears: 0 } as const

const calculateCredit = (
  year: TaxYear,
  ownerAge: number | undefined,
  holdingYears: number,
  residenceYears: number,
  calculatedTax = CALCULATED_TAX,
) =>
  calculateComprehensiveTaxCredit(
    'oneHouse',
    ownerAge,
    { holdingYears, residenceYears },
    calculatedTax,
    TAX_RULES_BY_YEAR[year].comprehensiveTax.taxCredit,
  )

describe('calculateComprehensiveTaxCredit boundaries', () => {
  it.each([
    { ownerAge: 60, expectedRate: 0.2 },
    { ownerAge: 65, expectedRate: 0.3 },
    { ownerAge: 70, expectedRate: 0.4 },
  ])('applies the age rate at exactly age $ownerAge', ({
    ownerAge,
    expectedRate,
  }) => {
    const result = calculateCredit(
      2026,
      ownerAge,
      NO_PERIOD.holdingYears,
      NO_PERIOD.residenceYears,
    )

    expect(result).toMatchObject({
      status: 'computed',
      ageRate: expectedRate,
      appliedRate: expectedRate,
    })
  })

  it.each([
    { holdingYears: 5, expectedRate: 0.2 },
    { holdingYears: 10, expectedRate: 0.4 },
    { holdingYears: 15, expectedRate: 0.5 },
  ])('applies the current holding rate at exactly $holdingYears years', ({
    holdingYears,
    expectedRate,
  }) => {
    const result = calculateCredit(2026, 0, holdingYears, 0)

    expect(result).toMatchObject({
      status: 'computed',
      holdingPeriodRate: expectedRate,
      periodRate: expectedRate,
    })
  })

  it.each([
    { holdingYears: 5, expectedRate: 0.1 },
    { holdingYears: 10, expectedRate: 0.2 },
    { holdingYears: 15, expectedRate: 0.25 },
  ])('applies the 2027 holding rate at exactly $holdingYears years', ({
    holdingYears,
    expectedRate,
  }) => {
    const result = calculateCredit(2027, 0, holdingYears, 0)

    expect(result).toMatchObject({
      status: 'computed',
      holdingPeriodRate: expectedRate,
      periodRate: expectedRate,
    })
  })

  it.each([
    { residenceYears: 5, expectedRate: 0.2 },
    { residenceYears: 10, expectedRate: 0.4 },
    { residenceYears: 15, expectedRate: 0.5 },
  ])('applies the residence rate at exactly $residenceYears years', ({
    residenceYears,
    expectedRate,
  }) => {
    for (const year of [2027, 2028] as const) {
      const result = calculateCredit(year, 0, 0, residenceYears)

      expect(result).toMatchObject({
        status: 'computed',
        residencePeriodRate: expectedRate,
        periodRate: expectedRate,
      })
    }
  })

  it('does not mark a combined rate of exactly 80% as capped', () => {
    const result = calculateCredit(2026, 70, 10, 0)

    expect(result).toMatchObject({
      status: 'computed',
      nominalRate: 0.8,
      appliedRate: 0.8,
      isRateCapped: false,
    })
  })

  it('uses holding only in 2026, the maximum in 2027, and residence only from 2028', () => {
    expect(calculateCredit(2026, 0, 0, 15)).toMatchObject({
      status: 'computed',
      periodRate: 0,
    })
    expect(calculateCredit(2027, 0, 15, 10)).toMatchObject({
      status: 'computed',
      holdingPeriodRate: 0.25,
      residencePeriodRate: 0.4,
      periodRate: 0.4,
    })
    expect(calculateCredit(2028, 0, 15, 0)).toMatchObject({
      status: 'computed',
      periodRate: 0,
    })
  })

  it('does not apply the one-house credit to a multi-house owner', () => {
    const result = calculateComprehensiveTaxCredit(
      'multiHouse',
      70,
      { holdingYears: 15, residenceYears: 15 },
      CALCULATED_TAX,
      TAX_RULES_BY_YEAR[2027].comprehensiveTax.taxCredit,
    )

    expect(result).toEqual({
      status: 'notApplicable',
      reason: 'notOneHouse',
      amount: 0,
    })
  })

  it.each([
    {
      year: 2027 as const,
      calculatedTax: 10_000_000,
      expectedAmount: 8_000_000,
    },
    {
      year: 2028 as const,
      calculatedTax: 7_500_000,
      expectedAmount: 6_000_000,
    },
  ])('does not mark an amount exactly at the $year cap as capped', ({
    year,
    calculatedTax,
    expectedAmount,
  }) => {
    const result = calculateCredit(
      year,
      70,
      15,
      15,
      calculatedTax,
    )

    expect(result).toMatchObject({
      status: 'computed',
      appliedRate: 0.8,
      calculatedAmount: expectedAmount,
      amount: expectedAmount,
      isAmountCapped: false,
    })
  })

  it('reports a missing owner age instead of treating it as zero', () => {
    expect(calculateCredit(2027, undefined, 15, 15)).toEqual({
      status: 'notComputed',
      missingInputs: ['ownerAge'],
      amount: null,
    })
  })
})

describe('calculateComprehensiveTaxBurdenCap', () => {
  it('uses 150% for current law and 200% from 2027', () => {
    const priorYearTax = {
      propertyBaseTax: 500_000,
      comprehensiveCalculatedTax: 500_000,
    } as const

    const currentResult = calculateComprehensiveTaxBurdenCap(
      600_000,
      1_000_000,
      priorYearTax,
      TAX_RULES_BY_YEAR[2026].comprehensiveTax.taxBurdenCap,
    )
    expect(currentResult).toMatchObject({
      status: 'computed',
      rate: 1.5,
      maximumTaxBurden: 1_500_000,
      excessAmount: 100_000,
    })

    for (const year of [2027, 2028] as const) {
      const reformResult = calculateComprehensiveTaxBurdenCap(
        600_000,
        1_000_000,
        priorYearTax,
        TAX_RULES_BY_YEAR[year].comprehensiveTax.taxBurdenCap,
      )
      expect(reformResult).toMatchObject({
        status: 'computed',
        rate: 2,
        maximumTaxBurden: 2_000_000,
        excessAmount: 0,
      })
    }
  })

  it('reports each absent prior-year base component', () => {
    const result = calculateComprehensiveTaxBurdenCap(
      600_000,
      1_000_000,
      { propertyBaseTax: 500_000 },
      TAX_RULES_BY_YEAR[2027].comprehensiveTax.taxBurdenCap,
    )

    expect(result).toEqual({
      status: 'notComputed',
      rate: 2,
      missingInputs: ['priorYearComprehensiveCalculatedTax'],
      excessAmount: null,
    })
  })
})
