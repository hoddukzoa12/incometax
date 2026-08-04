import { describe, expect, it, vi } from 'vitest'

import type { OfficialPriceRequest } from '../shared/official-price'
import type { OfficialPriceLookupResult } from '../shared/official-price'
import type { OfficialPriceCache } from '../worker/realty-price/cache'
import { RealtyPriceClient } from '../worker/realty-price/client'
import { OfficialPriceService } from '../worker/realty-price'

const TEST_PNU = '1168010600103160000'
const TEST_ENV = {
  LDONG: {} as KVNamespace,
  DATA_GO_KR_SERVICE_KEY: '',
}

function model(list: readonly Record<string, unknown>[]): Response {
  return Response.json({ model: { list } })
}

function modelMap(list: readonly Record<string, unknown>[]): Response {
  return Response.json({ modelMap: { list } })
}

function serviceWithResponses(responses: Response[]) {
  let now = Date.UTC(2026, 7, 4)
  const fetcher = vi.fn(async () => responses.shift()!)
  const client = new RealtyPriceClient({
    fetcher: fetcher as typeof fetch,
    now: () => now,
    sleep: async (milliseconds) => { now += milliseconds },
  })
  return { service: new OfficialPriceService({ client, now: () => now }), fetcher }
}

describe('OfficialPriceService', () => {
  it('walks the apartment chain and returns every past year from one price call', async () => {
    const { service, fetcher } = serviceWithResponses([
      model([{ code: '20260626', name: '2026년 1월 1일 기준(공시일자 : 2026.04.30)' }]),
      modelMap([{ code: 1381, notice_date: '20260626', name: '(316) 은마아파트(은마)' }]),
      model([{ code: 1, name: '1' }]),
      modelMap([{ code: 10, name: '101' }]),
      model([
        {
          notice_date_name: '2025.1.1',
          notice_amt: '1,708,000,000',
          priv_area: '76.79',
          full_addr_name: '서울특별시 강남구 삼성로 212',
        },
        {
          notice_date_name: '2026.1.1',
          notice_amt: '2,237,000,000',
          priv_area: '76.79',
          full_addr_name: '서울특별시 강남구 삼성로 212',
        },
      ]),
    ])
    const request: OfficialPriceRequest = {
      key: 'apt-1',
      assetKind: 'apartment',
      address: '서울특별시 강남구 대치동 316',
      complexName: '은마아파트',
      dong: '1동',
      room: '101호',
      pnu: TEST_PNU,
    }

    const result = await service.lookup(request, TEST_ENV)

    expect(result).toMatchObject({
      key: 'apt-1',
      status: 'found',
      value: {
        assetKind: 'apartment',
        pnu: TEST_PNU,
        items: [
          { baseDate: '2026.1.1', price: 2_237_000_000, exclusiveArea: 76.79 },
          { baseDate: '2025.1.1', price: 1_708_000_000, exclusiveArea: 76.79 },
        ],
      },
    })
    expect(fetcher).toHaveBeenCalledTimes(5)
  })

  it('queries detached houses at parcel level without requiring a unit', async () => {
    const { service, fetcher } = serviceWithResponses([
      modelMap([{
        base_ymd: '2026/01/01',
        full_addr_name: '서울특별시 종로구 청운동 265',
        hprice_w: '987000000',
      }]),
    ])

    const result = await service.lookup({
      key: 'detached-1',
      assetKind: 'detachedHouse',
      address: '서울특별시 종로구 청운동 265',
      pnu: '1111010100102650000',
    }, TEST_ENV)

    expect(result).toMatchObject({
      status: 'found',
      value: {
        assetKind: 'detachedHouse',
        items: [{ baseDate: '2026/01/01', price: 987_000_000 }],
      },
    })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('distinguishes no data from source failure in a partial batch', async () => {
    const { service } = serviceWithResponses([
      model([]),
      new Response('<html>recaptcha_token</html>', {
        headers: { 'content-type': 'text/html' },
      }),
    ])
    const requests: OfficialPriceRequest[] = [
      {
        key: 'none',
        assetKind: 'detachedHouse',
        address: '서울특별시 종로구 청운동 265',
        pnu: '1111010100102650000',
      },
      {
        key: 'captcha',
        assetKind: 'detachedHouse',
        address: '서울특별시 종로구 청운동 266',
        pnu: '1111010100102660000',
      },
    ]

    const results = await service.lookupBatch(requests, TEST_ENV)

    expect(results[0]).toEqual({
      key: 'none',
      status: 'noData',
      reason: 'priceNotFound',
    })
    expect(results[1]).toMatchObject({
      key: 'captcha',
      status: 'failed',
      failure: { kind: 'captchaRequired', retryable: false },
    })
  })

  it('rejects an apartment request without dong/room before source access', async () => {
    const { service, fetcher } = serviceWithResponses([])
    const result = await service.lookup({
      key: 'invalid',
      assetKind: 'apartment',
      address: '서울특별시 강남구 대치동 316',
      complexName: '은마아파트',
      dong: '',
      room: '',
      pnu: TEST_PNU,
    }, TEST_ENV)

    expect(result).toMatchObject({
      status: 'failed',
      failure: { kind: 'invalidRequest', retryable: false },
    })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('caches a successful unit history and avoids repeated source calls', async () => {
    let cached: OfficialPriceLookupResult | null = null
    const cache: OfficialPriceCache = {
      get: vi.fn(async () => cached),
      put: vi.fn(async (request, pnu, result) => {
        expect(request.key).toBe('cached')
        expect(pnu).toBe('1111010100102650000')
        cached = result
      }),
    }
    let now = Date.UTC(2026, 7, 4)
    const fetcher = vi.fn(async () => model([{
      base_ymd: '2026/01/01',
      full_addr_name: '서울특별시 종로구 청운동 265',
      hprice_w: '987000000',
    }]))
    const service = new OfficialPriceService({
      cache,
      client: new RealtyPriceClient({
        fetcher: fetcher as typeof fetch,
        now: () => now,
        sleep: async (milliseconds) => { now += milliseconds },
      }),
    })
    const request: OfficialPriceRequest = {
      key: 'cached',
      assetKind: 'detachedHouse',
      address: '서울특별시 종로구 청운동 265',
      pnu: '1111010100102650000',
    }

    expect((await service.lookup(request, TEST_ENV)).status).toBe('found')
    expect((await service.lookup(request, TEST_ENV)).status).toBe('found')
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(cache.put).toHaveBeenCalledTimes(1)
  })
})
