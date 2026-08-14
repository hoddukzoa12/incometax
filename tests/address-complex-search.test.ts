import { describe, expect, it, vi } from 'vitest'

import {
  type AddressComplexSearchCache,
  CloudflareOfficialPriceCache,
} from '../worker/realty-price/cache'
import { RealtyPriceClient } from '../worker/realty-price/client'
import { AddressComplexSearchService } from '../worker/realty-price/complex-search'

const TEST_PNU = '1168010600103160000'
const TEST_ENV = {
  LDONG: {} as KVNamespace,
  DATA_GO_KR_SERVICE_KEY: '',
}
const TEST_CONTEXT = {
  waitUntil: vi.fn(),
} as unknown as ExecutionContext

function model(list: readonly Record<string, unknown>[]): Response {
  return Response.json({ model: { list } })
}

function noticeResponse(): Response {
  return model([{
    code: '20260626',
    name: '2026년 1월 1일 기준(공시일자 : 2026.04.30)',
  }])
}

function serviceWithFetcher(
  fetcher: typeof fetch,
  options: {
    readonly cache?: AddressComplexSearchCache
    readonly resolvePnu?: () => Promise<string | null>
  } = {},
) {
  let now = Date.UTC(2026, 7, 14)
  return new AddressComplexSearchService({
    cache: options.cache,
    resolvePnu: options.resolvePnu,
    now: () => now,
    client: new RealtyPriceClient({
      fetcher,
      now: () => now,
      sleep: async (milliseconds) => { now += milliseconds },
    }),
  })
}

describe('AddressComplexSearchService', () => {
  it('returns every complex on the PNU and reuses apartment search params', async () => {
    const requestedUrls: URL[] = []
    const responses = [
      noticeResponse(),
      model([
        { code: 1381, name: '(316) 은마아파트(은마)' },
        { code: 1382, name: '(316) 은마상가주택' },
      ]),
    ]
    const fetcher = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      requestedUrls.push(new URL(String(input)))
      return responses.shift()!
    })
    const service = serviceWithFetcher(fetcher as typeof fetch)

    await expect(service.search({
      address: '서울특별시 강남구 대치동 316',
      pnu: TEST_PNU,
    }, TEST_ENV, TEST_CONTEXT)).resolves.toEqual({
      status: 'found',
      complexes: [
        { code: '1381', name: '(316) 은마아파트(은마)' },
        { code: '1382', name: '(316) 은마상가주택' },
      ],
      pnu: TEST_PNU,
    })

    const searchUrl = requestedUrls[1]
    expect(searchUrl.pathname).toBe('/notice/search/searchApt.search')
    expect(searchUrl.searchParams.get('reg')).toBe('11680')
    expect(searchUrl.searchParams.get('eub')).toBe('10600')
    expect(searchUrl.searchParams.get('bun1')).toBe('316')
    expect(searchUrl.searchParams.get('bun2')).toBe('0')
    expect(searchUrl.searchParams.get('notice_date_year')).toBe('20260430')
  })

  it('resolves the address to PNU when the request omits it', async () => {
    const resolvePnu = vi.fn(async () => TEST_PNU)
    const fetcher = vi.fn(async () => noticeResponse())
    const service = serviceWithFetcher(fetcher as typeof fetch, { resolvePnu })

    await service.search(
      { address: ' 서울특별시 강남구 대치동 316 ' },
      TEST_ENV,
      TEST_CONTEXT,
    )

    expect(resolvePnu).toHaveBeenCalledWith(
      '서울특별시 강남구 대치동 316',
      TEST_ENV,
      TEST_CONTEXT,
    )
  })

  it('distinguishes an empty successful source response from source failures', async () => {
    const emptyResponses = [noticeResponse(), model([])]
    const noDataService = serviceWithFetcher(vi.fn(async () => {
      return emptyResponses.shift()!
    }) as typeof fetch)

    await expect(noDataService.search({
      address: '서울특별시 강남구 대치동 316',
      pnu: TEST_PNU,
    }, TEST_ENV)).resolves.toEqual({ status: 'noData' })

    const captchaResponses = [
      noticeResponse(),
      new Response('<div class="g-recaptcha">verify</div>', {
        headers: { 'content-type': 'text/html' },
      }),
    ]
    const captchaService = serviceWithFetcher(vi.fn(async () => {
      return captchaResponses.shift()!
    }) as typeof fetch)
    await expect(captchaService.search({
      address: '서울특별시 강남구 대치동 316',
      pnu: TEST_PNU,
    }, TEST_ENV)).resolves.toMatchObject({
      status: 'failed',
      failure: { kind: 'captcha', retryable: false },
    })
  })

  it('preserves the upstream unavailable failure kind', async () => {
    let requestCount = 0
    const fetcher = vi.fn(async () => {
      requestCount += 1
      if (requestCount === 1) return noticeResponse()
      throw new TypeError('mocked network outage')
    })
    const service = serviceWithFetcher(fetcher as typeof fetch)

    await expect(service.search({
      address: '서울특별시 강남구 대치동 316',
      pnu: TEST_PNU,
    }, TEST_ENV)).resolves.toMatchObject({
      status: 'failed',
      failure: { kind: 'unavailable', retryable: true },
    })
  })

  it('reuses successful cached data keyed by PNU and notice date', async () => {
    let cached = null as Awaited<ReturnType<
      AddressComplexSearchCache['getAddressComplexes']
    >>
    const cache: AddressComplexSearchCache = {
      getAddressComplexes: vi.fn(async () => cached),
      putAddressComplexes: vi.fn(async (_pnu, _noticeDate, result) => {
        cached = result
      }),
    }
    const responses = [
      noticeResponse(),
      model([{ code: 1381, name: '은마아파트' }]),
    ]
    const fetcher = vi.fn(async () => responses.shift()!)
    const service = serviceWithFetcher(fetcher as typeof fetch, { cache })
    const request = {
      address: '서울특별시 강남구 대치동 316',
      pnu: TEST_PNU,
    }

    expect((await service.search(request, TEST_ENV)).status).toBe('found')
    expect((await service.search(request, TEST_ENV)).status).toBe('found')
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(cache.getAddressComplexes).toHaveBeenNthCalledWith(
      2,
      TEST_PNU,
      '20260626',
    )
    expect(cache.putAddressComplexes).toHaveBeenCalledTimes(1)
  })

  it('stores Cache API entries for 24 hours under PNU and notice date', async () => {
    let storedRequest: Request | undefined
    let storedResponse: Response | undefined
    const cache = new CloudflareOfficialPriceCache({
      put: vi.fn(async (request: Request, response: Response) => {
        storedRequest = request
        storedResponse = response
      }),
    } as unknown as Cache)

    await cache.putAddressComplexes(TEST_PNU, '20260626', {
      status: 'found',
      complexes: [{ code: '1381', name: '은마아파트' }],
      pnu: TEST_PNU,
    })

    const cacheUrl = new URL(storedRequest!.url)
    expect(cacheUrl.searchParams.get('pnu')).toBe(TEST_PNU)
    expect(cacheUrl.searchParams.get('noticeDate')).toBe('20260626')
    expect(storedResponse!.headers.get('cache-control'))
      .toBe('public, max-age=86400')
  })
})
