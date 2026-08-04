import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  MINIMUM_REGION_CODE_COUNT,
  REQUIRED_REGION_CODES,
  refreshLdong,
  type LdongRefreshEnv,
} from '../worker/ldong/refresh'
import {
  RealtyPriceClient,
  responseList,
} from '../worker/realty-price/client'

const TEST_BUILT_AT = 123
const TEST_NOW = 0
const SYNTHETIC_REGION_CODE_BASE = 2_000_000_000
const [REQUIRED_REGION_NAME, REQUIRED_REGION_CODE] =
  Object.entries(REQUIRED_REGION_CODES)[0]

function regionCodeResponse(pageNumber: number, pageSize: number): Response {
  const start = (pageNumber - 1) * pageSize
  const rowCount = Math.min(
    pageSize,
    MINIMUM_REGION_CODE_COUNT - start,
  )
  const rows = Array.from({ length: rowCount }, (_, offset) => {
    const index = start + offset
    if (index === 0) {
      return {
        locatadd_nm: REQUIRED_REGION_NAME,
        region_cd: REQUIRED_REGION_CODE,
      }
    }
    return {
      locatadd_nm: `검증시 검증구 검증동${index}`,
      region_cd: String(SYNTHETIC_REGION_CODE_BASE + index),
    }
  })

  return Response.json({
    StanReginCd: [
      {
        head: [{
          totalCount: MINIMUM_REGION_CODE_COUNT,
          RESULT: { resultCode: 'INFO-0', resultMsg: '정상' },
        }],
      },
      { row: rows },
    ],
  })
}

describe('Workers runtime default fetchers', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('preserves the workerd global receiver in both default fetcher paths', async () => {
    const receivers: unknown[] = []
    let regionRequestCount = 0
    let realtyRequestCount = 0

    // The pool virtualizes outbound fetch. This receiver-sensitive stand-in
    // preserves the production host function's invocation contract while the
    // default dependency branches themselves execute inside workerd.
    vi.stubGlobal('fetch', async function (
      this: unknown,
      input: Parameters<typeof fetch>[0],
    ): Promise<Response> {
      receivers.push(this)
      const url = new URL(String(input))

      if (url.searchParams.has('pageNo')) {
        regionRequestCount += 1
        return regionCodeResponse(
          Number(url.searchParams.get('pageNo')),
          Number(url.searchParams.get('numOfRows')),
        )
      }
      realtyRequestCount += 1
      return Response.json({ model: { list: [] } })
    })

    const put = vi.fn(async () => undefined)
    const env = {
      LDONG: { put } as unknown as KVNamespace,
      DATA_GO_KR_SERVICE_KEY: 'test-key',
    } satisfies LdongRefreshEnv

    const snapshot = await refreshLdong(env, {
      now: () => TEST_BUILT_AT,
      sleep: async () => undefined,
    })
    const client = new RealtyPriceClient({
      now: () => TEST_NOW,
      sleep: async () => undefined,
    })
    const realtyResponse = await client.request('/test', {})

    expect(snapshot).toMatchObject({
      builtAt: TEST_BUILT_AT,
      count: MINIMUM_REGION_CODE_COUNT,
    })
    expect(put).toHaveBeenCalledOnce()
    expect(responseList(realtyResponse)).toEqual([])
    expect(regionRequestCount).toBeGreaterThan(0)
    expect(realtyRequestCount).toBe(1)
    expect(receivers).toHaveLength(regionRequestCount + realtyRequestCount)
    expect(receivers.every((receiver) => receiver === globalThis)).toBe(true)
  })
})
