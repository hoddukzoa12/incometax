import { describe, expect, it } from 'vitest'

import type { RecentTrade } from '../shared/trade'
import {
  availableTradeAreas,
  availableTradeYears,
  defaultTradeAreaKey,
  filterTradesByArea,
} from '../src/sidebar/trade-filter-data'

const trade = (
  tradeId: string,
  exclusiveArea: number,
  dealDate: string,
): RecentTrade => ({
  tradeId,
  source: 'apt',
  matchLevel: 'lot',
  dealDate,
  dealAmount: 3_500_000_000,
  exclusiveArea,
  floor: 8,
})

describe('trade filters', () => {
  const trades = [
    trade('one', 84.43, '2026-06-01'),
    trade('two', 76.79, '2025-11-01'),
    trade('three', 84.43, '2025-09-01'),
  ]

  it('derives sorted area options and the most frequent default', () => {
    const options = availableTradeAreas(trades)

    expect(options).toEqual([
      { key: '76.79', area: 76.79, count: 1 },
      { key: '84.43', area: 84.43, count: 2 },
    ])
    expect(defaultTradeAreaKey(options)).toBe('84.43')
  })

  it('filters comparable trades and derives newest-first years', () => {
    const filtered = filterTradesByArea(trades, '84.43')

    expect(filtered.map((item) => item.tradeId)).toEqual(['one', 'three'])
    expect(availableTradeYears(filtered)).toEqual(['2026', '2025'])
  })
})
