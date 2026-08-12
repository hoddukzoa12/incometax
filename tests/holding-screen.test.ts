import { describe, expect, it, vi } from 'vitest'

import type { PortfolioItemSeed } from '../shared/portfolio'
import { calculateHoldingTax } from '../src/holding/calc'
import { calculatePortfolioHoldingTax } from '../src/holding-screen/calculation'
import {
  type HoldingTaxConditionValues,
} from '../src/holding-screen/condition-values'
import { ownershipShareFromFraction } from '../src/portfolio/ownership-share'
import { createStoredPortfolioItem } from '../src/portfolio/state'

const seed = (
  overrides: Partial<PortfolioItemSeed> = {},
): PortfolioItemSeed => ({
  assetKind: 'apartment',
  complexId: 'golden-h11',
  legalDongCode: '1168010600',
  complexName: 'H11 공동명의 주택',
  address: '서울특별시 강남구 테스트로 11',
  dong: '101',
  ho: '1101',
  exclusiveArea: 84.99,
  officialPrice: 2_000_000_000,
  officialPriceBaseDate: '2026-01-01',
  priorOfficialPrices: [{ baseDate: '2025-01-01', price: 2_000_000_000 }],
  ...overrides,
})

const createEunmaItem = (id: string) => ({
  ...createStoredPortfolioItem(seed({
    complexId: id,
    complexName: '은마',
    officialPrice: 2_237_000_000,
    priorOfficialPrices: [{
      baseDate: '2025-01-01',
      price: 1_708_000_000,
    }],
  }), id),
  residency: 'residing' as const,
})

const NO_OFFICIAL_PRICE_GROWTH = 0

const conditionsFor = (
  items: readonly { readonly id: string }[],
  overrides: Partial<HoldingTaxConditionValues> = {},
): HoldingTaxConditionValues => ({
  ownerAge: 0,
  // 세법 규칙을 고정하는 케이스다. 제품 기본 상승률이 바뀌어도 흔들리면 안 되므로
  // 상승률은 0 으로 못 박는다. 상승률 자체를 보는 케이스는 따로 값을 넘긴다.
  annualOfficialPriceGrowthRate: NO_OFFICIAL_PRICE_GROWTH,
  items: Object.fromEntries(items.map(({ id }) => [id, {
    holdingYears: 0,
    residenceYears: 0,
    continuesResidence: null,
    qualifyingRelocation: null,
  }])),
  ...overrides,
})

