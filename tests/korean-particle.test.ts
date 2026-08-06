import { describe, expect, it } from 'vitest'

import {
  selectKoreanParticle,
  withKoreanParticle,
} from '../src/i18n/korean-particle'

describe('Korean particle selection', () => {
  it.each([
    ['은마', '은마는'],
    ['래미안', '래미안은'],
    ['자이', '자이는'],
    ['힐스테이트', '힐스테이트는'],
    ['e편한세상', 'e편한세상은'],
    ['2026.1.1', '2026.1.1은'],
    ['1동', '1동은'],
  ])('adds the right topic particle to %s', (value, expected) => {
    expect(withKoreanParticle(value, '은/는')).toBe(expected)
  })

  it('supports every requested particle pair', () => {
    expect(withKoreanParticle('은마', '이/가')).toBe('은마가')
    expect(withKoreanParticle('래미안', '이/가')).toBe('래미안이')
    expect(withKoreanParticle('은마', '을/를')).toBe('은마를')
    expect(withKoreanParticle('래미안', '을/를')).toBe('래미안을')
    expect(withKoreanParticle('은마', '와/과')).toBe('은마와')
    expect(withKoreanParticle('래미안', '와/과')).toBe('래미안과')
    expect(withKoreanParticle('은마', '로/으로')).toBe('은마로')
    expect(withKoreanParticle('래미안', '로/으로')).toBe('래미안으로')
    expect(withKoreanParticle('서울', '로/으로')).toBe('서울로')
  })

  it('uses the Korean reading of trailing digits and Latin letters', () => {
    expect(selectKoreanParticle('900,000,000원', '을/를')).toBe('을')
    expect(selectKoreanParticle('APT', '은/는')).toBe('는')
    expect(selectKoreanParticle('URL', '로/으로')).toBe('로')
  })
})
