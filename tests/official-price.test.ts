import { describe, expect, it, vi } from 'vitest'

import type { OfficialPriceRequest } from '../shared/official-price'
import type { OfficialPriceLookupResult } from '../shared/official-price'
import type {
  ApartmentUnitOptionsCache,
  OfficialPriceCache,
} from '../worker/realty-price/cache'
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

const EMPTY_LIST_SHAPES = ['emptyArray', 'null', 'missing'] as const
type EmptyListShape = typeof EMPTY_LIST_SHAPES[number]

function emptyListResponse(shape: EmptyListShape): Response {
  const modelByShape = {
    emptyArray: { list: [] },
    null: { list: null },
    missing: {},
  } as const
  return Response.json({ model: modelByShape[shape] })
}

function serviceWithFetcher(
  fetcher: typeof fetch,
  unitOptionsCache?: ApartmentUnitOptionsCache,
) {
  let now = Date.UTC(2026, 7, 4)
  const client = new RealtyPriceClient({
    fetcher,
    now: () => now,
    sleep: async (milliseconds) => { now += milliseconds },
  })
  return {
    service: new OfficialPriceService({
      client,
      now: () => now,
      unitOptionsCache,
    }),
    fetcher,
  }
}

function serviceWithResponses(responses: Response[]) {
  const fetcher = vi.fn(async () => responses.shift()!)
  return {
    ...serviceWithFetcher(fetcher as typeof fetch),
    fetcher,
  }
}

const apartmentRequest = (): OfficialPriceRequest => ({
  key: 'apt-unit',
  assetKind: 'apartment',
  address: '서울특별시 강남구 대치동 316',
  complexName: '은마아파트',
  dong: '1동',
  room: '101호',
  pnu: TEST_PNU,
})

const noticeResponse = (): Response => model([{
  code: '20260626',
  name: '2026년 1월 1일 기준(공시일자 : 2026.04.30)',
}])

const complexResponse = (): Response => modelMap([{
  code: 1381,
  notice_date: '20260626',
  name: '(316) 은마아파트(은마)',
}])

