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
import { createStoredPortfolioItem } from '../src/portfolio/state'

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
  complexName: '은마아파트',
  address: '서울특별시 강남구 삼성로 212',
  dong: '1',
  ho: '101',
  exclusiveArea: 76.79,
  officialPrice: 2_237_000_000,
  ...overrides,
})

describe('portfolio persistence', () => {
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

  it('upgrades the previous apartment-only schema by adding assetKind', () => {
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
    }])
    persistPortfolio(storage, upgraded)
    expect(JSON.parse(storage.values.get(PORTFOLIO_STORAGE_KEY)!)).toMatchObject({
      version: PORTFOLIO_SCHEMA_VERSION,
      items: [{ assetKind: 'apartment' }],
    })
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
