import { describe, expect, it, vi } from 'vitest'

import type { ComplexTradeStore } from '../worker/trade/on-demand'
import { handleComplexTrades } from '../worker/complex/trades'

const database = {} as D1Database
const store = {} as ComplexTradeStore

describe('complex trade HTTP API', () => {
  it('returns cached or newly fetched trade history', async () => {
    const lookup = vi.fn(async () => ({
      complexId: 'A13583507',
      items: [{
        tradeId: 'trade-1',
        source: 'apt' as const,
        matchLevel: 'lot' as const,
        dealDate: '2026-08-01',
        dealAmount: 2_700_000_000,
        exclusiveArea: 84.43,
        floor: 10,
      }],
    }))
    const response = await handleComplexTrades(
      database,
      'A13583507',
      'service-key',
      { store, lookup },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      complexId: 'A13583507',
      items: [{ dealAmount: 2_700_000_000 }],
    })
  })

  it('coalesces simultaneous sidebar opens for the same complex', async () => {
    let resolveLookup: ((value: {
      readonly complexId: string
      readonly items: readonly []
    }) => void) | undefined
    const lookup = vi.fn(() => new Promise<{
      readonly complexId: string
      readonly items: readonly []
    }>((resolve) => {
      resolveLookup = resolve
    }))
    const first = handleComplexTrades(database, 'A13583507', 'service-key', {
      store,
      lookup,
    })
    const second = handleComplexTrades(database, 'A13583507', 'service-key', {
      store,
      lookup,
    })
    resolveLookup?.({ complexId: 'A13583507', items: [] })

    const responses = await Promise.all([first, second])
    expect(responses.map((response) => response.status)).toEqual([200, 200])
    expect(lookup).toHaveBeenCalledOnce()
  })

  it('returns an empty list as a normal successful result', async () => {
    const response = await handleComplexTrades(
      database,
      'A13583507',
      'service-key',
      {
        store,
        lookup: vi.fn(async () => ({ complexId: 'A13583507', items: [] })),
      },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      complexId: 'A13583507',
      items: [],
    })
  })

  it('distinguishes missing complexes from source failures', async () => {
    const missing = await handleComplexTrades(
      database,
      'missing',
      'service-key',
      { store, lookup: vi.fn(async () => null) },
    )
    expect(missing.status).toBe(404)

    const failed = await handleComplexTrades(
      database,
      'A13583507',
      'service-key',
      {
        store,
        lookup: vi.fn(async () => {
          throw new Error('source unavailable')
        }),
      },
    )
    expect(failed.status).toBe(502)
    await expect(failed.json()).resolves.toMatchObject({ retryable: true })
  })

  it('rejects invalid encoded complex identifiers', async () => {
    const response = await handleComplexTrades(
      database,
      '%E0%A4%A',
      'service-key',
    )
    expect(response.status).toBe(400)
  })
})