describe('OfficialPriceService', () => {
  it('loads apartment dong options and then rooms for the selected dong', async () => {
    const { service, fetcher } = serviceWithResponses([
      model([{ code: '20260626', name: '2026년 1월 1일 기준(공시일자 : 2026.04.30)' }]),
      modelMap([{ code: 1381, notice_date: '20260626', name: '(316) 은마아파트(은마)' }]),
      model([{ code: 1, name: '1' }, { code: 2, name: '2' }]),
      modelMap([{ code: 1381, notice_date: '20260626', name: '(316) 은마아파트(은마)' }]),
      model([{ code: 1, name: '1' }, { code: 2, name: '2' }]),
      modelMap([{ code: 10, name: '101' }, { code: 11, name: '102' }]),
    ])
    const request = {
      key: 'A13583507',
      address: '서울특별시 강남구 대치동 316',
      complexName: '은마아파트',
      pnu: TEST_PNU,
    }

    await expect(service.lookupApartmentOptions(request, TEST_ENV)).resolves.toEqual({
      key: 'A13583507',
      status: 'found',
      value: {
        pnu: TEST_PNU,
        dongs: [{ code: '1', name: '1' }, { code: '2', name: '2' }],
        rooms: [],
        aptCode: '1381',
      },
    })
    await expect(service.lookupApartmentOptions(
      { ...request, dong: '1동' },
      TEST_ENV,
    )).resolves.toEqual({
      key: 'A13583507',
      status: 'found',
      value: {
        pnu: TEST_PNU,
        dongs: [{ code: '1', name: '1' }, { code: '2', name: '2' }],
        rooms: [{ code: '10', name: '101' }, { code: '11', name: '102' }],
        aptCode: '1381',
      },
    })
    expect(fetcher).toHaveBeenCalledTimes(6)
  })

  it('reuses only a successful cached unit list', async () => {
    const responses = [
      noticeResponse(),
      complexResponse(),
      model([{ code: 1, name: '1' }]),
    ]
    const fetcher = vi.fn(async () => responses.shift()!)
    let cached: Awaited<ReturnType<
      ApartmentUnitOptionsCache['getApartmentOptions']
    >> = null
    const unitOptionsCache: ApartmentUnitOptionsCache = {
      getApartmentOptions: vi.fn(async () => cached),
      putApartmentOptions: vi.fn(async (_request, _pnu, result) => {
        cached = result.status === 'found' ? result : null
      }),
    }
    const { service } = serviceWithFetcher(
      fetcher as typeof fetch,
      unitOptionsCache,
    )
    const request = {
      key: 'A13583507',
      address: '서울특별시 강남구 대치동 316',
      complexName: '은마아파트',
      pnu: TEST_PNU,
    }

    expect((await service.lookupApartmentOptions(request, TEST_ENV)).status)
      .toBe('found')
    expect((await service.lookupApartmentOptions(request, TEST_ENV)).status)
      .toBe('found')
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(unitOptionsCache.getApartmentOptions).toHaveBeenCalledTimes(2)
    expect(unitOptionsCache.putApartmentOptions).toHaveBeenCalledTimes(1)
  })

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

  it('never sends the D1 complex name as an upstream search filter', async () => {
    const urls: URL[] = []
    const responses = [
      noticeResponse(),
      complexResponse(),
      model([{ code: 1, name: '1' }]),
      modelMap([{ code: 10, name: '101' }]),
      model([{
        notice_date_name: '2026.1.1',
        notice_amt: '2,237,000,000',
        priv_area: '76.79',
      }]),
    ]
    const fetcher = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      urls.push(new URL(String(input)))
      return responses.shift()!
    })
    const { service } = serviceWithFetcher(fetcher as typeof fetch)

    await expect(service.lookup(apartmentRequest(), TEST_ENV))
      .resolves.toMatchObject({ status: 'found' })

    const apartmentRequests = urls.filter((url) =>
      url.searchParams.has('apt_name'))
    expect(apartmentRequests).toHaveLength(4)
    expect(apartmentRequests.every((url) =>
      url.searchParams.get('apt_name') === '')).toBe(true)
  })

  it('uses the only parcel row even when its registered name differs', async () => {
    const { service } = serviceWithResponses([
      noticeResponse(),
      model([{
        code: 7001,
        notice_date: '20260626',
        name: '(73) 경남아파트(경남)',
      }]),
      model([{ code: 1, name: '1' }]),
    ])

    await expect(service.lookupApartmentOptions({
      key: 'single-mismatch',
      address: '서울특별시 도봉구 쌍문동 73',
      complexName: '쌍문경남',
      pnu: TEST_PNU,
    }, TEST_ENV)).resolves.toMatchObject({
      status: 'found',
      value: { dongs: [{ code: '1', name: '1' }] },
    })
  })

  it('chooses the one normalized name match among parcel candidates', async () => {
    const requestedUrls: URL[] = []
    const responses = [
      noticeResponse(),
      model([
        { code: 1381, notice_date: '20260626', name: '(316) 은마아파트(은마)' },
        { code: 9999, notice_date: '20260626', name: '(316) 다른아파트' },
      ]),
      model([{ code: 1, name: '1' }]),
    ]
    const fetcher = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      requestedUrls.push(new URL(String(input)))
      return responses.shift()!
    })
    const { service } = serviceWithFetcher(fetcher as typeof fetch)

    await expect(service.lookupApartmentOptions({
      key: 'normalized-match',
      address: '서울특별시 강남구 대치동 316',
      complexName: '은마아파트',
      pnu: TEST_PNU,
    }, TEST_ENV)).resolves.toMatchObject({ status: 'found' })

    expect(requestedUrls.at(-1)?.searchParams.get('apt_code')).toBe('1381')
  })

  it('returns a distinct ambiguity failure instead of guessing a parcel row', async () => {
    const { service } = serviceWithResponses([
      noticeResponse(),
      model([
        { code: 1001, notice_date: '20260626', name: '(73) 경남아파트' },
        { code: 1002, notice_date: '20260626', name: '(73) 현대아파트' },
      ]),
    ])

    const result = await service.lookupApartmentOptions({
      key: 'ambiguous-complex',
      address: '서울특별시 도봉구 쌍문동 73',
      complexName: '쌍문미확정',
      pnu: TEST_PNU,
    }, TEST_ENV)

    expect(result).toMatchObject({
      key: 'ambiguous-complex',
      status: 'ambiguous',
    })
    if (result.status === 'ambiguous') {
      expect(result.candidates.length).toBeGreaterThan(1)
    }
  })

  it('returns complexNotFound only when a parcel has no listed complex', async () => {
    const { service } = serviceWithResponses([
      noticeResponse(),
      model([]),
    ])

    await expect(service.lookup(apartmentRequest(), TEST_ENV)).resolves.toEqual({
      key: 'apt-unit',
      status: 'noData',
      reason: 'complexNotFound',
    })
  })

  it('returns dongNotFound only after a successful list omits the dong', async () => {
    const { service } = serviceWithResponses([
      noticeResponse(),
      complexResponse(),
      model([{ code: 2, name: '2' }]),
    ])

    await expect(service.lookup(apartmentRequest(), TEST_ENV)).resolves.toEqual({
      key: 'apt-unit',
      status: 'noData',
      reason: 'dongNotFound',
    })
  })

  it('returns roomNotFound only after a successful list omits the room', async () => {
    const { service } = serviceWithResponses([
      noticeResponse(),
      complexResponse(),
      model([{ code: 1, name: '1' }]),
      modelMap([{ code: 11, name: '102' }]),
    ])

    await expect(service.lookup(apartmentRequest(), TEST_ENV)).resolves.toEqual({
      key: 'apt-unit',
      status: 'noData',
      reason: 'roomNotFound',
    })
  })

  it('returns priceNotFound when the listed room has no price rows', async () => {
    const { service } = serviceWithResponses([
      noticeResponse(),
      complexResponse(),
      model([{ code: 1, name: '1' }]),
      modelMap([{ code: 10, name: '101' }]),
      model([]),
    ])

    await expect(service.lookup(apartmentRequest(), TEST_ENV)).resolves.toEqual({
      key: 'apt-unit',
      status: 'noData',
      reason: 'priceNotFound',
    })
  })

  const emptyListNoDataCases = EMPTY_LIST_SHAPES.flatMap((shape) => [
    {
      shape,
      reason: 'complexNotFound' as const,
      beforeEmpty: () => [noticeResponse()],
    },
    {
      shape,
      reason: 'dongNotFound' as const,
      beforeEmpty: () => [noticeResponse(), complexResponse()],
    },
    {
      shape,
      reason: 'roomNotFound' as const,
      beforeEmpty: () => [
        noticeResponse(),
        complexResponse(),
        model([{ code: 1, name: '1' }]),
      ],
    },
    {
      shape,
      reason: 'priceNotFound' as const,
      beforeEmpty: () => [
        noticeResponse(),
        complexResponse(),
        model([{ code: 1, name: '1' }]),
        modelMap([{ code: 10, name: '101' }]),
      ],
    },
  ])

  it.each(emptyListNoDataCases)(
    'returns $reason for a $shape source list',
    async ({ shape, reason, beforeEmpty }) => {
      const { service } = serviceWithResponses([
        ...beforeEmpty(),
        emptyListResponse(shape),
      ])

      await expect(service.lookup(apartmentRequest(), TEST_ENV)).resolves.toEqual({
        key: 'apt-unit',
        status: 'noData',
        reason,
      })
    },
  )

  it('returns failed instead of missing-unit data when a list transport fails', async () => {
    let requestCount = 0
    const fetcher = vi.fn(async () => {
      requestCount += 1
      if (requestCount === 1) return noticeResponse()
      throw new TypeError('mocked network outage')
    })
    const { service } = serviceWithFetcher(fetcher as typeof fetch)

    const result = await service.lookup(apartmentRequest(), TEST_ENV)

    expect(result).toMatchObject({
      key: 'apt-unit',
      status: 'failed',
      failure: { kind: 'sourceUnavailable', retryable: true },
    })
    expect('reason' in result).toBe(false)
  })

  it('returns a distinct non-retryable failed state for a list CAPTCHA', async () => {
    const { service } = serviceWithResponses([
      noticeResponse(),
      new Response('<html><div class="g-recaptcha">verify</div></html>', {
        headers: { 'content-type': 'text/html' },
      }),
    ])

    const result = await service.lookup(apartmentRequest(), TEST_ENV)

    expect(result).toMatchObject({
      key: 'apt-unit',
      status: 'failed',
      failure: { kind: 'captchaRequired', retryable: false },
    })
    expect('reason' in result).toBe(false)
  })

  it('keeps a non-JSON HTML error page in the failed path', async () => {
    const { service } = serviceWithResponses([
      noticeResponse(),
      new Response('<html><title>upstream error</title></html>', {
        headers: { 'content-type': 'text/html' },
      }),
    ])

    const result = await service.lookup(apartmentRequest(), TEST_ENV)

    expect(result).toMatchObject({
      key: 'apt-unit',
      status: 'failed',
      failure: { kind: 'invalidSourceResponse', retryable: false },
    })
    expect('reason' in result).toBe(false)
  })

  it('keeps a row missing a required field in the failed path', async () => {
    const { service } = serviceWithResponses([
      noticeResponse(),
      model([{ code: 1381 }]),
    ])

    const result = await service.lookup(apartmentRequest(), TEST_ENV)

    expect(result).toMatchObject({
      key: 'apt-unit',
      status: 'failed',
      failure: { kind: 'invalidSourceResponse', retryable: false },
    })
    expect('reason' in result).toBe(false)
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
