import { describe, expect, it } from 'vitest'

import {
  isKakaoComplexPlaceCandidate,
  kakaoPlaceDistanceMeters,
  kakaoPlaceNameSimilarity,
  rankKakaoPlaceCandidates,
} from '../scripts/lib/kakao-place-match.ts'

const apartment = (
  placeName: string,
  lat = 37.49741836284779,
  lng = 127.06532735974666,
  legalAddress = '서울 강남구 대치동 316',
) => ({
  placeName,
  categoryName: '부동산 > 주거시설 > 아파트',
  legalAddress,
  lat,
  lng,
  placeUrl: `http://place.map.kakao.com/${placeName}`,
})

describe('Kakao complex place matching', () => {
  it('normalizes apartment suffixes without weakening distinctive names', () => {
    expect(kakaoPlaceNameSimilarity('은마', '은마아파트')).toBe(1)
    expect(
      kakaoPlaceNameSimilarity(
        '답십리대우아파트(임대)',
        '답십리대우아파트',
      ),
    ).toBeGreaterThanOrEqual(0.65)
  })

  it('rejects accessory facilities even when their coordinates and names overlap', () => {
    expect(
      isKakaoComplexPlaceCandidate('은마', {
        ...apartment('은마아파트 관리사무소'),
        categoryName: '서비스,산업 > 관리,운영 > 건물관리사무소',
      }),
    ).toBe(false)
    expect(
      isKakaoComplexPlaceCandidate('현대1차', apartment('현대2차아파트')),
    ).toBe(false)
  })

  it('ranks a matching apartment ahead of nearby unrelated results', () => {
    const complex = {
      name: '은마',
      legalAddress: '서울특별시 강남구 대치동 316번지',
      lat: 37.49741836284779,
      lng: 127.06532735974666,
    }
    const candidates = [
      apartment('은마아파트 남문'),
      apartment('은마아파트'),
      apartment('은마종합상가'),
    ]
    candidates[0] = {
      ...candidates[0],
      categoryName: '교통,수송 > 입출구',
    }
    candidates[2] = {
      ...candidates[2],
      categoryName: '가정,생활 > 상가,아케이드',
    }

    expect(rankKakaoPlaceCandidates(complex, candidates)).toEqual([
      expect.objectContaining({
        candidate: expect.objectContaining({ placeName: '은마아파트' }),
        distanceMeters: 0,
        nameSimilarity: 1,
      }),
    ])
  })

  it.each([
    [
      '테헤란 IPARK',
      '서울특별시 강남구 역삼동 709-5',
      '테헤란아이파크아파트',
      '서울 강남구 역삼동 709-5',
    ],
    [
      '도곡1차아이파크',
      '서울 강남구 도곡동 543-7',
      '도곡1차I PARK아파트',
      '서울 강남구 도곡동 543-7',
    ],
    [
      '역삼아이파크',
      '서울 강남구 역삼동 713-11',
      '역삼I PARK1차아파트',
      '서울 강남구 역삼동 713-11',
    ],
    [
      '코네스트',
      '서울 서초구 서초동 1365-8',
      'CONEST아파트',
      '서울 서초구 서초동 1365-8',
    ],
    [
      '강변동양아파트',
      '서울 성동구 성수동1가 479-1',
      '성수동양아파트',
      '서울 성동구 성수동1가 479-1',
    ],
    [
      '성수신성아파트',
      '서울 성동구 성수동2가 833',
      '신성노바빌아파트',
      '서울 성동구 성수동2가 833',
    ],
    [
      '압구정한양3단지',
      '서울 강남구 압구정동 489',
      '한양3차아파트',
      '서울 강남구 압구정동 489',
    ],
  ])(
    'accepts an apartment at the exact lot regardless of name similarity: %s',
    (name, legalAddress, placeName, candidateAddress) => {
      expect(
        rankKakaoPlaceCandidates(
          {
            name,
            legalAddress,
            lat: 37.5,
            lng: 127.05,
          },
          [apartment(placeName, 37.5, 127.05, candidateAddress)],
        ),
      ).toHaveLength(1)
    },
  )

  it('compares the legal-dong and lot suffix across unstable province labels', () => {
    const candidates = rankKakaoPlaceCandidates(
      {
        name: '테스트단지',
        legalAddress: '전남광주통합특별시 목포시 용당동 1214번지',
        lat: 34.8,
        lng: 126.4,
      },
      [apartment('전혀다른아파트', 34.8, 126.4, '전남 목포시 용당동 1214')],
    )

    expect(candidates).toHaveLength(1)
  })

  it('uses name similarity only to choose among apartments at the same lot', () => {
    const candidates = rankKakaoPlaceCandidates(
      {
        name: '월계주공2단지',
        legalAddress: '서울특별시 노원구 월계동 556',
        lat: 37.62,
        lng: 127.06,
      },
      [
        apartment('월계주공1단지아파트', 37.62, 127.06, '서울 노원구 월계동 556'),
        apartment('월계주공2단지아파트', 37.62, 127.06, '서울 노원구 월계동 556'),
      ],
    )

    expect(candidates.map(({ candidate }) => candidate.placeName)).toEqual([
      '월계주공2단지아파트',
      '월계주공1단지아파트',
    ])
  })

  it('keeps the existing name threshold when the target has no lot number', () => {
    const candidates = rankKakaoPlaceCandidates(
      {
        name: '현대1차',
        legalAddress: '경기도 시흥시 정왕동',
        lat: 37.34,
        lng: 126.73,
      },
      [apartment('현대2차아파트', 37.34, 126.73, '경기 시흥시 정왕동 1')],
    )

    expect(candidates).toEqual([])
  })

  it('measures WGS84 distance in meters', () => {
    expect(
      kakaoPlaceDistanceMeters(
        { lat: 37.4974, lng: 127.0653 },
        { lat: 37.5019, lng: 127.0653 },
      ),
    ).toBeCloseTo(500, -1)
  })
})
