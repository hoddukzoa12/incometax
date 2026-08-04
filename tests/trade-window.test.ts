import { describe, expect, it } from 'vitest'

import {
  createTradeDatasets,
  recentDealYearMonths,
  tradeWindowDates,
} from '../worker/trade/window'

describe('trade refresh window', () => {
  it('uses the Seoul calendar at UTC month boundaries', () => {
    const now = new Date('2026-07-31T16:00:00.000Z')
    expect(recentDealYearMonths(now)).toHaveLength(13)
    expect(recentDealYearMonths(now).slice(0, 2)).toEqual(['202608', '202607'])
    expect(tradeWindowDates(now)).toEqual({
      cutoffDate: '2025-08-01',
      windowEndDate: '2026-08-01',
    })
  })

  it('creates every source × district × month dataset', () => {
    expect(createTradeDatasets(['11680', '41135'], ['202608'])).toHaveLength(6)
  })
})
