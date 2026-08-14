import { describe, expect, it, vi } from 'vitest'

import type {
  AddressTradeTarget,
  RawTrade,
  TradeDataset,
} from '../shared/trade.ts'
import { lookupAddressTrades } from '../worker/trade/address-trades.ts'

const NOW = new Date('2026-08-04T03:00:00.000Z')
const TARGET: AddressTradeTarget = {
  legalDongCode: '1168010600',
  jibunAddress: '서울 강남구 대치동 316',
  complexName: '은마아파트',
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

function memoryCache() {
  const responses = new Map<string, Response>()
  const match = vi.fn(async (request: Request) =>
    responses.get(request.url)?.clone())
  const put = vi.fn(async (request: Request, response: Response) => {
    responses.set(request.url, response.clone())
  })
  return {
    cache: { match, put } as unknown as Cache,
    match,
    put,
    responses,
  }
}

describe('address trade lookup', () => {
  it('loads apt and rowhouse datasets sequentially for 13 months and caches them for 24 hours', async () => {
    const memory = memoryCache()
    let activeReads = 0
    let maximumActiveReads = 0
    const readDataset = vi.fn(async (dataset: TradeDataset) => {
      activeReads += 1
      maximumActiveReads = Math.max(maximumActiveReads, activeReads)
      await Promise.resolve()
      activeReads -= 1
      if (dataset.dealYearMonth !== '202608') return []
      return [rawTrade({ source: dataset.source })]
    })

    const result = await lookupAddressTrades(TARGET, 'service-key', undefined, {
      now: () => NOW,
      cache: memory.cache,
      readDataset,
    })

    expect(readDataset).toHaveBeenCalledTimes(26)
    expect(maximumActiveReads).toBe(1)
    expect(readDataset.mock.calls.map(([dataset]) => dataset.source)).toEqual(
      Array.from({ length: 13 }, () => ['apt', 'rowhouse']).flat(),
    )
    expect(result.map((trade) => trade.source)).toEqual(['apt', 'rowhouse'])
    expect(memory.put).toHaveBeenCalledTimes(26)
    const [firstRequest, firstResponse] = memory.put.mock.calls[0]
    expect(new URL(firstRequest.url).searchParams.get('key'))
      .toBe('trade|apt|11680|202608')
    expect(firstResponse.headers.get('cache-control'))
      .toBe('public, max-age=86400')
  })

  it('shares cached district-month datasets across lookups', async () => {
    const memory = memoryCache()
    const readDataset = vi.fn(async () => [] as readonly RawTrade[])
    const dependencies = {
      now: () => NOW,
      cache: memory.cache,
      readDataset,
    }

    await lookupAddressTrades(TARGET, 'service-key', undefined, dependencies)
    await lookupAddressTrades(
      { ...TARGET, complexName: '다른 공동주택' },
      'service-key',
      undefined,
      dependencies,
    )

    expect(readDataset).toHaveBeenCalledTimes(26)
    expect(memory.match).toHaveBeenCalledTimes(52)
  })

  it('merges concurrent in-flight requests for the same datasets', async () => {
    const memory = memoryCache()
    const readDataset = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1))
      return [] as readonly RawTrade[]
    })
    const dependencies = {
      now: () => NOW,
      cache: memory.cache,
      readDataset,
    }

    await Promise.all([
      lookupAddressTrades(TARGET, 'service-key', undefined, dependencies),
      lookupAddressTrades(TARGET, 'service-key', undefined, dependencies),
    ])

    expect(readDataset).toHaveBeenCalledTimes(26)
  })

  it('rejects a malformed legal-dong code before reading the cache', async () => {
    const memory = memoryCache()

    await expect(lookupAddressTrades(
      { ...TARGET, legalDongCode: '11680' },
      'service-key',
      undefined,
      { now: () => NOW, cache: memory.cache },
    )).rejects.toThrow('legalDongCode must be a 10-digit code')
    expect(memory.match).not.toHaveBeenCalled()
  })
})
