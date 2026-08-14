import { describe, expect, it } from 'vitest'
import { calculatePortfolioHoldingTax } from '../src/holding-screen/calculation'
import { ownershipShareFromFraction } from '../src/portfolio/ownership-share'
import type { StoredPortfolioItem } from '../shared/portfolio'

const item: StoredPortfolioItem = {
  id: 'test1',
  assetKind: 'apartment',
  complexId: 'A1',
  pnu: null,
  aptCode: null,
  legalDongCode: '1168010600',
  complexName: '테스트',
  address: '서울 강남구',
  dong: '1',
  ho: '101',
  exclusiveArea: 84,
  officialPrice: 2_237_000_000,
  officialPriceBaseDate: '2026-01-01',
  priorOfficialPrices: [{ baseDate: '2025-01-01', price: 1_708_000_000 }],
  ownershipShare: ownershipShareFromFraction(1),
  isSoleHouseholdOwner: true,
  residency: 'residing',
  areaKind: 'general',
  acquisitionDate: null,
  residenceYears: null,
}

describe('reproduce holding period crash', () => {
  it.each([
    { holding: 15, residence: 10 },
    { holding: 10, residence: 5 },
    { holding: 5, residence: 0 },
  ])('does not throw with holding $holding, residence $residence', ({ holding, residence }) => {
    expect(() => calculatePortfolioHoldingTax([item], {
      annualOfficialPriceGrowthRate: 0.15,
      ownerAge: 64,
      items: { test1: { holdingYears: holding, residenceYears: residence, continuesResidence: true, qualifyingRelocation: null } },
    })).not.toThrow()
  })
})
