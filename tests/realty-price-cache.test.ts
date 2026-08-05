import { describe, expect, it, vi } from 'vitest'

import type {
  ApartmentUnitOptionsRequest,
  ApartmentUnitOptionsResult,
  OfficialPriceLookupResult,
  OfficialPriceRequest,
} from '../shared/official-price'

import { CloudflareOfficialPriceCache } from '../worker/realty-price/cache'

describe('official price response cache', () => {
  it('rebinds a cached result to the current request correlation key', async () => {
    const cache = {
      match: async () => Response.json({
        key: 'previous-request',
        status: 'found',
        value: {
          assetKind: 'apartment',
          pnu: '1168010600103160000',
          detailAddress: '서울 강남구 대치동 316 은마 1동 101호',
          items: [],
        },
      }),
    } as unknown as Cache
    const officialPriceCache = new CloudflareOfficialPriceCache(cache)

    await expect(officialPriceCache.get({
      key: 'current-request',
      assetKind: 'apartment',
      address: '서울 강남구 대치동 316',
      complexName: '은마',
      dong: '1',
      room: '101',
    }, '1168010600103160000')).resolves.toMatchObject({
      key: 'current-request',
      status: 'found',
    })
  })

  it('stores every source-provided history row without inventing a year', async () => {
    const storedResponses: Response[] = []
    const put = vi.fn(async (_request: Request, response: Response) => {
      storedResponses.push(response)
    })
    const officialPriceCache = new CloudflareOfficialPriceCache({
      put,
    } as unknown as Cache)
    const request: OfficialPriceRequest = {
      key: 'current-request',
      assetKind: 'apartment',
      address: '서울 강남구 대치동 316',
      complexName: '은마',
      dong: '1',
      room: '101',
    }
    const result: OfficialPriceLookupResult = {
      key: request.key,
      status: 'found',
      value: {
        assetKind: 'apartment',
        pnu: '1168010600103160000',
        detailAddress: '서울 강남구 대치동 316 은마 1동 101호',
        items: [
          { baseDate: '2026.1.1', price: 2_237_000_000, exclusiveArea: 76.79 },
          { baseDate: '2006.1.1', price: 542_000_000, exclusiveArea: 76.79 },
        ],
      },
    }

    await officialPriceCache.put(request, result.value.pnu, result)

    expect(put).toHaveBeenCalledOnce()
    await expect(storedResponses[0].json()).resolves.toEqual(result)
  })

  it('stores successful unit lists and rebinds their correlation key', async () => {
    const request: ApartmentUnitOptionsRequest = {
      key: 'current-request',
      address: '서울 강남구 대치동 316',
      complexName: '은마아파트',
      dong: '1동',
    }
    const cachedResult: ApartmentUnitOptionsResult = {
      key: 'previous-request',
      status: 'found',
      value: {
        pnu: '1168010600103160000',
        dongs: [{ code: '1', name: '1' }],
        rooms: [{ code: '10', name: '101' }],
      },
    }
    const storedResponses: Response[] = []
    const cache = {
      match: vi.fn(async () => Response.json(cachedResult)),
      put: vi.fn(async (_request: Request, response: Response) => {
        storedResponses.push(response)
      }),
    } as unknown as Cache
    const officialPriceCache = new CloudflareOfficialPriceCache(cache)

    await officialPriceCache.putApartmentOptions(
      request,
      cachedResult.value.pnu,
      { ...cachedResult, key: request.key },
    )

    expect(storedResponses).toHaveLength(1)
    await expect(storedResponses[0].json()).resolves.toMatchObject({
      key: 'current-request',
      status: 'found',
    })
    await expect(officialPriceCache.getApartmentOptions(
      request,
      cachedResult.value.pnu,
    )).resolves.toMatchObject({
      key: 'current-request',
      status: 'found',
    })
  })

  it('never caches a failed unit-list response', async () => {
    const put = vi.fn(async () => undefined)
    const officialPriceCache = new CloudflareOfficialPriceCache({
      put,
    } as unknown as Cache)
    const request: ApartmentUnitOptionsRequest = {
      key: 'failed-request',
      address: '서울 강남구 대치동 316',
      complexName: '은마아파트',
    }

    await officialPriceCache.putApartmentOptions(
      request,
      '1168010600103160000',
      {
        key: request.key,
        status: 'failed',
        failure: {
          kind: 'sourceUnavailable',
          message: 'mocked outage',
          retryable: true,
        },
      },
    )

    expect(put).not.toHaveBeenCalled()
  })
})
