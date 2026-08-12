import { describe, expect, it } from 'vitest'

import type {
  HoldingTaxInput,
  PortfolioItem,
} from '../shared/holding-tax'
import type { TaxYear } from '../shared/tax-rules'
import { calculateHoldingTax } from '../src/holding/calc'

const HOLDING_YEARS = [2026, 2027, 2028] as const satisfies readonly TaxYear[]
const ONE_WON = 1
const OWNER_BELOW_CREDIT_AGE = 59
const NON_BINDING_PRIOR_YEAR_TAX = {
  propertyBaseTax: 10_000_000,
  comprehensiveCalculatedTax: 10_000_000,
  comprehensiveTax: 10_000_000,
} as const

const createItem = (
  overrides: Partial<PortfolioItem> = {},
): PortfolioItem => ({
  assetKind: 'apartment',
  officialPrice: 2_000_000_000,
  ownershipShare: 1,
  isSoleHouseholdOwner: true,
  residency: 'residing',
  areaKind: 'general',
  holdingYears: 3,
  residenceYears: 3,
  ...overrides,
})

type HoldingTaxContext = Pick<
  HoldingTaxInput,
  | 'ownerAge'
  | 'priorYearTax'
  | 'comprehensiveResidenceRecognition'
>

const calculate = (
  year: TaxYear,
  items: readonly PortfolioItem[],
  householdHomeCount = items.length,
  context: HoldingTaxContext = {
    ownerAge: OWNER_BELOW_CREDIT_AGE,
    priorYearTax: NON_BINDING_PRIOR_YEAR_TAX,
  },
) => calculateHoldingTax({ year, householdHomeCount, items, ...context })

