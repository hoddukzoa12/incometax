import { describe, expect, it, vi } from 'vitest'

import type {
  RawTrade,
  RecentTrade,
  StagedTrade,
  TradeDataset,
} from '../shared/trade'
import {
  lookupComplexTrades,
  type ComplexTradeStore,
  type ComplexTradeTarget,
} from '../worker/trade/on-demand'

const NOW = new Date('2026-08-04T03:00:00.000Z')
const TARGET: ComplexTradeTarget = {
  complexId: 'A13583507',
  name: '은마',
  legalAddress: '서울 강남구 대치동 316',
  legalDongCode: '1168010600',
  tradeCachedAt: null,
}

const rawTrade = (overrides: Partial<RawTrade> = {}): RawTrade => ({
  source: 'apt',
  legalDongName: '대치동',
  jibun: '316',
  buildingName: '은마',
  houseType: '',
  floor: 10,
  exclusiveArea: 84.43,
  landArea: '',
  totalFloorArea: '',
  dealDate: '2026-08-01',
  dealAmount: 2_700_000_000,
  cancellationType: '',
  cancellationDate: '',
  ...overrides,
})

function fakeStore(target: ComplexTradeTarget | null = TARGET) {
  let cachedItems: readonly RecentTrade[] = []
  const replaceTrades = vi.fn<ComplexTradeStore['replaceTrades']>(
    async (_complexId, trades: readonly StagedTrade[]) => {
      cachedItems = trades
    },
  )
  const store: ComplexTradeStore = {
    findTarget: vi.fn(async () => target),
    readTrades: vi.fn(async () => cachedItems),
    replaceTrades,
  }
  return { store, replaceTrades }
}

describe('on-demand complex trade lookup', () => {
  it('fetches apartment data for 13 months, removes cancellations, and caches matches', async () => {
    const fake = fakeStore()
    const readDataset = vi.fn(
      async (dataset: TradeDataset): Promise<readonly RawTrade[]> =>
        dataset.dealYearMonth === '202608'
          ? [
              rawTrade(),
              rawTrade({ cancellationType: 'O', cancellationDate: '26.08.03' }),
              rawTrade({ dealDate: '2026-07-10', dealAmount: 2_500_000_000 }),
              rawTrade({ jibun: '999', buildingName: '다른단지' }),
            ]
          : [],
    )

    const result = await lookupComplexTrades(fake.store, TARGET.complexId, 'key', {
      now: () => NOW,
      readDataset,
    })

    expect(readDataset).toHaveBeenCalledTimes(13)
    expect(readDataset.mock.calls.every(([dataset]) => dataset.source === 'apt'))
      .toBe(true)
    expect(result?.items).toHaveLength(1)
    expect(result?.items[0]).toMatchObject({
      dealDate: '2026-07-10',
      dealAmount: 2_500_000_000,
      matchLevel: 'lot',
    })
    expect(fake.replaceTrades).toHaveBeenCalledOnce()
  })

  it('returns cached empty results without contacting the source', async () => {
    const fake = fakeStore({
      ...TARGET,
      tradeCachedAt: '2026-08-04T02:30:00.000Z',
    })
    const readDataset = vi.fn(async () => [] as readonly RawTrade[])

    await expect(
      lookupComplexTrades(fake.store, TARGET.complexId, 'key', {
        now: () => NOW,
        readDataset,
      }),
    ).resolves.toEqual({ complexId: TARGET.complexId, items: [] })
    expect(readDataset).not.toHaveBeenCalled()
    expect(fake.replaceTrades).not.toHaveBeenCalled()
  })

  it('does not replace a valid cache when one source month fails', async () => {
    const fake = fakeStore()
    const readDataset = vi.fn(async (dataset: TradeDataset) => {
      if (dataset.dealYearMonth === '202607') throw new Error('source down')
      return [] as readonly RawTrade[]
    })

    await expect(
      lookupComplexTrades(fake.store, TARGET.complexId, 'key', {
        now: () => NOW,
        readDataset,
      }),
    ).rejects.toThrow('source down')
    expect(fake.replaceTrades).not.toHaveBeenCalled()
  })

  it('returns null for an unknown complex without contacting the source', async () => {
    const fake = fakeStore(null)
    const readDataset = vi.fn(async () => [] as readonly RawTrade[])

    await expect(
      lookupComplexTrades(fake.store, 'missing', 'key', {
        now: () => NOW,
        readDataset,
      }),
    ).resolves.toBeNull()
    expect(readDataset).not.toHaveBeenCalled()
  })
})
