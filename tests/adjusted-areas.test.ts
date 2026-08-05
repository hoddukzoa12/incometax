import { describe, expect, it } from 'vitest'

import {
  ADJUSTED_AREA_SNAPSHOT,
  resolveAreaKind,
} from '../data/adjusted-areas'

describe('resolveAreaKind', () => {
  it('resolves designated and non-designated legal dong codes', () => {
    // 국토교통부공고 제2026-882호(시행 2026-07-01)의 전체 현황:
    // 서울 강남구는 지정, 부산 해운대구는 비지정이다.
    expect(resolveAreaKind('1168010600')).toBe('adjusted')
    expect(resolveAreaKind('2635010500')).toBe('general')
  })

  it('uses the current Ministry of Land designation snapshot', () => {
    expect(ADJUSTED_AREA_SNAPSHOT).toMatchObject({
      noticeNumber: '국토교통부공고 제2026-882호',
      effectiveOn: '2026-07-01',
      lastAmendedOn: '2026-07-01',
      verifiedOn: '2026-08-05',
    })
  })

  it('rejects malformed codes instead of silently treating them as general', () => {
    expect(() => resolveAreaKind('11680')).toThrow(TypeError)
    expect(() => resolveAreaKind('116801060A')).toThrow(TypeError)
  })
})