describe('calculateHoldingTax single-house golden cases', () => {
  it('matches H1 for a resident one-house owner', () => {
    const expected = {
      2026: {
        deduction: 1_200_000_000,
        ratio: 0.6,
        taxableBase: 480_000_000,
        rate: 0.007,
        progressiveDeduction: 600_000,
        baseTax: 2_760_000,
        credit: 1_152_000,
        rural: 321_600,
        comprehensive: 1_929_600,
        total: 6_753_600,
      },
      2027: {
        deduction: 1_400_000_000,
        ratio: 0.7,
        taxableBase: 420_000_000,
        rate: 0.007,
        progressiveDeduction: 600_000,
        baseTax: 2_340_000,
        credit: 1_008_000,
        rural: 266_400,
        comprehensive: 1_598_400,
        total: 6_422_400,
      },
      2028: {
        deduction: 1_400_000_000,
        ratio: 0.7,
        taxableBase: 420_000_000,
        rate: 0.007,
        progressiveDeduction: 600_000,
        baseTax: 2_340_000,
        credit: 1_008_000,
        rural: 266_400,
        comprehensive: 1_598_400,
        total: 6_422_400,
      },
    } as const

    for (const year of HOLDING_YEARS) {
      const result = calculate(year, [createItem()])
      const propertyTax = result.propertyTaxes[0]
      const comprehensiveTax = result.comprehensiveTax

      expect(propertyTax).toMatchObject({
        fairMarketValueRatio: 0.45,
        fullTaxableBase: 900_000_000,
        taxableBase: 900_000_000,
        preferentialRateApplied: false,
        appliedRate: { rate: 0.004, progressiveDeduction: 630_000 },
        baseTax: 2_970_000,
        localEducationTax: 594_000,
        cityAreaTax: 1_260_000,
        totalTax: 4_824_000,
      })
      expect(result.propertyTaxTotal).toBe(4_824_000)
      expect(comprehensiveTax.basicDeduction).toBe(expected[year].deduction)
      expect(comprehensiveTax.fairMarketValueRatio).toBeCloseTo(
        expected[year].ratio,
      )
      expect(comprehensiveTax.taxableBase).toBe(expected[year].taxableBase)
      expect(comprehensiveTax.appliedRate.rate).toBeCloseTo(expected[year].rate)
      expect(comprehensiveTax.appliedRate.progressiveDeduction).toBe(
        expected[year].progressiveDeduction,
      )
      expect(comprehensiveTax.baseTax).toBe(expected[year].baseTax)
      expect(comprehensiveTax.propertyTaxCredit).toBe(expected[year].credit)
      expect(comprehensiveTax.ruralSpecialTax).toBe(expected[year].rural)
      expect(comprehensiveTax.totalTax).toBe(expected[year].comprehensive)
      expect(result.totalTax).toBe(expected[year].total)
    }
  })

  it('matches H2 and keeps the taxable threshold separate from the non-resident deduction', () => {
    const expected = {
      2026: {
        threshold: 1_200_000_000,
        deduction: 1_200_000_000,
        taxableBase: 480_000_000,
        baseTax: 2_760_000,
        credit: 1_152_000,
        comprehensive: 1_929_600,
        total: 6_753_600,
      },
      2027: {
        threshold: 1_400_000_000,
        deduction: 900_000_000,
        taxableBase: 770_000_000,
        baseTax: 5_810_000,
        credit: 1_848_000,
        comprehensive: 4_754_400,
        total: 9_578_400,
      },
      2028: {
        threshold: 1_400_000_000,
        deduction: 900_000_000,
        taxableBase: 770_000_000,
        baseTax: 5_810_000,
        credit: 1_848_000,
        comprehensive: 4_754_400,
        total: 9_578_400,
      },
    } as const

    for (const year of HOLDING_YEARS) {
      const result = calculate(year, [
        createItem({ residency: 'nonResiding' }),
      ])
      const comprehensiveTax = result.comprehensiveTax

      expect(result.propertyTaxTotal).toBe(4_824_000)
      expect(comprehensiveTax.taxableThreshold).toBe(expected[year].threshold)
      expect(comprehensiveTax.basicDeduction).toBe(expected[year].deduction)
      expect(comprehensiveTax.taxableBase).toBe(expected[year].taxableBase)
      expect(comprehensiveTax.baseTax).toBe(expected[year].baseTax)
      expect(comprehensiveTax.propertyTaxCredit).toBe(expected[year].credit)
      expect(comprehensiveTax.totalTax).toBe(expected[year].comprehensive)
      expect(result.totalTax).toBe(expected[year].total)
    }
  })

  it('matches H3 at the 1.2 billion won current-law threshold', () => {
    for (const year of HOLDING_YEARS) {
      const result = calculate(year, [
        createItem({ officialPrice: 1_200_000_000 }),
      ])

      expect(result.propertyTaxes[0]).toMatchObject({
        fullTaxableBase: 540_000_000,
        baseTax: 1_530_000,
        localEducationTax: 306_000,
        cityAreaTax: 756_000,
        totalTax: 2_592_000,
      })
      expect(result.comprehensiveTax.status).toBe('notTaxable')
      expect(result.comprehensiveTax.taxableBase).toBe(0)
      expect(result.comprehensiveTax.appliedRate.rate).toBe(0)
      expect(result.totalTax).toBe(2_592_000)
    }
  })

  it('matches H4 immediately below the new threshold', () => {
    const expectedComprehensive = {
      2026: 355_680,
      2027: 0,
      2028: 0,
    } as const
    const expectedTotal = {
      2026: 3_477_780,
      2027: 3_122_100,
      2028: 3_122_100,
    } as const

    for (const year of HOLDING_YEARS) {
      const result = calculate(year, [
        createItem({
          officialPrice: 1_390_000_000,
          residency: 'nonResiding',
        }),
      ])

      expect(result.propertyTaxes[0]).toMatchObject({
        fullTaxableBase: 625_500_000,
        baseTax: 1_872_000,
        localEducationTax: 374_400,
        cityAreaTax: 875_700,
        totalTax: 3_122_100,
      })
      expect(result.comprehensiveTax.totalTax).toBe(
        expectedComprehensive[year],
      )
      if (year === 2026) {
        expect(result.comprehensiveTax).toMatchObject({
          taxableBase: 114_000_000,
          appliedRate: { rate: 0.005, progressiveDeduction: 0 },
          baseTax: 570_000,
          propertyTaxCredit: 273_600,
          netTax: 296_400,
          ruralSpecialTax: 59_280,
        })
      }
      expect(result.totalTax).toBe(expectedTotal[year])
    }
  })

  it('matches H5 immediately above the new threshold discontinuity', () => {
    const expected = {
      2026: {
        deduction: 1_200_000_000,
        taxableBase: 126_000_000,
        baseTax: 630_000,
        credit: 302_400,
        rate: 0.005,
        progressiveDeduction: 0,
        rural: 65_520,
        comprehensive: 393_120,
        total: 3_571_020,
      },
      2027: {
        deduction: 900_000_000,
        taxableBase: 357_000_000,
        baseTax: 1_899_000,
        credit: 856_800,
        rate: 0.007,
        progressiveDeduction: 600_000,
        rural: 208_440,
        comprehensive: 1_250_640,
        total: 4_428_540,
      },
      2028: {
        deduction: 900_000_000,
        taxableBase: 357_000_000,
        baseTax: 1_899_000,
        credit: 856_800,
        rate: 0.007,
        progressiveDeduction: 600_000,
        rural: 208_440,
        comprehensive: 1_250_640,
        total: 4_428_540,
      },
    } as const

    for (const year of HOLDING_YEARS) {
      const result = calculate(year, [
        createItem({
          officialPrice: 1_410_000_000,
          residency: 'nonResiding',
        }),
      ])
      const comprehensiveTax = result.comprehensiveTax

      expect(result.propertyTaxes[0]).toMatchObject({
        fullTaxableBase: 634_500_000,
        baseTax: 1_908_000,
        localEducationTax: 381_600,
        cityAreaTax: 888_300,
        totalTax: 3_177_900,
      })
      expect(comprehensiveTax.basicDeduction).toBe(expected[year].deduction)
      expect(comprehensiveTax.taxableBase).toBe(expected[year].taxableBase)
      expect(comprehensiveTax.baseTax).toBe(expected[year].baseTax)
      expect(comprehensiveTax.propertyTaxCredit).toBe(expected[year].credit)
      expect(comprehensiveTax.appliedRate).toEqual({
        rate: expected[year].rate,
        progressiveDeduction: expected[year].progressiveDeduction,
      })
      expect(comprehensiveTax.ruralSpecialTax).toBe(expected[year].rural)
      expect(comprehensiveTax.totalTax).toBe(expected[year].comprehensive)
      expect(result.totalTax).toBe(expected[year].total)
    }
  })

  it('matches H6 and applies the reduced property-tax rate at 900 million won', () => {
    for (const year of HOLDING_YEARS) {
      const result = calculate(year, [
        createItem({ officialPrice: 900_000_000 }),
      ])

      expect(result.propertyTaxes[0]).toMatchObject({
        fairMarketValueRatio: 0.45,
        fullTaxableBase: 405_000_000,
        preferentialRateApplied: true,
        appliedRate: { rate: 0.0035, progressiveDeduction: 630_000 },
        baseTax: 787_500,
        localEducationTax: 157_500,
        cityAreaTax: 567_000,
        totalTax: 1_512_000,
      })
      expect(result.comprehensiveTax.status).toBe('notTaxable')
      expect(result.totalTax).toBe(1_512_000)
    }
  })

  it('matches H7 at a 3 billion won official price', () => {
    const expected = {
      2026: {
        taxableBase: 1_080_000_000,
        rate: 0.01,
        progressiveDeduction: 2_400_000,
        baseTax: 8_400_000,
        credit: 2_592_000,
        rural: 1_161_600,
        comprehensive: 6_969_600,
        total: 14_583_600,
      },
      2027: {
        taxableBase: 1_120_000_000,
        rate: 0.013,
        progressiveDeduction: 4_200_000,
        baseTax: 10_360_000,
        credit: 2_688_000,
        rural: 1_534_400,
        comprehensive: 9_206_400,
        total: 16_820_400,
      },
      2028: {
        taxableBase: 1_120_000_000,
        rate: 0.013,
        progressiveDeduction: 4_200_000,
        baseTax: 10_360_000,
        credit: 2_688_000,
        rural: 1_534_400,
        comprehensive: 9_206_400,
        total: 16_820_400,
      },
    } as const

    for (const year of HOLDING_YEARS) {
      const result = calculate(year, [
        createItem({ officialPrice: 3_000_000_000 }),
      ])

      expect(result.propertyTaxes[0]).toMatchObject({
        fullTaxableBase: 1_350_000_000,
        baseTax: 4_770_000,
        localEducationTax: 954_000,
        cityAreaTax: 1_890_000,
        totalTax: 7_614_000,
      })
      expect(result.comprehensiveTax.taxableBase).toBe(
        expected[year].taxableBase,
      )
      expect(result.comprehensiveTax.baseTax).toBe(expected[year].baseTax)
      expect(result.comprehensiveTax.appliedRate).toEqual({
        rate: expected[year].rate,
        progressiveDeduction: expected[year].progressiveDeduction,
      })
      expect(result.comprehensiveTax.propertyTaxCredit).toBe(
        expected[year].credit,
      )
      expect(result.comprehensiveTax.ruralSpecialTax).toBe(
        expected[year].rural,
      )
      expect(result.comprehensiveTax.totalTax).toBe(
        expected[year].comprehensive,
      )
      expect(result.totalTax).toBe(expected[year].total)
    }
  })
})