describe('holding-tax screen boundary', () => {
  it('passes the H11 50:50 ownership facts to the engine and reproduces H11', () => {
    const h11 = {
      ...createStoredPortfolioItem(seed(), 'h11'),
      ownershipShare: ownershipShareFromFraction(0.5),
      isSoleHouseholdOwner: false,
      residency: 'residing' as const,
      areaKind: 'general' as const,
      acquisitionDate: '2025-06-01',
      residenceYears: 1,
    }
    const calculator = vi.fn(calculateHoldingTax)
    const comparison = calculatePortfolioHoldingTax(
      [h11],
      conditionsFor([h11], {
        ownerAge: 59,
        items: {
          h11: {
            holdingYears: 1,
            residenceYears: 1,
            continuesResidence: true,
            qualifyingRelocation: null,
          },
        },
      }),
      calculator,
    )

    expect(comparison.status).toBe('calculated')
    if (comparison.status !== 'calculated') return
    const currentReform = comparison.calculations.find(
      ({ year }) => year === 2027,
    )!

    expect(currentReform.input).toMatchObject({
      year: 2027,
      householdHomeCount: 1,
      ownerAge: 60,
      items: [{
        officialPrice: 2_000_000_000,
        ownershipShare: 0.5,
        isSoleHouseholdOwner: false,
        residency: 'residing',
        areaKind: 'general',
        holdingYears: 2,
        residenceYears: 2,
      }],
    })
    expect(calculator).toHaveBeenCalledWith(currentReform.input)
    expect(currentReform.result.propertyTaxes[0]).toMatchObject({
      fairMarketValueRatio: 0.45,
      totalTax: 2_412_000,
    })
    expect(currentReform.result.comprehensiveTax).toMatchObject({
      basicDeduction: 900_000_000,
      totalTax: 218_400,
    })
    expect(currentReform.result.totalTax).toBe(2_630_400)
    expect(comparison.calculations.map(({ input }) => ({
      year: input.year,
      ownerAge: input.ownerAge,
      holdingYears: input.items[0].holdingYears,
    }))).toEqual([
      { year: 2026, ownerAge: 59, holdingYears: 1 },
      { year: 2027, ownerAge: 60, holdingYears: 2 },
      { year: 2028, ownerAge: 61, holdingYears: 3 },
      { year: 2029, ownerAge: 62, holdingYears: 4 },
      { year: 2030, ownerAge: 63, holdingYears: 5 },
    ])
  })

  it('filters zero-share homes from engine items but keeps the full household count', () => {
    const owned = {
      ...createStoredPortfolioItem(seed(), 'owned'),
      acquisitionDate: '2025-06-01',
      residenceYears: 1,
      residency: 'residing' as const,
    }
    const spouseOnly = {
      ...createStoredPortfolioItem(seed({
        complexId: 'spouse-only',
        complexName: '배우자 단독소유 주택',
        officialPrice: null,
        officialPriceBaseDate: null,
        priorOfficialPrices: [],
      }), 'spouse-only'),
      ownershipShare: ownershipShareFromFraction(0),
    }
    const calculator = vi.fn(calculateHoldingTax)
    const comparison = calculatePortfolioHoldingTax(
      [owned, spouseOnly],
      conditionsFor([owned], {
        ownerAge: 59,
        items: {
          owned: {
            holdingYears: 1,
            residenceYears: 1,
            continuesResidence: true,
            qualifyingRelocation: null,
          },
        },
      }),
      calculator,
    )

    expect(comparison.status).toBe('calculated')
    if (comparison.status !== 'calculated') return
    for (const { input } of comparison.calculations) {
      expect(input.householdHomeCount).toBe(2)
      expect(input.items).toHaveLength(1)
      expect(input.items[0].officialPrice).toBe(2_000_000_000)
    }
  })

  it('routes a planned qualifying move into residence recognition', () => {
    const item = {
      ...createStoredPortfolioItem(seed({ complexId: 'golden-h15' }), 'h15'),
      residency: 'residing' as const,
    }
    const comparison = calculatePortfolioHoldingTax(
      [item],
      conditionsFor([item], {
        ownerAge: 62,
        items: {
          h15: {
            holdingYears: 8,
            residenceYears: 3,
            continuesResidence: false,
            qualifyingRelocation: true,
          },
        },
      }),
    )

    expect(comparison.status).toBe('calculated')
    if (comparison.status !== 'calculated') return
    expect(comparison.calculations.map(({ result }) =>
      result.comprehensiveTax.residenceRecognition.creditPeriod)).toEqual([
      { basis: 'comprehensiveTaxCreditResidence', actualYears: 3,
        recognizedYears: 0, years: 3 },
      { basis: 'comprehensiveTaxCreditResidence', actualYears: 3,
        recognizedYears: 1, years: 4 },
      { basis: 'comprehensiveTaxCreditResidence', actualYears: 3,
        recognizedYears: 2, years: 5 },
      // 인정 기간은 3년에서 멈춘다 (unavoidableRelocationMaximumYears).
      { basis: 'comprehensiveTaxCreditResidence', actualYears: 3,
        recognizedYears: 3, years: 6 },
      { basis: 'comprehensiveTaxCreditResidence', actualYears: 3,
        recognizedYears: 3, years: 6 },
    ])
  })

  it('does not call the engine when a taxed item lacks an official price', () => {
    const incomplete = createStoredPortfolioItem(seed({
      officialPrice: null,
      officialPriceBaseDate: null,
      priorOfficialPrices: [],
    }), 'incomplete')
    const calculator = vi.fn(calculateHoldingTax)

    const comparison = calculatePortfolioHoldingTax(
      [incomplete],
      conditionsFor([incomplete]),
      calculator,
    )

    expect(comparison).toMatchObject({
      status: 'missingOfficialPrices',
      missingItems: [{ id: 'incomplete' }],
    })
    expect(calculator).not.toHaveBeenCalled()
  })

  it('does not call the engine before required calculation conditions exist', () => {
    const calculator = vi.fn(calculateHoldingTax)

    const comparison = calculatePortfolioHoldingTax(
      [createStoredPortfolioItem(seed(), 'unanswered')],
      conditionsFor([{ id: 'unanswered' }]),
      calculator,
    )

    expect(comparison).toMatchObject({
      status: 'missingConditions',
      missingConditions: [
        { kind: 'residency', item: { id: 'unanswered' } },
      ],
    })
    expect(calculator).not.toHaveBeenCalled()
  })

  it('derives joint ownership directly from a share below 100%', () => {
    const complete = {
      ...createStoredPortfolioItem(seed(), 'ownership-derived'),
      isSoleHouseholdOwner: null,
      acquisitionDate: '2025-06-01',
      residenceYears: 0,
      residency: 'nonResiding' as const,
    }
    const calculator = vi.fn(calculateHoldingTax)
    const fullShare = calculatePortfolioHoldingTax(
      [complete],
      conditionsFor([complete], {
        ownerAge: 59,
        items: {
          'ownership-derived': {
            holdingYears: 1,
            residenceYears: 0,
            continuesResidence: false,
            qualifyingRelocation: false,
          },
        },
      }),
      calculator,
    )

    expect(fullShare.status).toBe('calculated')
    if (fullShare.status !== 'calculated') return
    expect(fullShare.calculations[0].input.items[0]
      .isSoleHouseholdOwner).toBe(true)

    calculator.mockClear()
    const partialShare = calculatePortfolioHoldingTax(
      [{
        ...complete,
        ownershipShare: ownershipShareFromFraction(0.5),
      }],
      conditionsFor([complete], {
        ownerAge: 59,
        items: {
          'ownership-derived': {
            holdingYears: 1,
            residenceYears: 0,
            continuesResidence: false,
            qualifyingRelocation: false,
          },
        },
      }),
      calculator,
    )
    expect(partialShare.status).toBe('calculated')
    if (partialShare.status !== 'calculated') return
    expect(partialShare.calculations[0].input.items[0]
      .isSoleHouseholdOwner).toBe(false)
  })

  it('uses the observed 2025 price and rules for the 2026 burden cap', () => {
    const eunma = createEunmaItem('eunma')
    const comparison = calculatePortfolioHoldingTax(
      [eunma],
      conditionsFor([eunma], {
        items: {
          eunma: {
            holdingYears: 0,
            residenceYears: 0,
            continuesResidence: true,
            qualifyingRelocation: null,
          },
        },
      }),
    )

    expect(comparison.status).toBe('calculated')
    if (comparison.status !== 'calculated') return
    const current = comparison.calculations[0]

    expect(current.input.priorYearTax).toEqual({
      propertyBaseTax: 2_444_400,
      comprehensiveCalculatedTax: 802_080,
      comprehensiveTax: 802_080,
    })
    expect(current.result.comprehensiveTax.taxBurdenCap).toEqual({
      status: 'computed',
      rate: 1.5,
      priorYearBase: 3_246_480,
      maximumTaxBurden: 4_869_720,
      currentYearBase: 5_304_562,
      excessAmount: 434_842,
    })
    expect(current.result).toMatchObject({
      propertyTaxTotal: 4_321_382,
      comprehensiveTax: {
        netTax: 2_658_832,
        payableTax: 2_223_990,
        ruralSpecialTax: 444_798,
        totalTax: 2_668_788,
      },
      totalTax: 6_990_170,
    })
    const beforeBurdenCap = calculateHoldingTax({
      ...current.input,
      priorYearTax: undefined,
    })
    expect(beforeBurdenCap.totalTax).toBe(7_511_980)
  })

  it.each([
    {
      annualOfficialPriceGrowthRate: 0,
      expected: [
        { year: 2027, officialPrice: 2_237_000_000, priorOfficialPrice: 2_237_000_000, totalTax: 7_999_398 },
        { year: 2028, officialPrice: 2_237_000_000, priorOfficialPrice: 2_237_000_000, totalTax: 7_999_398 },
      ],
    },
    {
      annualOfficialPriceGrowthRate: 0.05,
      expected: [
        { year: 2027, officialPrice: 2_348_850_000, priorOfficialPrice: 2_237_000_000, totalTax: 9_205_852 },
        { year: 2028, officialPrice: 2_466_292_500, priorOfficialPrice: 2_348_850_000, totalTax: 10_579_224 },
      ],
    },
    {
      annualOfficialPriceGrowthRate: 0.1,
      expected: [
        { year: 2027, officialPrice: 2_460_700_000, priorOfficialPrice: 2_237_000_000, totalTax: 10_334_955 },
        { year: 2028, officialPrice: 2_706_770_000, priorOfficialPrice: 2_460_700_000, totalTax: 13_206_205 },
      ],
    },
  ])(
    'projects 2027/2028 prices and taxes at annual rate $annualOfficialPriceGrowthRate',
    ({ annualOfficialPriceGrowthRate, expected }) => {
      const eunma = createEunmaItem('eunma-growth')
      const comparison = calculatePortfolioHoldingTax(
        [eunma],
        conditionsFor([eunma], {
          annualOfficialPriceGrowthRate,
          items: {
            'eunma-growth': {
              holdingYears: 0,
              residenceYears: 0,
              continuesResidence: true,
              qualifyingRelocation: null,
            },
          },
        }),
      )

      expect(comparison.status).toBe('calculated')
      if (comparison.status !== 'calculated') return
      const future = comparison.calculations.slice(1)
      // 이 테스트가 고정하는 것은 2027·2028 이다. 추이 화면이 연도를 더 그리더라도
      // 그 두 해의 값은 흔들리면 안 된다.
      const projected = future.slice(0, expected.length)
      expect(projected.map(({ year, input, result }) => ({
        year,
        officialPrice: input.items[0].officialPrice,
        priorOfficialPrice: input.items[0].priorOfficialPrice,
        totalTax: result.totalTax,
      }))).toEqual(expected)
      for (const { result } of future) {
        expect(result.comprehensiveTax.taxBurdenCap).toMatchObject({
          status: 'computed',
          excessAmount: 0,
        })
      }
    },
  )

  it('applies the future burden cap when projected price growth exceeds it', () => {
    const eunma = createEunmaItem('eunma-binding-cap')
    const comparison = calculatePortfolioHoldingTax(
      [eunma],
      conditionsFor([eunma], {
        annualOfficialPriceGrowthRate: 1,
        items: {
          'eunma-binding-cap': {
            holdingYears: 0,
            residenceYears: 0,
            continuesResidence: true,
            qualifyingRelocation: null,
          },
        },
      }),
    )

    expect(comparison.status).toBe('calculated')
    if (comparison.status !== 'calculated') return
    // 상한이 걸리기 시작하는 첫 두 해를 고정한다. 추이 화면이 연도를 더 그려도
    // 이 두 해의 값은 흔들리면 안 된다.
    expect(comparison.calculations.slice(1, 3).map(({ year, result }) => ({
      year,
      totalTax: result.totalTax,
      taxBurdenCap: result.comprehensiveTax.taxBurdenCap,
    }))).toEqual([
      {
        year: 2027,
        totalTax: 13_237_569,
        taxBurdenCap: {
          status: 'computed',
          rate: 2,
          priorYearBase: 4_869_720,
          maximumTaxBurden: 9_739_440,
          currentYearBase: 26_833_115,
          excessAmount: 17_093_675,
        },
      },
      {
        year: 2028,
        totalTax: 26_475_138,
        taxBurdenCap: {
          status: 'computed',
          rate: 2,
          priorYearBase: 9_739_440,
          maximumTaxBurden: 19_478_880,
          currentYearBase: 125_230_455,
          excessAmount: 105_751_575,
        },
      },
    ])
  })

  it('keeps the 2026 upper-bound calculation when the 2025 price is absent', () => {
    const newBuild = {
      ...createStoredPortfolioItem(seed({
        complexId: 'new-build',
        priorOfficialPrices: [],
      }), 'new-build'),
      residency: 'residing' as const,
    }
    const comparison = calculatePortfolioHoldingTax(
      [newBuild],
      conditionsFor([newBuild], {
        items: {
          'new-build': {
            holdingYears: 0,
            residenceYears: 0,
            continuesResidence: true,
            qualifyingRelocation: null,
          },
        },
      }),
    )

    expect(comparison.status).toBe('calculated')
    if (comparison.status !== 'calculated') return
    expect(comparison.missingPriorPriceItems).toEqual([
      expect.objectContaining({ id: 'new-build' }),
    ])
    expect(comparison.calculations[0].result.comprehensiveTax
      .taxBurdenCap).toEqual({
      status: 'notComputed',
      rate: 1.5,
      missingInputs: [
        'priorYearPropertyBaseTax',
        'priorYearComprehensiveCalculatedTax',
      ],
      excessAmount: 0,
    })
    expect(comparison.calculations[0].result.totalTax).not.toBeNull()
  })
})
