import { describe, expect, it } from 'vitest'

import type { TaxYear } from '../shared/tax-rules'
import type { TransferTaxInput } from '../shared/transfer-tax'
import { calculateTransferTax } from '../src/transfer/calc'

const YEARS = [2026, 2027, 2028, 2029] as const satisfies readonly TaxYear[]
const ONE_WON = 1

const createInput = (
  overrides: Partial<TransferTaxInput> = {},
): TransferTaxInput => ({
  assetKind: 'apartment',
  year: 2026,
  householdKind: 'oneHouse',
  salePrice: 2_000_000_000,
  acquisitionPrice: 1_000_000_000,
  necessaryExpenses: 0,
  holdingYears: 10,
  residenceYears: 10,
  ...overrides,
})

describe('calculateTransferTax golden cases', () => {
  it('matches T1 and applies the 25 million won deduction from 2027', () => {
    const expected = {
      2026: { basicDeduction: 2_500_000, taxableBase: 77_500_000, total: 14_124_000 },
      2027: { basicDeduction: 25_000_000, taxableBase: 55_000_000, total: 8_184_000 },
      2028: { basicDeduction: 25_000_000, taxableBase: 55_000_000, total: 8_184_000 },
      2029: { basicDeduction: 25_000_000, taxableBase: 55_000_000, total: 8_184_000 },
    } as const

    for (const year of YEARS) {
      const result = calculateTransferTax(createInput({ year }))

      expect(result.taxableGain).toBe(400_000_000)
      expect(result.longTermDeduction.nominalRate).toBeCloseTo(0.8)
      expect(result.longTermDeduction.appliedAmount).toBe(320_000_000)
      expect(result.basicDeductionAmount).toBe(expected[year].basicDeduction)
      expect(result.taxableBase).toBe(expected[year].taxableBase)
      expect(result.totalTax).toBe(expected[year].total)
    }
  })

  it('matches T2 by falling back to the multi-house table below two residence years', () => {
    const expected = {
      2026: { rate: 0.2, deduction: 80_000_000, taxableBase: 317_500_000, total: 111_166_000 },
      2027: { rate: 0.2, deduction: 80_000_000, taxableBase: 317_500_000, total: 111_166_000 },
      2028: { rate: 0.1, deduction: 40_000_000, taxableBase: 357_500_000, total: 128_766_000 },
      2029: { rate: 0, deduction: 0, taxableBase: 397_500_000, total: 146_366_000 },
    } as const

    for (const year of YEARS) {
      const result = calculateTransferTax(
        createInput({ year, residenceYears: 0 }),
      )

      expect(result.longTermDeduction.ruleHouseholdKind).toBe('multiHouse')
      expect(result.longTermDeduction.nominalRate).toBeCloseTo(expected[year].rate)
      expect(result.longTermDeduction.appliedAmount).toBe(expected[year].deduction)
      expect(result.basicDeductionAmount).toBe(2_500_000)
      expect(result.taxableBase).toBe(expected[year].taxableBase)
      expect(result.appliedRate.rate).toBeCloseTo(0.4)
      expect(result.totalTax).toBe(expected[year].total)
    }
  })

  it('matches T3 by exempting an eligible one-house sale at 1.2 billion won', () => {
    for (const year of YEARS) {
      const result = calculateTransferTax(
        createInput({
          year,
          salePrice: 1_100_000_000,
          acquisitionPrice: 500_000_000,
        }),
      )

      expect(result.status).toBe('exempt')
      expect(result.taxableBase).toBe(0)
      expect(result.totalTax).toBe(0)
    }
  })

  it('matches T4 and returns the effective rate after the 2029 cap', () => {
    const expected = {
      2026: { deduction: 1_314_285_714, taxableBase: 326_071_429, total: 114_937_428 },
      2027: { deduction: 1_314_285_714, taxableBase: 326_071_429, total: 114_937_428 },
      2028: { deduction: 1_314_285_714, taxableBase: 326_071_429, total: 114_937_428 },
      2029: { deduction: 1_000_000_000, taxableBase: 640_357_143, total: 256_311_000 },
    } as const

    for (const year of YEARS) {
      const result = calculateTransferTax(
        createInput({
          year,
          salePrice: 3_500_000_000,
          acquisitionPrice: 1_000_000_000,
        }),
      )

      expect(result.taxableGain).toBe(1_642_857_143)
      expect(result.longTermDeduction.nominalRate).toBeCloseTo(0.8)
      expect(result.longTermDeduction.appliedAmount).toBe(expected[year].deduction)
      expect(result.taxableBase).toBe(expected[year].taxableBase)
      expect(result.totalTax).toBe(expected[year].total)
    }

    const capped = calculateTransferTax(
      createInput({
        year: 2029,
        salePrice: 3_500_000_000,
        acquisitionPrice: 1_000_000_000,
      }),
    )
    expect(capped.longTermDeduction.isCapped).toBe(true)
    expect(capped.longTermDeduction.effectiveRate).toBeCloseTo(0.6086956522)
    expect(capped.longTermDeduction.effectiveRate).not.toBe(
      capped.longTermDeduction.nominalRate,
    )
  })

  it('matches T5 for a non-resident multi-house owner', () => {
    const expected = {
      2026: { rate: 0.3, deduction: 150_000_000, taxableBase: 347_500_000, total: 124_366_000 },
      2027: { rate: 0.3, deduction: 150_000_000, taxableBase: 347_500_000, total: 124_366_000 },
      2028: { rate: 0.15, deduction: 75_000_000, taxableBase: 422_500_000, total: 157_366_000 },
      2029: { rate: 0, deduction: 0, taxableBase: 497_500_000, total: 190_366_000 },
    } as const

    for (const year of YEARS) {
      const result = calculateTransferTax(
        createInput({
          year,
          householdKind: 'multiHouse',
          salePrice: 1_000_000_000,
          acquisitionPrice: 500_000_000,
          holdingYears: 15,
          residenceYears: 0,
        }),
      )

      expect(result.taxableGain).toBe(500_000_000)
      expect(result.longTermDeduction.nominalRate).toBeCloseTo(expected[year].rate)
      expect(result.longTermDeduction.appliedAmount).toBe(expected[year].deduction)
      expect(result.taxableBase).toBe(expected[year].taxableBase)
      expect(result.appliedRate.rate).toBeCloseTo(0.4)
      expect(result.totalTax).toBe(expected[year].total)
    }
  })

  it('matches T6 and uses the multi-house residence deduction at two-plus years', () => {
    for (const year of YEARS) {
      const result = calculateTransferTax(
        createInput({
          year,
          householdKind: 'multiHouse',
          salePrice: 1_000_000_000,
          acquisitionPrice: 500_000_000,
          holdingYears: 15,
          residenceYears: 15,
        }),
      )

      expect(result.longTermDeduction.nominalRate).toBeCloseTo(0.3)
      expect(result.longTermDeduction.appliedAmount).toBe(150_000_000)
      expect(result.taxableBase).toBe(347_500_000)
      expect(result.appliedRate.rate).toBeCloseTo(0.4)
      expect(result.totalTax).toBe(124_366_000)
    }
  })

  it('matches T7 without high-price apportionment below two holding years', () => {
    const cases = [
      { holdingYears: 0.5, rateKind: 'shortTerm', rate: 0.7, total: 383_075_000 },
      { holdingYears: 1.5, rateKind: 'shortTerm', rate: 0.6, total: 328_350_000 },
      { holdingYears: 2.5, rateKind: 'progressive', rate: 0.35, total: 20_553_500 },
    ] as const

    for (const testCase of cases) {
      const result = calculateTransferTax(
        createInput({
          salePrice: 1_500_000_000,
          acquisitionPrice: 1_000_000_000,
          holdingYears: testCase.holdingYears,
          residenceYears: 0,
        }),
      )

      expect(result.taxableGain).toBe(
        testCase.holdingYears < 2 ? 500_000_000 : 100_000_000,
      )
      expect(result.longTermDeduction.appliedAmount).toBe(0)
      expect(result.basicDeductionAmount).toBe(2_500_000)
      expect(result.taxableBase).toBe(
        testCase.holdingYears < 2 ? 497_500_000 : 97_500_000,
      )
      expect(result.appliedRate.kind).toBe(testCase.rateKind)
      expect(result.appliedRate.rate).toBeCloseTo(testCase.rate)
      expect(result.totalTax).toBe(testCase.total)
    }
  })
})

