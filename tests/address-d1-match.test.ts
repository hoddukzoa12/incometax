import { describe, expect, it } from 'vitest'

import type { ComplexStagingRecord } from '../shared/complex'
import type { AddressSearchResult } from '../shared/search'
import { findMatchingComplex } from '../src/search/address-d1-match'

function makeComplex(
  overrides: Partial<ComplexStagingRecord> & { complexId: string; name: string; legalAddress: string },
): ComplexStagingRecord {
  return {
    roadAddress: null,
    legalDongCode: '1168010600',
    approvalDate: null,
    buildingCount: null,
    householdCount: null,
    lat: 37.5,
    lng: 127.0,
    placeUrl: null,
    lookupStatus: 'matched',
    backfillReason: null,
    ...overrides,
  }
}

function makeAddress(address: string): AddressSearchResult {
  return { address, lat: 37.5, lng: 127.0 }
}

describe('findMatchingComplex', () => {
  const d1Items: readonly ComplexStagingRecord[] = [
    makeComplex({
      complexId: 'A12345',
      name: '역삼 현대아파트',
      legalAddress: '서울 강남구 역삼동 693-15',
    }),
    makeComplex({
      complexId: 'A67890',
      name: '삼성 래미안',
      legalAddress: '서울 강남구 삼성동 189',
    }),
  ]

  it('주소가 D1 단지와 일치하면 해당 단지를 반환한다', () => {
    const result = findMatchingComplex(
      makeAddress('서울 강남구 역삼동 693-15'),
      d1Items,
    )
    expect(result).toBe(d1Items[0])
  })

  it('주소가 D1에 없으면 null을 반환한다', () => {
    const result = findMatchingComplex(
      makeAddress('서울 서초구 서초동 100'),
      d1Items,
    )
    expect(result).toBeNull()
  })

  it('공백 차이만 있는 경우에도 매칭에 성공한다', () => {
    const result = findMatchingComplex(
      makeAddress('서울  강남구  역삼동  693-15'),
      d1Items,
    )
    expect(result).toBe(d1Items[0])
  })

  it('complexItems가 빈 배열이면 null을 반환한다', () => {
    const result = findMatchingComplex(
      makeAddress('서울 강남구 역삼동 693-15'),
      [],
    )
    expect(result).toBeNull()
  })

  it('여러 단지가 있을 때 첫 번째 매칭만 반환한다', () => {
    const duplicates: readonly ComplexStagingRecord[] = [
      makeComplex({
        complexId: 'FIRST',
        name: '첫 번째',
        legalAddress: '서울 강남구 역삼동 100',
      }),
      makeComplex({
        complexId: 'SECOND',
        name: '두 번째',
        legalAddress: '서울 강남구 역삼동 100',
      }),
    ]
    const result = findMatchingComplex(
      makeAddress('서울 강남구 역삼동 100'),
      duplicates,
    )
    expect(result?.complexId).toBe('FIRST')
  })
})
