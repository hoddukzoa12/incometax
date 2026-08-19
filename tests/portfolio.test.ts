import { describe, expect, expectTypeOf, it } from 'vitest'

import type { PortfolioItemSeed } from '../shared/portfolio'
import {
  PORTFOLIO_SCHEMA_VERSION,
  PORTFOLIO_STORAGE_KEY,
  decodePortfolio,
  persistPortfolio,
  restorePortfolio,
} from '../src/portfolio/persistence'
import {
  ownershipPercentFromNumber,
  ownershipShareFromFraction,
} from '../src/portfolio/ownership-share'
import {
  createStoredPortfolioItem,
  updatePortfolioItem,
} from '../src/portfolio/state'

class MemoryStorage {
  readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

const seed = (
  overrides: Partial<PortfolioItemSeed> = {},
): PortfolioItemSeed => ({
  assetKind: 'apartment',
  complexId: 'A13583507',
  pnu: null,
  aptCode: null,
  legalDongCode: '1168010600',
  complexName: '은마아파트',
  address: '서울특별시 강남구 삼성로 212',
  dong: '1',
  ho: '101',
  exclusiveArea: 76.79,
  officialPrice: 2_237_000_000,
  ...overrides,
})

describe('portfolio persistence', () => {
  it('derives the default area kind and still allows a manual override', () => {
    const item = createStoredPortfolioItem(seed(), 'derived-area')
    expect(item.areaKind).toBe('adjusted')

    const [overridden] = updatePortfolioItem([item], item.id, {
      areaKind: 'general',
    })
    expect(overridden.areaKind).toBe('general')

    expect(createStoredPortfolioItem(seed({
      legalDongCode: '2635010500',
    }), 'general-area').areaKind).toBe('general')
  })

  it('persists and restores the versioned portfolio shape', () => {
    const storage = new MemoryStorage()
    const items = [
      createStoredPortfolioItem(seed(), 'portfolio-one'),
      {
        ...createStoredPortfolioItem(seed({
          complexId: 'A10000002',
          complexName: '배우자 소유 아파트',
          dong: null,
          ho: null,
          exclusiveArea: null,
          officialPrice: null,
        }), 'portfolio-two'),
        ownershipShare: ownershipShareFromFraction(0),
      },
    ]

    persistPortfolio(storage, items)

    expect(restorePortfolio(storage)).toEqual(items)
    expect(JSON.parse(storage.values.get(PORTFOLIO_STORAGE_KEY)!)).toMatchObject({
      version: PORTFOLIO_SCHEMA_VERSION,
    })
  })

  it('upgrades the legacy apartment-only schema', () => {
    const storage = new MemoryStorage()
    const previousVersion = JSON.stringify({
      version: 1,
      items: [{
        id: 'legacy-one',
        complexId: 'A13583507',
        complexName: '은마아파트',
        address: '서울특별시 강남구 삼성로 212',
        dong: null,
        ho: null,
        exclusiveArea: null,
        officialPrice: null,
        ownershipShare: 0,
        isSoleHouseholdOwner: true,
        residency: 'nonResiding',
        areaKind: 'general',
      }],
    })
    storage.setItem(PORTFOLIO_STORAGE_KEY, previousVersion)
    const upgraded = restorePortfolio(storage)

    expect(upgraded).toEqual([{
      id: 'legacy-one',
      assetKind: 'apartment',
      complexId: 'A13583507',
      pnu: null,
      aptCode: null,
      legalDongCode: null,
      complexName: '은마아파트',
      address: '서울특별시 강남구 삼성로 212',
      dong: null,
      ho: null,
      exclusiveArea: null,
      officialPrice: null,
      officialPriceBaseDate: null,
      priorOfficialPrices: [],
      ownershipShare: 0,
      isSoleHouseholdOwner: true,
      residency: 'nonResiding',
      areaKind: 'general',
      acquisitionDate: null,
      residenceYears: null,
    }])
    persistPortfolio(storage, upgraded)
    expect(JSON.parse(storage.values.get(PORTFOLIO_STORAGE_KEY)!)).toMatchObject({
      version: PORTFOLIO_SCHEMA_VERSION,
      items: [{ assetKind: 'apartment' }],
    })
  })

  it('upgrades schema 2 records without guessing a legal dong code', () => {
    const previousVersion = JSON.stringify({
      version: 2,
      items: [{
        ...createStoredPortfolioItem(seed(), 'schema-two'),
        pnu: undefined,
        aptCode: undefined,
        legalDongCode: undefined,
      }],
    })

    expect(decodePortfolio(previousVersion)).toEqual([{
      ...createStoredPortfolioItem(seed(), 'schema-two'),
      legalDongCode: null,
    }])
  })

  it('upgrades schema 5 records with an unset address identity', () => {
    const previousVersion = JSON.stringify({
      version: 5,
      items: [{
        ...createStoredPortfolioItem(seed(), 'schema-five'),
        pnu: undefined,
        aptCode: undefined,
      }],
    })

    expect(decodePortfolio(previousVersion)).toEqual([{
      ...createStoredPortfolioItem(seed(), 'schema-five'),
      pnu: null,
      aptCode: null,
    }])
  })

  it('preserves existing tax-condition facts while schema 4 dates become unset', () => {
    const previousVersion = JSON.stringify({
      version: 4,
      items: [{
        ...createStoredPortfolioItem(seed(), 'schema-four'),
        ownershipShare: 0.5,
        isSoleHouseholdOwner: false,
        residency: 'residing',
        areaKind: 'general',
        holdingYears: 15,
        residenceYears: 10,
      }],
    })

    expect(decodePortfolio(previousVersion)).toEqual([{
      ...createStoredPortfolioItem(seed(), 'schema-four'),
      ownershipShare: 0.5,
      isSoleHouseholdOwner: false,
      residency: 'residing',
      areaKind: 'general',
      acquisitionDate: null,
      residenceYears: null,
    }])
  })

  it('rejects invalid ownership-share fractions', () => {
    expect(() => ownershipShareFromFraction(-0.01)).toThrow(RangeError)
    expect(() => ownershipShareFromFraction(1.01)).toThrow(RangeError)
    expect(() => ownershipShareFromFraction(Number.NaN)).toThrow(RangeError)

    const invalidSerialized = JSON.stringify({
      version: PORTFOLIO_SCHEMA_VERSION,
      items: [{
        ...createStoredPortfolioItem(seed(), 'invalid-share'),
        ownershipShare: 50,
      }],
    })
    expect(decodePortfolio(invalidSerialized)).toEqual([])
  })

  it('keeps percentage and fractional ownership values type-distinct', () => {
    expectTypeOf(ownershipShareFromFraction(0.5)).not.toEqualTypeOf(
      ownershipPercentFromNumber(50),
    )
  })
})
