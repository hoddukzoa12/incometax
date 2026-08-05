import { describe, expect, it } from 'vitest'

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
})
