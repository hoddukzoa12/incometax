import { describe, expect, it } from 'vitest'

import {
  LDONG_SNAPSHOT_KEY,
  refreshLdong,
  type LdongSnapshot,
} from '../worker/ldong/refresh'

const LIVE_TEST_TIMEOUT_MS = 120_000
const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY

class MemoryKv {
  readonly values = new Map<string, string>()

  async put(key: string, value: string): Promise<void> {
    this.values.set(key, value)
  }
}

function invalidRefreshResponse(): Response {
  return Response.json({
    StanReginCd: [
      {
        head: [{
          totalCount: 1,
          RESULT: { resultCode: 'INFO-0', resultMsg: '정상' },
        }],
      },
      {
        row: [{
          locatadd_nm: '서울특별시 종로구 청운동',
          region_cd: '1111010100',
        }],
      },
    ],
  })
}

describe.skipIf(!serviceKey)('live legal-dong refresh verification', () => {
  it('collects nationwide data and preserves the old snapshot on failure', async () => {
    const kv = new MemoryKv()
    const env = {
      LDONG: kv as unknown as KVNamespace,
      DATA_GO_KR_SERVICE_KEY: serviceKey!,
    }

    const snapshot = await refreshLdong(env)
    const storedAfterSuccess = kv.values.get(LDONG_SNAPSHOT_KEY)

    expect(snapshot.count).toBeGreaterThanOrEqual(15_000)
    expect(snapshot.codes['서울특별시 종로구 청운동']).toBe('1111010100')
    expect(storedAfterSuccess).toBeTruthy()

    await expect(refreshLdong(env, {
      fetcher: async () => invalidRefreshResponse(),
      sleep: async () => undefined,
    })).rejects.toThrow('건수 검증 실패')
    expect(kv.values.get(LDONG_SNAPSHOT_KEY)).toBe(storedAfterSuccess)

    const stored = JSON.parse(storedAfterSuccess!) as LdongSnapshot
    console.info(JSON.stringify({
      count: stored.count,
      requiredSample: stored.codes['서울특별시 종로구 청운동'],
      failedRefreshPreservedExistingSnapshot: true,
    }))
  }, LIVE_TEST_TIMEOUT_MS)
})
