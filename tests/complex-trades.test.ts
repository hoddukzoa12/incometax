import { describe, expect, it } from 'vitest'

import {
  handleComplexTrades,
  queryRecentTrades,
} from '../worker/complex/trades'

const fakeDatabase = (rows: readonly Record<string, unknown>[]): D1Database =>
  ({
    prepare: () => ({
      bind: () => ({
        all: async () => ({ results: rows }),
      }),
    }),
  }) as unknown as D1Database

describe('recent complex trades API', () => {
  it('returns recent D1 rows without calling an external source', async () => {
    const result = await queryRecentTrades(
      fakeDatabase([
        {
          complex_id: 'A10000001',
          trade_id: 'trade-1',
          source: 'apt',
          match_level: 'lot',
          deal_date: '2026-08-01',
          deal_amount: 2_700_000_000,
          exclusive_area: 84.43,
          floor: 10,
        },
      ]),
      'A10000001',
      20,
    )

    expect(result).toEqual({
      complexId: 'A10000001',
      items: [
        {
          tradeId: 'trade-1',
          source: 'apt',
          matchLevel: 'lot',
          dealDate: '2026-08-01',
          dealAmount: 2_700_000_000,
          exclusiveArea: 84.43,
          floor: 10,
        },
      ],
    })
  })

  it('distinguishes an existing complex with no trades from a missing complex', async () => {
    await expect(
      queryRecentTrades(
        fakeDatabase([
          {
            complex_id: 'A10000001',
            trade_id: null,
            source: null,
            match_level: null,
            deal_date: null,
            deal_amount: null,
            exclusive_area: null,
            floor: null,
          },
        ]),
        'A10000001',
        20,
      ),
    ).resolves.toEqual({ complexId: 'A10000001', items: [] })
    await expect(
      queryRecentTrades(fakeDatabase([]), 'missing', 20),
    ).resolves.toBeNull()
  })

  it('rejects invalid limits and returns 404 for missing complexes', async () => {
    const invalid = await handleComplexTrades(
      new URL('https://example.test/api/complexes/A1/trades?limit=101'),
      fakeDatabase([]),
      'A1',
    )
    expect(invalid.status).toBe(400)

    const missing = await handleComplexTrades(
      new URL('https://example.test/api/complexes/missing/trades'),
      fakeDatabase([]),
      'missing',
    )
    expect(missing.status).toBe(404)
  })
})
