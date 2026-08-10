import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  buildKakaoPlaceUrlQuery,
  lookupComplexPlaceUrl,
} from '../scripts/lib/complex-place-url-backfill.ts'
import { DetailRequestController } from '../scripts/lib/complex-detail-backfill.ts'

const target = {
  complexId: 'A13583507',
  name: '은마',
  legalAddress: '서울 강남구 대치동 316',
  lat: 37.49741836284779,
  lng: 127.06532735974666,
} as const

const controller = (): DetailRequestController =>
  new DetailRequestController({
    maxAttempts: 10,
    minimumIntervalMs: 0,
  })

const document = (overrides: Record<string, unknown> = {}) => ({
  id: '11335658',
  place_name: '은마아파트',
  category_name: '부동산 > 주거시설 > 아파트',
  place_url: 'http://place.map.kakao.com/11335658',
  address_name: '서울 강남구 대치동 316',
  road_address_name: '서울 강남구 삼성로 212',
  x: String(target.lng),
  y: String(target.lat),
  ...overrides,
})

const response = (payload: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(payload), {
    headers: { 'content-type': 'application/json' },
    ...init,
  })

const lookup = () =>
  lookupComplexPlaceUrl({
    restApiKey: 'test-key',
    target,
    requestController: controller(),
    recordHttpAttempt: () => undefined,
    recordHttpRetry: () => undefined,
  })

afterEach(() => {
  vi.restoreAllMocks()
})

describe('complex Kakao place URL backfill', () => {
  it('uses the stored lot address and normalized name as the query', () => {
    expect(buildKakaoPlaceUrlQuery(target)).toBe(
      '서울 강남구 대치동 316 은마',
    )
  })

  it('stores Kakao place_url unchanged after coordinate and name validation', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      response({
        documents: [
          document({
            id: 'bad-accessory',
            place_name: '은마아파트 관리사무소',
            category_name: '서비스,산업 > 관리,운영 > 건물관리사무소',
            place_url: 'http://place.map.kakao.com/bad-accessory',
          }),
          document(),
        ],
      }),
    )

    await expect(lookup()).resolves.toEqual({
      kind: 'outcome',
      outcome: {
        complexId: target.complexId,
        status: 'filled',
        placeUrl: 'http://place.map.kakao.com/11335658',
        apiAttempts: 1,
        reason: null,
      },
    })
  })

  it('does not call Kakao for rows whose stored coordinates are missing', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    await expect(
      lookupComplexPlaceUrl({
        restApiKey: 'test-key',
        target: { ...target, lat: null, lng: null },
        requestController: controller(),
        recordHttpAttempt: () => undefined,
        recordHttpRetry: () => undefined,
      }),
    ).resolves.toMatchObject({
      kind: 'outcome',
      outcome: {
        status: 'missingCoordinates',
        placeUrl: null,
        apiAttempts: 0,
      },
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('leaves nearby accessory-only results empty', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      response({
        documents: [
          document({
            place_name: '은마아파트 경로당',
            category_name: '사회,공공기관 > 단체,협회 > 노인회',
          }),
        ],
      }),
    )

    await expect(lookup()).resolves.toMatchObject({
      kind: 'outcome',
      outcome: {
        status: 'candidateMismatch',
        placeUrl: null,
        apiAttempts: 1,
      },
    })
  })

  it('stops without checkpointing Kakao quota exhaustion', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      response(
        {
          errorType: 'BadRequest',
          message: 'API limit has been exceeded.',
          code: -10,
        },
        { status: 400, statusText: 'Bad Request' },
      ),
    )

    await expect(lookup()).resolves.toMatchObject({
      kind: 'quotaExceeded',
      complexId: target.complexId,
      apiAttempts: 1,
    })
  })
})
