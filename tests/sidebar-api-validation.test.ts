import { describe, expect, it } from 'vitest'

import { isRecentTrade } from '../src/sidebar/api-validation'

const trade = (source: string) => ({
  tradeId: `${source}-trade-1`,
  source,
  matchLevel: 'lot',
  dealDate: '2026-07-14',
  dealAmount: 720_000_000,
  exclusiveArea: 53.21,
  floor: 3,
})

describe('sidebar trade validation', () => {
  it.each(['apt', 'rowhouse'])(
    'accepts the supported %s trade source',
    (source) => {
      expect(isRecentTrade(trade(source))).toBe(true)
    },
  )

  it('rejects a trade source outside the shared source contract', () => {
    expect(isRecentTrade(trade('unknown'))).toBe(false)
  })
})