describe('calculateHoldingTax credit and burden-cap golden cases', () => {
  it('matches H12 with the rate cap applied before the amount cap', () => {
    const expected = {
      2026: {
        netTax: 1_608_000,
        creditAmount: 1_286_400,
        payableTax: 321_600,
        ruralSpecialTax: 64_320,
        comprehensiveTax: 385_920,
        totalTax: 5_209_920,
      },
      2027: {
        netTax: 1_332_000,
        creditAmount: 1_065_600,
        payableTax: 266_400,
        ruralSpecialTax: 53_280,
        comprehensiveTax: 319_680,
        totalTax: 5_143_680,
      },
      2028: {
        netTax: 1_332_000,
        creditAmount: 1_065_600,
        payableTax: 266_400,
        ruralSpecialTax: 53_280,
        comprehensiveTax: 319_680,
        totalTax: 5_143_680,
      },
    } as const

    for (const year of HOLDING_YEARS) {
      const result = calculate(
        year,
        [createItem({ holdingYears: 15, residenceYears: 15 })],
        1,
        {
          ownerAge: 70,
          priorYearTax: NON_BINDING_PRIOR_YEAR_TAX,
        },
      )
      const comprehensiveTax = result.comprehensiveTax

      expect(result.propertyTaxTotal).toBe(4_824_000)
      expect(comprehensiveTax.netTax).toBe(expected[year].netTax)
      expect(comprehensiveTax.taxCredit).toMatchObject({
        status: 'computed',
        ageRate: 0.4,
        periodRate: 0.5,
        nominalRate: 0.9,
        appliedRate: 0.8,
        amount: expected[year].creditAmount,
        isRateCapped: true,
        isAmountCapped: false,
      })
      expect(comprehensiveTax.taxBurdenCap).toMatchObject({
        status: 'computed',
        excessAmount: 0,
      })
      expect(comprehensiveTax.payableTax).toBe(expected[year].payableTax)
      expect(comprehensiveTax.ruralSpecialTax).toBe(
        expected[year].ruralSpecialTax,
      )
      expect(comprehensiveTax.totalTax).toBe(
        expected[year].comprehensiveTax,
      )
      expect(result.totalTax).toBe(expected[year].totalTax)
    }
  })

  it('matches H13 when the annual amount cap binds', () => {
    const expected = {
      2026: {
        netTax: 11_808_000,
        calculatedCreditAmount: 9_446_400,
        creditAmount: 9_446_400,
        amountCap: null,
        payableTax: 2_361_600,
        ruralSpecialTax: 472_320,
        comprehensiveTax: 2_833_920,
        totalTax: 13_237_920,
        isAmountCapped: false,
      },
      2027: {
        netTax: 16_332_000,
        calculatedCreditAmount: 13_065_600,
        creditAmount: 8_000_000,
        amountCap: 8_000_000,
        payableTax: 8_332_000,
        ruralSpecialTax: 1_666_400,
        comprehensiveTax: 9_998_400,
        totalTax: 20_402_400,
        isAmountCapped: true,
      },
      2028: {
        netTax: 19_432_000,
        calculatedCreditAmount: 15_545_600,
        creditAmount: 6_000_000,
        amountCap: 6_000_000,
        payableTax: 13_432_000,
        ruralSpecialTax: 2_686_400,
        comprehensiveTax: 16_118_400,
        totalTax: 26_522_400,
        isAmountCapped: true,
      },
    } as const

    for (const year of HOLDING_YEARS) {
      const result = calculate(
        year,
        [
          createItem({
            officialPrice: 4_000_000_000,
            holdingYears: 15,
            residenceYears: 15,
          }),
        ],
        1,
        {
          ownerAge: 70,
          priorYearTax: NON_BINDING_PRIOR_YEAR_TAX,
        },
      )
      const comprehensiveTax = result.comprehensiveTax

      expect(result.propertyTaxTotal).toBe(10_404_000)
      expect(comprehensiveTax.netTax).toBe(expected[year].netTax)
      expect(comprehensiveTax.taxCredit).toMatchObject({
        status: 'computed',
        appliedRate: 0.8,
        calculatedAmount: expected[year].calculatedCreditAmount,
        amountCap: expected[year].amountCap,
        amount: expected[year].creditAmount,
        isAmountCapped: expected[year].isAmountCapped,
      })
      expect(comprehensiveTax.payableTax).toBe(expected[year].payableTax)
      expect(comprehensiveTax.ruralSpecialTax).toBe(
        expected[year].ruralSpecialTax,
      )
      expect(comprehensiveTax.totalTax).toBe(
        expected[year].comprehensiveTax,
      )
      expect(result.totalTax).toBe(expected[year].totalTax)
    }
  })

  it('matches H14 using prior property base tax and final comprehensive tax', () => {
    const result = calculate(
      2027,
      [
        createItem({
          officialPrice: 2_500_000_000,
          holdingYears: 3,
          residenceYears: 3,
        }),
      ],
      1,
      {
        ownerAge: OWNER_BELOW_CREDIT_AGE,
        priorYearTax: {
          propertyBaseTax: 2_610_000,
          comprehensiveTax: 1_056_000,
        },
      },
    )
    const comprehensiveTax = result.comprehensiveTax

    expect(result.propertyTaxes[0]).toMatchObject({
      baseTax: 3_870_000,
      localEducationTax: 774_000,
      cityAreaTax: 1_575_000,
      totalTax: 6_219_000,
    })
    expect(comprehensiveTax.netTax).toBe(3_962_000)
    expect(comprehensiveTax.taxCredit).toMatchObject({
      status: 'computed',
      amount: 0,
    })
    expect(comprehensiveTax.taxBurdenCap).toEqual({
      status: 'computed',
      rate: 2,
      priorYearBase: 3_666_000,
      maximumTaxBurden: 7_332_000,
      currentYearBase: 7_832_000,
      excessAmount: 500_000,
    })
    expect(comprehensiveTax.payableTax).toBe(3_462_000)
    expect(comprehensiveTax.ruralSpecialTax).toBe(692_400)
    expect(comprehensiveTax.totalTax).toBe(4_154_400)
    expect(result.totalTax).toBe(10_373_400)
  })

  it('keeps the 2026 payable-tax floor but reproduces the v3 negative 2027 tax', () => {
    const priorYearTax = {
      propertyBaseTax: 0,
      comprehensiveCalculatedTax: 0,
      comprehensiveTax: 0,
    } as const
    const currentLaw = calculate(2026, [createItem()], 1, {
      ownerAge: OWNER_BELOW_CREDIT_AGE,
      priorYearTax,
    })
    const reform = calculate(2027, [createItem()], 1, {
      ownerAge: OWNER_BELOW_CREDIT_AGE,
      priorYearTax,
    })

    expect(currentLaw.comprehensiveTax).toMatchObject({
      payableTax: 0,
      ruralSpecialTax: 0,
      totalTax: 0,
    })
    expect(reform.comprehensiveTax).toMatchObject({
      netTax: 1_332_000,
      taxBurdenCap: {
        status: 'computed',
        excessAmount: 4_302_000,
      },
      payableTax: -2_970_000,
      ruralSpecialTax: -594_000,
      totalTax: -3_564_000,
    })
    expect(reform.totalTax).toBe(1_260_000)
  })

  it('matches H15 before and after unavoidable-relocation recognition', () => {
    const expectedBefore = {
      2026: { periodRate: 0.2, comprehensiveTax: 1_157_760 },
      2027: { periodRate: 0.1, comprehensiveTax: 1_118_880 },
      2028: { periodRate: 0, comprehensiveTax: 1_278_720 },
    } as const
    const expectedAfter = {
      2026: { periodRate: 0.2, comprehensiveTax: 1_157_760 },
      2027: { periodRate: 0.2, comprehensiveTax: 959_040 },
      2028: { periodRate: 0.2, comprehensiveTax: 959_040 },
    } as const
    const recognition = {
      kind: 'unavoidableRelocation',
      continuousResidenceStartDate: '2017-06-01',
      relocationDate: '2020-06-01',
      recognitionEndDate: '2028-06-01',
      reason: { kind: 'jobChangeOrTransfer' },
      destination: 'otherCityOrCounty',
    } as const

    for (const year of HOLDING_YEARS) {
      const item = createItem({ holdingYears: 8, residenceYears: 3 })
      const before = calculate(year, [item], 1, {
        ownerAge: 62,
        priorYearTax: NON_BINDING_PRIOR_YEAR_TAX,
      })
      const after = calculate(year, [item], 1, {
        ownerAge: 62,
        priorYearTax: NON_BINDING_PRIOR_YEAR_TAX,
        comprehensiveResidenceRecognition: recognition,
      })

      expect(before.comprehensiveTax.taxCredit).toMatchObject({
        status: 'computed',
        periodRate: expectedBefore[year].periodRate,
      })
      expect(before.comprehensiveTax.totalTax).toBe(
        expectedBefore[year].comprehensiveTax,
      )
      expect(after.comprehensiveTax.taxCredit).toMatchObject({
        status: 'computed',
        periodRate: expectedAfter[year].periodRate,
      })
      expect(after.comprehensiveTax.totalTax).toBe(
        expectedAfter[year].comprehensiveTax,
      )

      if (year === 2026) {
        expect(after.comprehensiveTax.residenceRecognition.status).toBe(
          'notEffective',
        )
      } else {
        expect(after.comprehensiveTax.residenceRecognition).toMatchObject({
          status: 'computed',
          creditPeriod: {
            actualYears: 3,
            recognizedYears: 3,
            years: 6,
          },
        })
      }
    }
  })
})

