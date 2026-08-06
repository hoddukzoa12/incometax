import { describe, expect, it } from 'vitest'

import {
  DEFAULT_ANNUAL_OFFICIAL_PRICE_GROWTH_RATE,
  persistHoldingTaxConditionValues,
  restoreHoldingTaxConditionValues,
} from '../src/holding-screen/condition-values'

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()

  get length(): number {
    return this.values.size
  }

  clear(): void {
    this.values.clear()
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

describe('holding-tax condition values', () => {
  it('defaults future official-price growth to zero', () => {
    const conditions = restoreHoldingTaxConditionValues(
      [],
      new MemoryStorage(),
    )

    expect(conditions.annualOfficialPriceGrowthRate).toBe(
      DEFAULT_ANNUAL_OFFICIAL_PRICE_GROWTH_RATE,
    )
  })

  it('persists a user-selected annual official-price growth rate', () => {
    const storage = new MemoryStorage()
    persistHoldingTaxConditionValues({
      ownerAge: 0,
      annualOfficialPriceGrowthRate: 0.05,
      items: {},
    }, storage)

    expect(restoreHoldingTaxConditionValues([], storage)
      .annualOfficialPriceGrowthRate).toBe(0.05)
  })
})
