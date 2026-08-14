import { describe, expect, it } from 'vitest'

import type { StoredPortfolioItem } from '../shared/portfolio'
import { buildConsultRequestUrl } from '../src/holding-screen/consult-link'
import { ownershipShareFromFraction } from '../src/portfolio/ownership-share'

const item = (
  overrides: Partial<StoredPortfolioItem> = {},
): StoredPortfolioItem => ({
  id: 'i1',
  assetKind: 'apartment',
  complexId: 'A13583507',
  pnu: null,
  aptCode: null,
  legalDongCode: '1168010600',
  complexName: '은마',
  address: '서울 강남구 삼성로 212',
  dong: '21',
  ho: '101',
  exclusiveArea: 76.79,
  officialPrice: 2_237_000_000,
  officialPriceBaseDate: '2026-01-01',
  priorOfficialPrices: [],
  ownershipShare: ownershipShareFromFraction(1),
  isSoleHouseholdOwner: true,
  residency: 'residing',
  areaKind: 'general',
  acquisitionDate: null,
  residenceYears: null,
  ...overrides,
})

const addressOf = (url: string): string | null =>
  new URL(url).searchParams.get('부동산주소')

describe('상담신청 링크', () => {
  /*
   * 칸 이름은 받는 쪽 폼의 `name` 속성과 글자 하나까지 같아야 채워진다.
   * 틀리면 오류 없이 빈 칸으로 도착하므로 이름 자체를 값으로 고정한다 —
   * docs/consult-form-prefill.md 참조.
   */
  it('부동산주소 칸만 보낸다', () => {
    const params = new URL(buildConsultRequestUrl([item()])).searchParams
    expect([...params.keys()]).toEqual(['부동산주소'])
  })

  it('도로명 주소에 동·호까지 한 줄로 적는다', () => {
    expect(addressOf(buildConsultRequestUrl([item()])))
      .toBe('서울 강남구 삼성로 212 21동 101호')
  })

  it('동·호가 없으면 주소만 적는다', () => {
    expect(addressOf(buildConsultRequestUrl([item({ dong: null, ho: null })])))
      .toBe('서울 강남구 삼성로 212')
  })

  it('호만 없으면 동까지만 적는다', () => {
    expect(addressOf(buildConsultRequestUrl([item({ ho: null })])))
      .toBe('서울 강남구 삼성로 212 21동')
  })

  /* 한 채가 한 줄이므로 줄바꿈이 곧 물건 구분이다. */
  it('여러 채는 줄바꿈으로 나눈다', () => {
    expect(addressOf(buildConsultRequestUrl([
      item(),
      item({
        id: 'i2',
        complexName: '압구정미성2차',
        address: '서울 강남구 압구정로 201',
        dong: '11',
        ho: '302',
      }),
    ]))).toBe(
      '서울 강남구 삼성로 212 21동 101호\n'
      + '서울 강남구 압구정로 201 11동 302호',
    )
  })

  it('담은 것이 없으면 파라미터를 붙이지 않는다', () => {
    const url = new URL(buildConsultRequestUrl([]))
    expect([...url.searchParams.keys()]).toEqual([])
  })

  /* 상담 내용과 동의는 본인이 적고 누를 몫이다. */
  it('상담내용과 개인정보 동의는 보내지 않는다', () => {
    const params = new URL(buildConsultRequestUrl([item()])).searchParams
    expect(params.has('상담내용')).toBe(false)
    expect(params.has('개인정보동의')).toBe(false)
  })
})