describe('calculateTransferTax boundaries and validation', () => {
  it('changes from exemption to high-price apportionment immediately above 1.2 billion won', () => {
    const atThreshold = calculateTransferTax(
      createInput({ salePrice: 1_200_000_000, acquisitionPrice: 500_000_000 }),
    )
    const aboveThreshold = calculateTransferTax(
      createInput({
        salePrice: 1_200_000_000 + ONE_WON,
        acquisitionPrice: 500_000_000,
      }),
    )

    expect(atThreshold.status).toBe('exempt')
    expect(aboveThreshold.status).toBe('taxable')
    expect(aboveThreshold.taxableGainRatio).toBeGreaterThan(0)
  })

  it('requires two holding years for exemption and three for long-term deduction', () => {
    const beforeExemption = calculateTransferTax(
      createInput({ salePrice: 1_100_000_000, holdingYears: 1.999 }),
    )
    const atExemption = calculateTransferTax(
      createInput({ salePrice: 1_100_000_000, holdingYears: 2 }),
    )
    const beforeLongTerm = calculateTransferTax(
      createInput({ holdingYears: 2.999, residenceYears: 2 }),
    )
    const atLongTerm = calculateTransferTax(
      createInput({ holdingYears: 3, residenceYears: 2 }),
    )

    expect(beforeExemption.status).toBe('taxable')
    expect(atExemption.status).toBe('exempt')
    expect(beforeLongTerm.longTermDeduction.nominalRate).toBe(0)
    expect(atLongTerm.longTermDeduction.nominalRate).toBeCloseTo(0.2)
  })

  it('requires two residence years for multi-house residence deduction', () => {
    const before = calculateTransferTax(
      createInput({
        year: 2029,
        householdKind: 'multiHouse',
        holdingYears: 10,
        residenceYears: 1.999,
      }),
    )
    const at = calculateTransferTax(
      createInput({
        year: 2029,
        householdKind: 'multiHouse',
        holdingYears: 10,
        residenceYears: 2,
      }),
    )

    expect(before.longTermDeduction.residenceRate).toBe(0)
    expect(at.longTermDeduction.residenceRate).toBeCloseTo(0.04)
  })

  it('applies the special basic deduction at ten residence years and up to 3 billion won', () => {
    const beforeResidence = calculateTransferTax(
      createInput({ year: 2027, residenceYears: 9.999 }),
    )
    const atSalePrice = calculateTransferTax(
      createInput({ year: 2027, salePrice: 3_000_000_000 }),
    )
    const aboveSalePrice = calculateTransferTax(
      createInput({
        year: 2027,
        salePrice: 3_000_000_000 + ONE_WON,
      }),
    )

    expect(beforeResidence.basicDeductionKind).toBe('standard')
    expect(atSalePrice.basicDeductionKind).toBe('longResidenceSpecial')
    expect(atSalePrice.basicDeductionAmount).toBe(25_000_000)
    expect(aboveSalePrice.basicDeductionKind).toBe('standard')
  })

  it('does not grant the multi-house residence deduction for one residence year', () => {
    const result = calculateTransferTax(
      createInput({
        year: 2028,
        householdKind: 'multiHouse',
        holdingYears: 15,
        residenceYears: 1,
      }),
    )

    expect(result.longTermDeduction.residenceRate).toBe(0)
    expect(result.longTermDeduction.nominalRate).toBeCloseTo(0.15)
  })

  it('returns no tax for a loss and rejects unsupported asset kinds', () => {
    const loss = calculateTransferTax(
      createInput({ salePrice: 900_000_000, acquisitionPrice: 1_000_000_000 }),
    )

    expect(loss.status).toBe('noGain')
    expect(loss.grossGain).toBe(-100_000_000)
    expect(loss.totalTax).toBe(0)
    expect(() =>
      calculateTransferTax(
        createInput({ assetKind: 'commercial' as TransferTaxInput['assetKind'] }),
      ),
    ).toThrow(RangeError)
  })
})
