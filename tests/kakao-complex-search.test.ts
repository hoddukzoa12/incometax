import { afterEach, describe, expect, it, vi } from 'vitest'

import type { CompleteComplexListRecord } from '../shared/complex.ts'
import {
  buildKakaoComplexQuery,
  classifyKakaoComplexResult,
  normalizeKakaoQueryName,
  parseKakaoKeywordSearchResponse,
  parseKakaoLegalDongCodeResponse,
  searchKakaoComplex,
} from '../scripts/lib/kakao-complex-search.ts'

const input: CompleteComplexListRecord = {
  complexId: 'A12345678',
  name: '은마아파트',
  legalDongCode: '1168010600',
  province: '서울특별시',
  district: '강남구',
  legalDong: '대치동',
  ri: null,
}

const document = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  place_name: '은마아파트',
  category_name: '부동산 > 주거시설 > 아파트',
  address_name: '서울 강남구 대치동 316',
  road_address_name: '서울 강남구 삼성로 212',
  x: '127.06532',
  y: '37.49741',
  ...overrides,
})

const jsonResponse = (payload: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(payload), {
    headers: { 'content-type': 'application/json' },
    ...init,
  })

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Kakao complex keyword search', () => {
  it('builds the measured query without the province name', () => {
    expect(buildKakaoComplexQuery(input)).toBe('강남구 대치동 은마아파트')
  })

  it('strips registered-name suffixes from Kakao queries', () => {
    expect(normalizeKakaoQueryName('답십리대우아파트(임대)')).toBe(
      '답십리대우아파트',
    )
    expect(normalizeKakaoQueryName('염리동 중앙하이츠 A.P.T')).toBe(
      '염리동 중앙하이츠',
    )
    expect(normalizeKakaoQueryName('염리동 중앙하이츠 A.P.T.')).toBe(
      '염리동 중앙하이츠',
    )
  })

  it('parses the first keyword hit regardless of Kakao category', () => {
    expect(
      parseKakaoKeywordSearchResponse({
        documents: [
          document({
            category_name: '서비스,산업 > 관리,운영 > 건물관리사무소',
          }),
        ],
      }),
    ).toMatchObject({
      legalAddress: '서울 강남구 대치동 316',
      roadAddress: '서울 강남구 삼성로 212',
      lat: 37.49741,
      lng: 127.06532,
    })
  })

  it('records a missing keyword hit as pending backfill', () => {
    expect(classifyKakaoComplexResult(input, null, null)).toMatchObject({
      lookupStatus: 'notFound',
      legalAddress: '서울특별시 강남구 대치동',
      lat: null,
      lng: null,
      backfillReason: 'Kakao keyword search returned no results',
    })
  })

  it('does not request a coordinate lookup when the keyword search has no documents', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ documents: [] }))

    await expect(searchKakaoComplex(input, 'test-key')).resolves.toMatchObject({
      lookupStatus: 'notFound',
      backfillReason: 'Kakao keyword search returned no results',
    })
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(new URL(String(fetchMock.mock.calls[0]?.[0])).pathname).toBe(
      '/v2/local/search/keyword.json',
    )
  })

  it('marks a coordinate HTTP 400 as not found without stopping later records', async () => {
    const nextInput = {
      ...input,
      complexId: 'A87654321',
      name: '다음아파트',
    }
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (request) => {
      const url = new URL(String(request))
      if (url.pathname === '/v2/local/search/keyword.json') {
        const isNextInput = url.searchParams.get('query')?.includes(nextInput.name)
        return jsonResponse({
          documents: [
            document(
              isNextInput ? { x: '127.07532', y: '37.50741' } : undefined,
            ),
          ],
        })
      }
      if (url.searchParams.get('x') === '127.06532') {
        return jsonResponse(
          { message: 'Bad Request' },
          { status: 400, statusText: 'Bad Request' },
        )
      }
      return jsonResponse({
        documents: [{ region_type: 'B', code: input.legalDongCode }],
      })
    })

    const results = await Promise.all([
      searchKakaoComplex(input, 'test-key'),
      searchKakaoComplex(nextInput, 'test-key'),
    ])

    expect(results).toMatchObject([
      {
        lookupStatus: 'notFound',
        backfillReason:
          'Kakao coordinate lookup rejected the coordinates with HTTP 400',
      },
      { lookupStatus: 'matched', backfillReason: null },
    ])
  })

  it('does not mark a coordinate quota error as not found', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ documents: [document()] }))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            errorType: 'BadRequest',
            message: 'API limit has been exceeded.',
            code: -10,
          },
          { status: 400, statusText: 'Bad Request' },
        ),
      )

    await expect(searchKakaoComplex(input, 'test-key')).rejects.toMatchObject({
      name: 'HttpResponseError',
      status: 400,
      responseBody: expect.stringContaining('"code":-10'),
    })
  })

  it('selects the legal-dong document from the coordinate response', () => {
    expect(
      parseKakaoLegalDongCodeResponse({
        documents: [
          { region_type: 'H', code: '1168060000' },
          { region_type: 'B', code: '1168010600' },
        ],
      }),
    ).toBe('1168010600')
  })

  it.each([
    {
      caseName: '시+구 concatenation',
      input: {
        ...input,
        province: '경기도',
        district: '안양동안구',
        legalDong: '호계동',
        legalDongCode: '4117310400',
      },
      kakaoAddress: '경기 안양시 동안구 호계동 1053-2',
      kakaoCode: '4117310400',
    },
    {
      caseName: '세종 two-level',
      input: {
        ...input,
        province: '세종특별자치시',
        district: '세종특별자치시',
        legalDong: '다정동',
        legalDongCode: '3611010900',
      },
      kakaoAddress: '세종특별자치시 다정동 960',
      kakaoCode: '3611010900',
    },
  ])('accepts an exact code match for $caseName', (testCase) => {
    const keywordDocument = parseKakaoKeywordSearchResponse({
      documents: [document({ address_name: testCase.kakaoAddress })],
    })
    const kakaoCode = parseKakaoLegalDongCodeResponse({
      documents: [{ region_type: 'B', code: testCase.kakaoCode }],
    })
    expect(
      classifyKakaoComplexResult(testCase.input, keywordDocument, kakaoCode)
        .lookupStatus,
    ).toBe('matched')
  })

  it('rejects a genuine code mismatch', () => {
    const banghwaInput = {
      ...input,
      district: '강서구',
      legalDong: '방화동',
      legalDongCode: '1150010900',
    }
    const keywordDocument = parseKakaoKeywordSearchResponse({
      documents: [document({ address_name: '서울 강서구 마곡동 1' })],
    })
    const magokCode = parseKakaoLegalDongCodeResponse({
      documents: [{ region_type: 'B', code: '1150010500' }],
    })
    expect(
      classifyKakaoComplexResult(banghwaInput, keywordDocument, magokCode),
    ).toMatchObject({
      lookupStatus: 'rejected',
      backfillReason:
        'Kakao legal-dong code mismatch: 1150010900 -> 1150010500',
    })
  })
})
