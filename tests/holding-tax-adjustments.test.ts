import { describe, expect, it } from 'vitest'

import type { TaxYear } from '../shared/tax-rules'
import { calculateComprehensiveTaxBurdenCap } from '../src/holding/comprehensive-tax-burden-cap'
import { calculateComprehensiveTaxCredit } from '../src/holding/comprehensive-tax-credit'
import { calculateComprehensiveResidenceRecognition } from '../src/holding/comprehensive-residence-recognition'
import { TAX_RULES_BY_YEAR } from '../src/rules'

const CALCULATED_TAX = 10_000_000
const NO_PERIOD = { holdingYears: 0, residenceYears: 0 } as const
const SUPPORTED_TAX_YEARS = [
  2025,
  2026,
  2027,
  2028,
  2029,
] as const satisfies readonly TaxYear[]

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
    calculateComprehensiveResidenceRecognition(
      { basis: 'actualResidence', years: residenceYears },
      undefined,
      TAX_RULES_BY_YEAR[year].comprehensiveTax.taxCredit
        .residenceRecognition,
    ),
    calculatedTax,
    TAX_RULES_BY_YEAR[year].comprehensiveTax.taxCredit,
  )

describe('yearly holding-tax rules', () => {
  it('uses the confirmed 2025 property ratios and current comprehensive rules', () => {
    const rules2025 = TAX_RULES_BY_YEAR[2025]

    expect(rules2025.propertyTax.fairMarketValueRatios).toEqual({
      oneHouse: [
        { upTo: 300_000_000, rate: 0.43 },
        { upTo: 600_000_000, rate: 0.44 },
        { upTo: Number.POSITIVE_INFINITY, rate: 0.45 },
      ],
      other: 0.6,
    })
    expect(rules2025.comprehensiveTax).toBe(
      TAX_RULES_BY_YEAR[2026].comprehensiveTax,
    )
  })

  it('selects property-tax rules explicitly for every supported year', () => {
    const propertyRules = SUPPORTED_TAX_YEARS.map(
      (year) => TAX_RULES_BY_YEAR[year].propertyTax,
    )

    expect(new Set(propertyRules).size).toBe(propertyRules.length)
    for (const rules of propertyRules) {
      expect(rules.fairMarketValueRatios.oneHouse.map(({ rate }) => rate))
        .toEqual([0.43, 0.44, 0.45])
    }
  })

  it('applies the v3 calculated-tax floor only from 2027', () => {
    expect(TAX_RULES_BY_YEAR[2026].comprehensiveTax.calculatedTaxMinimum)
      .toBeNull()
    for (const year of [2027, 2028] as const) {
      expect(TAX_RULES_BY_YEAR[year].comprehensiveTax.calculatedTaxMinimum)
        .toBe(0)
    }
  })

  it('applies the v3 payable-tax floor only through 2026', () => {
    expect(TAX_RULES_BY_YEAR[2026].comprehensiveTax.payableTaxMinimum)
      .toBe(0)
    for (const year of [2027, 2028] as const) {
      expect(TAX_RULES_BY_YEAR[year].comprehensiveTax.payableTaxMinimum)
        .toBeNull()
    }
  })
})

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

  it('uses holding only in 2026, maximum in 2027, residence only from 2028', () => {
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
      holdingPeriodRate: 0.25,
      residencePeriodRate: 0,
      periodRate: 0,
    })
  })

  it('does not apply the one-house credit to a multi-house owner', () => {
    const result = calculateComprehensiveTaxCredit(
      'multiHouse',
      70,
      { holdingYears: 15, residenceYears: 15 },
      calculateComprehensiveResidenceRecognition(
        { basis: 'actualResidence', years: 15 },
        undefined,
        TAX_RULES_BY_YEAR[2027].comprehensiveTax.taxCredit
          .residenceRecognition,
      ),
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
      comprehensiveTax: 500_000,
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
      missingInputs: ['priorYearComprehensiveTax'],
      excessAmount: 0,
    })
  })

  it('uses final prior-year comprehensive tax from 2027 while preserving the 2026 calculated-tax input', () => {
    const priorYearTax = {
      propertyBaseTax: 500_000,
      comprehensiveCalculatedTax: 100_000,
      comprehensiveTax: 500_000,
    } as const

    const currentLaw = calculateComprehensiveTaxBurdenCap(
      600_000,
      1_000_000,
      priorYearTax,
      TAX_RULES_BY_YEAR[2026].comprehensiveTax.taxBurdenCap,
    )
    expect(currentLaw).toMatchObject({
      status: 'computed',
      priorYearBase: 600_000,
      maximumTaxBurden: 900_000,
      excessAmount: 700_000,
    })

    const reform = calculateComprehensiveTaxBurdenCap(
      600_000,
      1_000_000,
      priorYearTax,
      TAX_RULES_BY_YEAR[2027].comprehensiveTax.taxBurdenCap,
    )
    expect(reform).toMatchObject({
      status: 'computed',
      priorYearBase: 1_000_000,
      maximumTaxBurden: 2_000_000,
      excessAmount: 0,
    })
  })
})
