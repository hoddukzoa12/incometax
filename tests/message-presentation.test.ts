import { describe, expect, it } from 'vitest'

import {
  getKnownPeriodMinimumYears,
  getOwnerAgeKnowledge,
} from '../src/holding-screen/condition-values'
import { formatWon } from '../src/holding-screen/format'
import { HOLDING_TAX_MESSAGES } from '../src/messages/holding-tax'

describe('message presentation', () => {
  it('keeps threshold answers distinct from exact condition values', () => {
    expect(getOwnerAgeKnowledge(2026, 0)).toEqual({
      kind: 'youngerThan',
      years: 60,
    })
    expect(getOwnerAgeKnowledge(2027, 61)).toEqual({
      kind: 'atLeast',
      years: 61,
    })
    expect(getOwnerAgeKnowledge(2026, 57)).toEqual({
      kind: 'exact',
      years: 57,
    })
    expect(getKnownPeriodMinimumYears(2)).toBeNull()
    expect(getKnownPeriodMinimumYears(3)).toBe(3)
  })

  it('formats standalone won amounts with a postfix unit and a space', () => {
    expect(formatWon(2_237_000_000)).toBe('2,237,000,000 원')
  })

  it('describes a checkbox-only age without claiming an exact age', () => {
    expect(HOLDING_TAX_MESSAGES.yearAssumption(2026, 0, [''])).toBe(
      '2026년 6월 1일 기준 만 60세 미만',
    )
    expect(HOLDING_TAX_MESSAGES.yearAssumption(2027, 1, [''])).toBe(
      '2027년 6월 1일 기준 만 61세 미만',
    )
    expect(HOLDING_TAX_MESSAGES.yearAssumption(2026, 60, [''])).toBe(
      '2026년 6월 1일 기준 만 60세 이상',
    )
    expect(HOLDING_TAX_MESSAGES.yearAssumption(2026, 57, [''])).toBe(
      '2026년 6월 1일 기준 만 57세',
    )
  })

  it('omits zero and implicitly elapsed periods from the summary', () => {
    expect(HOLDING_TAX_MESSAGES.itemAssumption('은마', 0, 0)).toBe('')
    expect(HOLDING_TAX_MESSAGES.itemAssumption('은마', 2, 1)).toBe('')
    expect(HOLDING_TAX_MESSAGES.itemAssumption('은마', 5, 3)).toBe(
      '은마 5년 이상 보유/3년 이상 거주',
    )
  })

  it('uses a particle that matches the final complex name', () => {
    expect(HOLDING_TAX_MESSAGES.continuingResidenceAssumption(['은마']))
      .toMatch(/^은마는 /)
    expect(HOLDING_TAX_MESSAGES.continuingResidenceAssumption(['래미안']))
      .toMatch(/^래미안은 /)
  })
})
