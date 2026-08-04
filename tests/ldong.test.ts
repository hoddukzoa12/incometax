import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildPnu, parseLotAddress } from '../worker/ldong/address'
import {
  addressToPnu,
  clearLdongMemoryCacheForTest,
} from '../worker/ldong/lookup'
import {
  LDONG_SNAPSHOT_KEY,
  refreshLdong,
  type LdongRefreshEnv,
  type LdongSnapshot,
} from '../worker/ldong/refresh'

function kvWithSnapshot(snapshot: LdongSnapshot | null): KVNamespace {
  return {
    get: vi.fn(async (key: string, type?: string) => {
      if (key !== LDONG_SNAPSHOT_KEY || !snapshot) return null
      return type === 'json' ? snapshot : JSON.stringify(snapshot)
    }),
  } as unknown as KVNamespace
}

function regionPage(total: number, rows: readonly Record<string, unknown>[]) {
  return {
    StanReginCd: [
      {
        head: [
          {
            totalCount: total,
            RESULT: { resultCode: 'INFO-0', resultMsg: '정상 처리되었습니다.' },
          },
        ],
      },
      { row: rows },
    ],
  }
}

describe('offline address to PNU conversion', () => {
  beforeEach(() => clearLdongMemoryCacheForTest())

  it('normalizes ordinary, mountain, unicode-hyphen, and 번지 lot addresses', () => {
    expect(parseLotAddress('서울특별시 강남구 역삼동 736-1')).toEqual({
      legalDongName: '서울특별시 강남구 역삼동',
      isMountain: false,
      mainNumber: '736',
      subNumber: '1',
    })
    expect(parseLotAddress('강원특별자치도 춘천시 동면 산 15–3')).toEqual({
      legalDongName: '강원특별자치도 춘천시 동면',
      isMountain: true,
      mainNumber: '15',
      subNumber: '3',
    })
    expect(parseLotAddress('서울특별시 종로구 청운동 265번지')).toMatchObject({
      mainNumber: '265',
      subNumber: '0',
    })
    expect(parseLotAddress('서울특별시 강남구 역삼동')).toBeNull()
  })

  it('builds an exactly 19-digit PNU and rejects out-of-range components', () => {
    const parsed = parseLotAddress('서울특별시 강남구 역삼동 736-1')
    expect(parsed).not.toBeNull()
    expect(buildPnu(parsed!, '1168010100')).toBe('1168010100107360001')
    expect(buildPnu({ ...parsed!, mainNumber: '12345' }, '1168010100')).toBeNull()
  })

  it('uses only the KV snapshot during each address lookup', async () => {
    const kv = kvWithSnapshot({
      builtAt: Date.now(),
      count: 1,
      source: 'test',
      codes: { '서울특별시 강남구 역삼동': '1168010100' },
    })
    const env = { LDONG: kv, DATA_GO_KR_SERVICE_KEY: '' }

    await expect(
      addressToPnu('서울특별시 강남구 역삼동 736-1', env),
    ).resolves.toBe('1168010100107360001')
    expect(kv.get).toHaveBeenCalledTimes(1)
  })
})

describe('legal-dong KV refresh', () => {
  it('replaces the single snapshot only after all records pass validation', async () => {
    const total = 15_000
    const perPage = 1_000
    const writes: [string, string][] = []
    const put = vi.fn(async (key: string, value: string) => {
      writes.push([key, value])
    })
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input))
      const page = Number(url.searchParams.get('pageNo'))
      const start = (page - 1) * perPage
      const rows = Array.from({ length: perPage }, (_, offset) => {
        const index = start + offset
        if (index === 0) {
          return {
            locatadd_nm: '서울특별시 종로구 청운동',
            region_cd: '1111010100',
          }
        }
        return {
          locatadd_nm: `검증시 검증구 검증동${index}`,
          region_cd: String(2_000_000_000 + index),
        }
      })
      return Response.json(regionPage(total, rows))
    })
    const env = {
      LDONG: { put } as unknown as KVNamespace,
      DATA_GO_KR_SERVICE_KEY: 'test-key',
    } satisfies LdongRefreshEnv

    const snapshot = await refreshLdong(env, {
      fetcher: fetcher as typeof fetch,
      now: () => 123,
      sleep: async () => undefined,
    })

    expect(snapshot).toMatchObject({ builtAt: 123, count: total })
    expect(fetcher).toHaveBeenCalledTimes(total / perPage)
    expect(put).toHaveBeenCalledTimes(1)
    expect(writes[0][0]).toBe(LDONG_SNAPSHOT_KEY)
  })

  it('keeps the existing snapshot when minimum-count validation fails', async () => {
    const writes: [string, string][] = []
    const put = vi.fn(async (key: string, value: string) => {
      writes.push([key, value])
    })
    const env = {
      LDONG: { put } as unknown as KVNamespace,
      DATA_GO_KR_SERVICE_KEY: 'test-key',
    } satisfies LdongRefreshEnv
    const fetcher = vi.fn(async () => Response.json(regionPage(1, [{
      locatadd_nm: '서울특별시 종로구 청운동',
      region_cd: '1111010100',
    }])))

    await expect(refreshLdong(env, {
      fetcher: fetcher as typeof fetch,
      sleep: async () => undefined,
    })).rejects.toThrow('건수 검증 실패')
    expect(put).not.toHaveBeenCalled()
    expect(writes).toEqual([])
  })
})
