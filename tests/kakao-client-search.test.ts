import { describe, expect, it } from 'vitest'

import {
  toAddressSearchResult,
  toPlaceSearchResult,
} from '../src/search/kakao'

describe('Kakao client search result mapping', () => {
  it('keeps structured lot-address fields from address search', () => {
    const result = toAddressSearchResult({
      address: {
        address_name: '서울 강남구 역삼동 795-10',
        b_code: '1168010100',
        main_address_no: '795',
        mountain_yn: 'N',
        sub_address_no: '10',
      },
      address_name: '서울 강남구 테헤란로 123',
      road_address: {
        address_name: '서울 강남구 테헤란로 123',
      },
      x: '127.035',
      y: '37.499',
    })

    expect(result).toEqual({
      address: '서울 강남구 역삼동 795-10',
      roadAddress: '서울 강남구 테헤란로 123',
      lat: 37.499,
      lng: 127.035,
      bCode: '1168010100',
      isMountain: false,
      mainNumber: '795',
      subNumber: '10',
    })
  })

  it('keeps keyword places in a housing category', () => {
    const result = toPlaceSearchResult({
      address_name: '서울 강남구 역삼동 795-10',
      category_name: '부동산 > 주거시설 > 빌라,주택',
      place_name: '현대빌라',
      road_address_name: '서울 강남구 테헤란로 123',
      x: '127.035',
      y: '37.499',
    })

    expect(result).toEqual({
      address: '서울 강남구 역삼동 795-10',
      roadAddress: '서울 강남구 테헤란로 123',
      placeName: '현대빌라',
      lat: 37.499,
      lng: 127.035,
    })
  })

  it('drops keyword places outside housing categories', () => {
    expect(toPlaceSearchResult({
      address_name: '서울 강남구 역삼동 795-10',
      category_name: '음식점 > 카페',
      place_name: '현대카페',
      road_address_name: '서울 강남구 테헤란로 123',
      x: '127.035',
      y: '37.499',
    })).toBeNull()
  })

  it('drops malformed results instead of exposing invalid coordinates', () => {
    expect(toPlaceSearchResult({
      address_name: '서울 강남구 역삼동 795-10',
      place_name: '현대빌라',
      road_address_name: '',
      x: 'not-a-coordinate',
      y: '37.499',
    })).toBeNull()
  })
})