describe('calculateHoldingTax multi-house golden cases', () => {
  const twoHouseItems = (areaKind: PortfolioItem['areaKind']) => [
    createItem({
      officialPrice: 900_000_000,
      residency: 'residing',
      areaKind,
    }),
    createItem({
      officialPrice: 600_000_000,
      residency: 'nonResiding',
      areaKind: 'general',
    }),
  ]

  it('matches H8 for two homes outside adjusted areas', () => {
    const expected = {
      2026: {
        deduction: 900_000_000,
        ratio: 0.6,
        taxableBase: 360_000_000,
        rate: 0.007,
        progressiveDeduction: 600_000,
        baseTax: 1_920_000,
        credit: 680_727,
        rural: 247_855,
        comprehensive: 1_487_128,
        total: 5_555_128,
      },
      2027: {
        deduction: 700_000_000,
        ratio: 0.7,
        taxableBase: 560_000_000,
        rate: 0.007,
        progressiveDeduction: 600_000,
        baseTax: 3_320_000,
        credit: 1_058_909,
        rural: 452_218,
        comprehensive: 2_713_309,
        total: 6_781_309,
      },
      2028: {
        deduction: 700_000_000,
        ratio: 0.7,
        taxableBase: 560_000_000,
        rate: 0.007,
        progressiveDeduction: 600_000,
        baseTax: 3_320_000,
        credit: 1_058_909,
        rural: 452_218,
        comprehensive: 2_713_309,
        total: 6_781_309,
      },
    } as const

    for (const year of HOLDING_YEARS) {
      const result = calculate(year, twoHouseItems('general'))

      expect(result.propertyTaxes.map(({ totalTax }) => totalTax)).toEqual([
        2_592_000,
        1_476_000,
      ])
      expect(result.propertyTaxTotal).toBe(4_068_000)
      expect(result.comprehensiveTax.propertyTaxSubtotal).toEqual({
        taxableBase: 900_000_000,
        appliedRate: { rate: 0.004, progressiveDeduction: 630_000 },
        calculatedTax: 2_970_000,
        propertyTax: 2_340_000,
      })
      expect(result.comprehensiveTax.ownedOfficialPriceTotal).toBe(
        1_500_000_000,
      )
      expect(result.comprehensiveTax.residentOwnedOfficialPrice).toBe(
        900_000_000,
      )
      expect(result.comprehensiveTax.basicDeduction).toBe(
        expected[year].deduction,
      )
      expect(result.comprehensiveTax.fairMarketValueRatio).toBeCloseTo(
        expected[year].ratio,
      )
      expect(result.comprehensiveTax.taxableBase).toBe(
        expected[year].taxableBase,
      )
      expect(result.comprehensiveTax.appliedRate).toEqual({
        rate: expected[year].rate,
        progressiveDeduction: expected[year].progressiveDeduction,
      })
      expect(result.comprehensiveTax.baseTax).toBe(expected[year].baseTax)
      expect(result.comprehensiveTax.propertyTaxCredit).toBe(
        expected[year].credit,
      )
      expect(result.comprehensiveTax.ruralSpecialTax).toBe(
        expected[year].rural,
      )
      expect(result.comprehensiveTax.totalTax).toBe(
        expected[year].comprehensive,
      )
      expect(result.totalTax).toBe(expected[year].total)
    }
  })

  it('matches H9 and elevates only the 2028 adjusted-area ratio', () => {
    const expectedRatio = { 2026: 0.6, 2027: 0.7, 2028: 0.8 } as const
    const expectedTaxableBase = {
      2026: 360_000_000,
      2027: 560_000_000,
      2028: 640_000_000,
    } as const
    const expectedComprehensive = {
      2026: 1_487_128,
      2027: 2_713_309,
      2028: 3_491_782,
    } as const
    const expectedIntermediate = {
      2026: {
        rate: 0.007,
        progressiveDeduction: 600_000,
        baseTax: 1_920_000,
        credit: 680_727,
        rural: 247_855,
      },
      2027: {
        rate: 0.007,
        progressiveDeduction: 600_000,
        baseTax: 3_320_000,
        credit: 1_058_909,
        rural: 452_218,
      },
      2028: {
        rate: 0.013,
        progressiveDeduction: 4_200_000,
        baseTax: 4_120_000,
        credit: 1_210_182,
        rural: 581_964,
      },
    } as const
    const expectedTotal = {
      2026: 5_555_128,
      2027: 6_781_309,
      2028: 7_559_782,
    } as const

    for (const year of HOLDING_YEARS) {
      const result = calculate(year, twoHouseItems('adjusted'))

      expect(result.comprehensiveTax.fairMarketValueRatio).toBeCloseTo(
        expectedRatio[year],
      )
      expect(result.comprehensiveTax.taxableBase).toBe(
        expectedTaxableBase[year],
      )
      expect(result.comprehensiveTax.appliedRate).toEqual({
        rate: expectedIntermediate[year].rate,
        progressiveDeduction:
          expectedIntermediate[year].progressiveDeduction,
      })
      expect(result.comprehensiveTax.baseTax).toBe(
        expectedIntermediate[year].baseTax,
      )
      expect(result.comprehensiveTax.propertyTaxCredit).toBe(
        expectedIntermediate[year].credit,
      )
      expect(result.comprehensiveTax.ruralSpecialTax).toBe(
        expectedIntermediate[year].rural,
      )
      expect(result.comprehensiveTax.totalTax).toBe(
        expectedComprehensive[year],
      )
      expect(result.totalTax).toBe(expectedTotal[year])
    }
  })

  it('matches H10 and counts three properties regardless of their shares', () => {
    const items = [
      createItem({
        officialPrice: 800_000_000,
        residency: 'residing',
      }),
      createItem({
        officialPrice: 700_000_000,
        residency: 'nonResiding',
      }),
      createItem({
        officialPrice: 500_000_000,
        residency: 'nonResiding',
      }),
    ]
    const expected = {
      2026: {
        deduction: 900_000_000,
        ratio: 0.6,
        taxableBase: 660_000_000,
        rate: 0.01,
        progressiveDeduction: 2_400_000,
        baseTax: 4_200_000,
        credit: 1_105_381,
        rural: 618_924,
        comprehensive: 3_713_543,
        total: 8_885_543,
      },
      2027: {
        deduction: 600_000_000,
        ratio: 0.7,
        taxableBase: 980_000_000,
        rate: 0.013,
        progressiveDeduction: 4_200_000,
        baseTax: 8_540_000,
        credit: 1_641_324,
        rural: 1_379_735,
        comprehensive: 8_278_411,
        total: 13_450_411,
      },
      2028: {
        deduction: 600_000_000,
        ratio: 0.8,
        taxableBase: 1_120_000_000,
        rate: 0.013,
        progressiveDeduction: 4_200_000,
        baseTax: 10_360_000,
        credit: 1_875_799,
        rural: 1_696_840,
        comprehensive: 10_181_041,
        total: 15_353_041,
      },
    } as const

    for (const year of HOLDING_YEARS) {
      const result = calculate(year, items)

      expect(result.propertyTaxes.map(({ totalTax }) => totalTax)).toEqual([
        2_220_000,
        1_848_000,
        1_104_000,
      ])
      expect(result.propertyTaxTotal).toBe(5_172_000)
      expect(result.comprehensiveTax.homeCount).toBe(3)
      expect(result.comprehensiveTax.basicDeduction).toBe(
        expected[year].deduction,
      )
      expect(result.comprehensiveTax.fairMarketValueRatio).toBeCloseTo(
        expected[year].ratio,
      )
      expect(result.comprehensiveTax.taxableBase).toBe(
        expected[year].taxableBase,
      )
      expect(result.comprehensiveTax.appliedRate).toEqual({
        rate: expected[year].rate,
        progressiveDeduction: expected[year].progressiveDeduction,
      })
      expect(result.comprehensiveTax.baseTax).toBe(expected[year].baseTax)
      expect(result.comprehensiveTax.propertyTaxCredit).toBe(
        expected[year].credit,
      )
      expect(result.comprehensiveTax.ruralSpecialTax).toBe(
        expected[year].rural,
      )
      expect(result.comprehensiveTax.totalTax).toBe(
        expected[year].comprehensive,
      )
      expect(result.totalTax).toBe(expected[year].total)
    }
  })
})

