import { describe, expect, it, vi } from 'vitest'

import type { PortfolioItemSeed } from '../shared/portfolio'
import { calculateHoldingTax } from '../src/holding/calc'
import { calculatePortfolioHoldingTax } from '../src/holding-screen/calculation'
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
      '1967-06-01',
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
        residenceYears: 1,
      }],
    })
    expect(calculator).toHaveBeenCalledWith(currentReform.input)
    expect(currentReform.result.propertyTaxes[0]).toMatchObject({
      fairMarketValueRatio: 0.45,
      totalTax: 2_412_000,
    })
    expect(currentReform.result.comprehensiveTax).toMatchObject({
      basicDeduction: 900_000_000,
      totalTax: 268_800,
    })
    expect(currentReform.result.totalTax).toBe(2_680_800)
    expect(comparison.calculations.map(({ input }) => ({
      year: input.year,
      ownerAge: input.ownerAge,
      holdingYears: input.items[0].holdingYears,
    }))).toEqual([
      { year: 2026, ownerAge: 59, holdingYears: 1 },
      { year: 2027, ownerAge: 60, holdingYears: 2 },
      { year: 2028, ownerAge: 61, holdingYears: 3 },
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
      '1967-06-01',
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

  it('does not call the engine when a taxed item lacks an official price', () => {
    const incomplete = createStoredPortfolioItem(seed({
      officialPrice: null,
      officialPriceBaseDate: null,
      priorOfficialPrices: [],
    }), 'incomplete')
    const calculator = vi.fn(calculateHoldingTax)

    const comparison = calculatePortfolioHoldingTax(
      [incomplete],
      null,
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
      null,
      calculator,
    )

    expect(comparison).toMatchObject({
      status: 'missingConditions',
      missingConditions: [
        { kind: 'birthDate' },
        { kind: 'acquisitionDate', item: { id: 'unanswered' } },
        { kind: 'residenceYears', item: { id: 'unanswered' } },
        { kind: 'residency', item: { id: 'unanswered' } },
      ],
    })
    expect(calculator).not.toHaveBeenCalled()
  })

  it('derives sole household ownership at 100% but requires a remainder answer below 100%', () => {
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
      '1967-06-01',
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
      '1967-06-01',
      calculator,
    )
    expect(partialShare).toMatchObject({
      status: 'missingConditions',
      missingConditions: [{ kind: 'coOwnerHousehold' }],
    })
    expect(calculator).not.toHaveBeenCalled()
  })
})
