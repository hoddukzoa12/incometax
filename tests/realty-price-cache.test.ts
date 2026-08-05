import { describe, expect, it, vi } from 'vitest'

import type {
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
})