describe('calculateHoldingTax boundaries, ownership, and validation', () => {
  it('preserves the intentional 2027 discontinuity one won above 1.4 billion won', () => {
    const atThreshold = calculate(2027, [
      createItem({
        officialPrice: 1_400_000_000,
        residency: 'nonResiding',
      }),
    ])
    const aboveThreshold = calculate(2027, [
      createItem({
        officialPrice: 1_400_000_000 + ONE_WON,
        residency: 'nonResiding',
      }),
    ])

    expect(atThreshold.comprehensiveTax.status).toBe('notTaxable')
    expect(atThreshold.comprehensiveTax.totalTax).toBe(0)
    expect(aboveThreshold.comprehensiveTax.status).toBe('taxable')
    expect(aboveThreshold.comprehensiveTax.basicDeduction).toBe(900_000_000)
    expect(aboveThreshold.comprehensiveTax.taxableBase).toBe(350_000_001)
    expect(aboveThreshold.comprehensiveTax.totalTax).toBe(1_212_000)
  })

  it('removes the reduced property-tax rate one won above 900 million won', () => {
    const atThreshold = calculate(2026, [
      createItem({ officialPrice: 900_000_000 }),
    ])
    const aboveThreshold = calculate(2026, [
      createItem({ officialPrice: 900_000_000 + ONE_WON }),
    ])

    expect(atThreshold.propertyTaxes[0].preferentialRateApplied).toBe(true)
    expect(atThreshold.propertyTaxTotal).toBe(1_512_000)
    expect(aboveThreshold.propertyTaxes[0].preferentialRateApplied).toBe(false)
    expect(aboveThreshold.propertyTaxes[0].appliedRate.rate).toBeCloseTo(0.004)
    expect(aboveThreshold.propertyTaxTotal).toBe(1_755_000)
  })

  it('matches the v3 property-tax taxable-base cap scenario exactly', () => {
    const result = calculate(2027, [
      createItem({
        officialPrice: 4_800_000_000,
        priorOfficialPrice: 4_000_000_000,
        holdingYears: 5,
        residenceYears: 10,
      }),
    ], 1, {
      ownerAge: 67,
      priorYearTax: NON_BINDING_PRIOR_YEAR_TAX,
    })

    expect(result.propertyTaxes[0]).toMatchObject({
      priorOfficialPrice: 4_000_000_000,
      uncappedFullTaxableBase: 2_160_000_000,
      fullTaxableBaseCap: 1_908_000_000,
      taxableBaseCapApplied: true,
      fullTaxableBase: 1_908_000_000,
      fullBaseTax: 7_002_000,
      baseTax: 7_002_000,
      cityAreaTax: 2_671_200,
      localEducationTax: 1_400_400,
      totalTax: 11_073_600,
    })
  })

  it('does not cap the property-tax base without a prior official price', () => {
    const result = calculate(2027, [
      createItem({ officialPrice: 4_800_000_000 }),
    ])

    expect(result.propertyTaxes[0]).toMatchObject({
      priorOfficialPrice: null,
      uncappedFullTaxableBase: 2_160_000_000,
      fullTaxableBaseCap: null,
      taxableBaseCapApplied: false,
      fullTaxableBase: 2_160_000_000,
    })
  })

  it('uses the inclusive 2.5 billion won comprehensive-tax bracket boundary', () => {
    const baseItems = [
      createItem({
        officialPrice: 1_200_000_000,
        residency: 'nonResiding',
      }),
      createItem({
        officialPrice: 1_200_000_000,
        residency: 'nonResiding',
      }),
      createItem({
        officialPrice: 1_125_000_000,
        residency: 'nonResiding',
      }),
    ]
    const atThreshold = calculate(2028, baseItems)
    const aboveThreshold = calculate(2028, [
      baseItems[0],
      baseItems[1],
      { ...baseItems[2], officialPrice: baseItems[2].officialPrice + ONE_WON },
    ])

    expect(atThreshold.comprehensiveTax.taxableBase).toBe(2_500_000_000)
    expect(atThreshold.comprehensiveTax.appliedRate).toEqual({
      rate: 0.02,
      progressiveDeduction: 12_600_000,
    })
    expect(aboveThreshold.comprehensiveTax.taxableBase).toBe(2_500_000_001)
    expect(aboveThreshold.comprehensiveTax.appliedRate).toEqual({
      rate: 0.03,
      progressiveDeduction: 37_600_000,
    })
  })

  it('calculates full property tax before apportioning each component by ownership share', () => {
    const result = calculate(2026, [
      createItem({
        ownershipShare: 0.5,
        isSoleHouseholdOwner: true,
      }),
    ])
    const propertyTax = result.propertyTaxes[0]

    expect(propertyTax).toMatchObject({
      fullOfficialPrice: 2_000_000_000,
      ownedOfficialPrice: 1_000_000_000,
      fullTaxableBase: 900_000_000,
      taxableBase: 450_000_000,
      fullBaseTax: 2_970_000,
      baseTax: 1_485_000,
      localEducationTax: 297_000,
      cityAreaTax: 630_000,
      totalTax: 2_412_000,
    })
    expect(result.comprehensiveTax.ownedOfficialPriceTotal).toBe(1_000_000_000)
    expect(result.comprehensiveTax.status).toBe('notTaxable')
    expect(result.comprehensiveTaxHouseholdKind).toBe('oneHouse')
  })

  it('matches H11 by deriving different one-house judgments for a jointly owned household home', () => {
    const expected = {
      2026: {
        ratio: 0.6,
        taxableBase: 60_000_000,
        baseTax: 300_000,
        credit: 144_000,
        rural: 31_200,
        comprehensive: 187_200,
        total: 2_599_200,
      },
      2027: {
        ratio: 0.7,
        taxableBase: 70_000_000,
        baseTax: 350_000,
        credit: 168_000,
        rural: 36_400,
        comprehensive: 218_400,
        total: 2_630_400,
      },
      2028: {
        ratio: 0.7,
        taxableBase: 70_000_000,
        baseTax: 350_000,
        credit: 168_000,
        rural: 36_400,
        comprehensive: 218_400,
        total: 2_630_400,
      },
    } as const

    for (const year of HOLDING_YEARS) {
      const result = calculate(year, [
        createItem({
          ownershipShare: 0.5,
          isSoleHouseholdOwner: false,
        }),
      ])
      const comprehensiveTax = result.comprehensiveTax

      expect(result.propertyTaxHouseholdKind).toBe('oneHouse')
      expect(result.comprehensiveTaxHouseholdKind).toBe('multiHouse')
      expect(result.propertyTaxes[0]).toMatchObject({
        fairMarketValueRatio: 0.45,
        fullTaxableBase: 900_000_000,
        taxableBase: 450_000_000,
        baseTax: 1_485_000,
        localEducationTax: 297_000,
        cityAreaTax: 630_000,
        totalTax: 2_412_000,
      })
      expect(comprehensiveTax.ownedOfficialPriceTotal).toBe(1_000_000_000)
      expect(comprehensiveTax.taxableThreshold).toBe(900_000_000)
      expect(comprehensiveTax.basicDeduction).toBe(900_000_000)
      expect(comprehensiveTax.fairMarketValueRatio).toBeCloseTo(
        expected[year].ratio,
      )
      expect(comprehensiveTax.taxableBase).toBe(expected[year].taxableBase)
      expect(comprehensiveTax.appliedRate).toEqual({
        rate: 0.005,
        progressiveDeduction: 0,
      })
      expect(comprehensiveTax.baseTax).toBe(expected[year].baseTax)
      expect(comprehensiveTax.propertyTaxFairMarketValueRatio).toBeCloseTo(
        0.6,
      )
      expect(comprehensiveTax.propertyTaxCredit).toBe(expected[year].credit)
      expect(comprehensiveTax.ruralSpecialTax).toBe(expected[year].rural)
      expect(comprehensiveTax.totalTax).toBe(expected[year].comprehensive)
      expect(result.totalTax).toBe(expected[year].total)
    }
  })

  it('counts co-owned properties as whole homes for the 2028 three-home ratio', () => {
    const items = [1_000_000_000, 1_000_000_000, 1_000_000_000].map(
      (officialPrice) =>
        createItem({
          officialPrice,
          ownershipShare: 0.5,
          residency: 'nonResiding',
        }),
    )
    const result = calculate(2028, items)

    expect(result.comprehensiveTax.homeCount).toBe(3)
    expect(result.comprehensiveTax.ownedOfficialPriceTotal).toBe(1_500_000_000)
    expect(result.comprehensiveTax.fairMarketValueRatio).toBeCloseTo(0.8)
  })

  it('accepts a household home count greater than the taxed item count', () => {
    expect(() =>
      calculateHoldingTax({
        year: 2026,
        householdHomeCount: 2,
        items: [createItem()],
      }),
    ).not.toThrow()
  })

  it('reports missing credit and burden-cap inputs without returning a confident total', () => {
    const result = calculateHoldingTax({
      year: 2027,
      householdHomeCount: 1,
      items: [createItem()],
    })

    expect(result.calculationStatus).toBe('missingInputs')
    expect(result.comprehensiveTax.taxCredit).toEqual({
      status: 'notComputed',
      missingInputs: ['ownerAge'],
      amount: null,
    })
    expect(result.comprehensiveTax.taxBurdenCap).toEqual({
      status: 'notComputed',
      rate: 2,
      missingInputs: [
        'priorYearPropertyBaseTax',
        'priorYearComprehensiveTax',
      ],
      excessAmount: 0,
    })
    expect(result.comprehensiveTax.payableTax).toBeNull()
    expect(result.comprehensiveTax.ruralSpecialTax).toBeNull()
    expect(result.comprehensiveTax.totalTax).toBeNull()
    expect(result.totalTax).toBeNull()
  })

  it('rejects a household home count smaller than the taxed item count', () => {
    expect(() =>
      calculateHoldingTax({
        year: 2026,
        householdHomeCount: 1,
        items: [createItem(), createItem()],
      }),
    ).toThrow(RangeError)
  })

  it('rejects a zero household home count', () => {
    expect(() =>
      calculateHoldingTax({
        year: 2026,
        householdHomeCount: 0,
        items: [createItem()],
      }),
    ).toThrow(RangeError)
  })

  it('rejects unsupported assets and invalid portfolio facts', () => {
    expect(() =>
      calculateHoldingTax({ year: 2026, householdHomeCount: 0, items: [] }),
    ).toThrow(RangeError)
    expect(() =>
      calculate(2026, [createItem({ officialPrice: 1.5 })]),
    ).toThrow(RangeError)
    expect(() =>
      calculate(2026, [createItem({ ownershipShare: 0 })]),
    ).toThrow(RangeError)
    expect(() =>
      calculate(2026, [
        createItem({ assetKind: 'commercial' as PortfolioItem['assetKind'] }),
      ]),
    ).toThrow(RangeError)
    expect(() =>
      calculate(2026, [
        createItem({
          isSoleHouseholdOwner: 'yes' as unknown as boolean,
        }),
      ]),
    ).toThrow(RangeError)
  })

  it('rejects invalid owner, period, and prior-year facts when provided', () => {
    expect(() =>
      calculateHoldingTax({
        year: 2027,
        householdHomeCount: 1,
        items: [createItem()],
        ownerAge: -1,
        priorYearTax: NON_BINDING_PRIOR_YEAR_TAX,
      }),
    ).toThrow(RangeError)
    expect(() =>
      calculateHoldingTax({
        year: 2027,
        householdHomeCount: 1,
        items: [createItem()],
        ownerAge: OWNER_BELOW_CREDIT_AGE,
        priorYearTax: {
          propertyBaseTax: 1.5,
          comprehensiveCalculatedTax: 0,
        },
      }),
    ).toThrow(RangeError)
    expect(() =>
      calculate(2027, [
        createItem({
          holdingYears: undefined as unknown as number,
        }),
      ]),
    ).toThrow(RangeError)
    expect(() =>
      calculate(2027, [createItem({ residenceYears: -1 })]),
    ).toThrow(RangeError)
    expect(() =>
      calculate(2027, [createItem({ priorOfficialPrice: 1.5 })]),
    ).toThrow(RangeError)
  })
})
