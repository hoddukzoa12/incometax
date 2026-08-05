import { describe, expect, it, vi } from 'vitest'

import type { StagedTrade } from '../shared/trade'
import { D1ComplexTradeStore } from '../worker/trade/d1-store'

describe('on-demand trade D1 cache', () => {
  it('replaces one complex atomically and casts strict integer columns', async () => {
    const prepared: Array<{ sql: string; bindings: readonly unknown[] }> = []
    const batch = vi.fn(async () => [])
    const database = {
      prepare: (sql: string) => ({
        bind: (...bindings: unknown[]) => {
          const statement = { sql, bindings }
          prepared.push(statement)
          return statement
        },
      }),
      batch,
    } as unknown as D1Database
    const store = new D1ComplexTradeStore(database)
    const trade: StagedTrade = {
      tradeId: 'trade-1',
      complexId: 'A13583507',
      source: 'apt',
      matchLevel: 'lot',
      dealDate: '2026-07-01',
      dealAmount: 2_700_000_000,
      exclusiveArea: 84.43,
      floor: 10,
    }

    await store.replaceTrades(
      'A13583507',
      [trade],
      '2026-08-04T03:00:00.000Z',
    )

    expect(batch).toHaveBeenCalledOnce()
    expect(prepared).toHaveLength(3)
    expect(prepared[1].sql).toContain('CAST(column6 AS INTEGER)')
    expect(prepared[1].sql).toContain('CAST(column8 AS INTEGER)')
    expect(prepared[1].bindings).toEqual([
      'trade-1',
      'A13583507',
      'apt',
      'lot',
      '2026-07-01',
      2_700_000_000,
      84.43,
      10,
      '2026-08-04T03:00:00.000Z',
    ])
  })

  it('commits an empty lookup marker without inventing a trade row', async () => {
    const prepared: unknown[] = []
    const batch = vi.fn(async () => [])
    const database = {
      prepare: (sql: string) => ({
        bind: (...bindings: unknown[]) => {
          const statement = { sql, bindings }
          prepared.push(statement)
          return statement
        },
      }),
      batch,
    } as unknown as D1Database

    await new D1ComplexTradeStore(database).replaceTrades(
      'A00000000',
      [],
      '2026-08-04T03:00:00.000Z',
    )

    expect(prepared).toHaveLength(2)
    expect(batch).toHaveBeenCalledOnce()
  })
})
