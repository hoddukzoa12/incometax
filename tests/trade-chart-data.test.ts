import { describe, expect, it } from 'vitest'

import type { RecentTrade } from '../shared/trade'
import { yearlyTradeAverages } from '../src/sidebar/trade-chart-data'

const trade = (dealDate: string, dealAmount: number): RecentTrade => ({
  tradeId: `${dealDate}-${dealAmount}`,
  source: 'apt',
  matchLevel: 'lot',
  dealDate,
  dealAmount,
  exclusiveArea: 84.43,
  floor: 10,
})

describe('yearly trade averages', () => {
  it('groups integer KRW amounts by year and sorts chronologically', () => {
    expect(yearlyTradeAverages([
      trade('2026-08-01', 2_700_000_000),
      trade('2025-12-10', 2_300_000_000),
      trade('2026-01-03', 2_500_000_000),
    ])).toEqual([
      { year: '2025', averageAmount: 2_300_000_000, tradeCount: 1 },
      { year: '2026', averageAmount: 2_600_000_000, tradeCount: 2 },
    ])
  })

  it('returns an empty series for a complex with no trades', () => {
    expect(yearlyTradeAverages([])).toEqual([])
  })
})
