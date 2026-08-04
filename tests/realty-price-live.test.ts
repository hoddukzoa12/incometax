import { describe, expect, it } from 'vitest'

import { OfficialPriceService } from '../worker/realty-price'

const LIVE_TEST_TIMEOUT_MS = 30_000
const shouldRun = process.env.RUN_LIVE_REALTY_PRICE_TESTS === '1'

describe.skipIf(!shouldRun)('live realty-price verification', () => {
  it('returns past-year apartment prices in one history response', async () => {
    const service = new OfficialPriceService()
    const result = await service.lookup({
      key: 'eunma-1-101',
      assetKind: 'apartment',
      address: '서울특별시 강남구 대치동 316',
      complexName: '은마아파트',
      dong: '1동',
      room: '101호',
      pnu: '1168010600103160000',
    }, {
      LDONG: {} as KVNamespace,
      DATA_GO_KR_SERVICE_KEY: '',
    })

    expect(result.status).toBe('found')
    if (result.status !== 'found') return

    expect(result.value.items.length).toBeGreaterThan(1)
    expect(result.value.items[0]).toMatchObject({
      baseDate: '2026.1.1',
      price: 2_237_000_000,
    })
    expect(result.value.items.at(-1)).toMatchObject({
      baseDate: '2006.1.1',
      price: 542_000_000,
    })
    console.info(JSON.stringify({
      count: result.value.items.length,
      newest: result.value.items[0],
      oldest: result.value.items.at(-1),
    }))
  }, LIVE_TEST_TIMEOUT_MS)
})
