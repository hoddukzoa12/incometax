import { describe, expect, it } from 'vitest'

import { parseKakaoGeocodingResponse } from '../scripts/lib/kakao-geocoder.ts'

const input = {
  complexId: 'A10027875',
  address: '부산광역시 사하구 낙동대로 180',
}

describe('parseKakaoGeocodingResponse', () => {
  it('maps Kakao x/y to WGS84 lng/lat', () => {
    expect(
      parseKakaoGeocodingResponse(input, {
        meta: { total_count: 1 },
        documents: [
          {
            address_name: '부산 사하구 괴정동 258',
            x: '128.9901',
            y: '35.1012',
          },
        ],
      }),
    ).toEqual({
      status: 'success',
      complexId: 'A10027875',
      sourceAddress: '부산광역시 사하구 낙동대로 180',
      resolvedAddress: '부산 사하구 괴정동 258',
      lat: 35.1012,
      lng: 128.9901,
    })
  })

  it('separates a normal no-result response from request failure', () => {
    expect(
      parseKakaoGeocodingResponse(input, {
        meta: { total_count: 0 },
        documents: [],
      }),
    ).toEqual({
      status: 'notFound',
      complexId: 'A10027875',
      sourceAddress: '부산광역시 사하구 낙동대로 180',
    })
  })

  it('rejects malformed or out-of-range coordinates', () => {
    expect(() =>
      parseKakaoGeocodingResponse(input, {
        documents: [
          {
            address_name: '부산 사하구 괴정동 258',
            x: '128.9901',
            y: '135.1012',
          },
        ],
      }),
    ).toThrow('Invalid latitude coordinate')
  })
})
