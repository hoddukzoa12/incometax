import { describe, expect, it } from 'vitest'

import {
  getKnownPeriodMinimumYears,
  getOwnerAgeKnowledge,
  hasExactOwnerAge,
} from '../src/holding-screen/condition-values'
import {
  formatDeductionWon,
  formatWon,
} from '../src/format/won'
import {
  formatRate,
  formatSignedHistoryRate,
} from '../src/holding-screen/format'
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
    expect(hasExactOwnerAge(2026, 0)).toBe(false)
    expect(hasExactOwnerAge(2026, 60)).toBe(false)
    expect(hasExactOwnerAge(2026, 57)).toBe(true)
    expect(getKnownPeriodMinimumYears(2)).toBeNull()
    expect(getKnownPeriodMinimumYears(3)).toBe(3)
  })

  it('formats standalone won amounts with a postfix unit and a space', () => {
    expect(formatWon(2_237_000_000)).toBe('2,237,000,000 원')
  })

  it('uses the mathematical minus sign for every negative format', () => {
    expect(formatWon(-954_600)).toBe('−954,600 원')
    expect(formatDeductionWon(954_600)).toBe('−954,600 원')
    expect(formatRate(-0.041)).toBe('−4.1%')
    expect(formatSignedHistoryRate(-0.041)).toBe('−4.1%')
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
    expect(HOLDING_TAX_MESSAGES.assumptionsSummary([
      HOLDING_TAX_MESSAGES.yearAssumption(2026, 0, ['']),
      HOLDING_TAX_MESSAGES.yearAssumption(2027, null, ['']),
      HOLDING_TAX_MESSAGES.yearAssumption(2028, null, ['']),
    ])).toBe('2026년 6월 1일 기준 만 60세 미만')
    expect(HOLDING_TAX_MESSAGES.assumptionsSummary([
      HOLDING_TAX_MESSAGES.yearAssumption(2026, 57, ['']),
      HOLDING_TAX_MESSAGES.yearAssumption(2027, 58, ['']),
      HOLDING_TAX_MESSAGES.yearAssumption(2028, 59, ['']),
    ])).toBe(
      '2026년 6월 1일 기준 만 57세 / ' +
      '2027년 6월 1일 기준 만 58세 / ' +
      '2028년 6월 1일 기준 만 59세',
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

  it('replaces a generic disclaimer with the known unsupported cases', () => {
    expect(HOLDING_TAX_MESSAGES.cautions).toContain(
      '합산배제(임대주택·사원용주택 등), 상속주택·지방 저가주택·일시적 2주택 특례, 부부공동명의 1주택자 특례 신청, 토지분 종합부동산세(종합합산·별도합산)는 계산하지 않아 해당하면 실제보다 높은 세액이 표시될 수 있습니다.',
    )
    expect(HOLDING_TAX_MESSAGES.cautions).toHaveLength(4)
  })

  it('keeps the missing-prior-price burden-cap explanation', () => {
    expect(HOLDING_TAX_MESSAGES.unavailableCapAssumption(2025, ['신축']))
      .toBe(
        '신축의 2025년 공시가격 기록이 없어 2026년 세부담상한을 적용하지 않았어요. ' +
        '상한은 세액을 줄이므로 표시값은 실제 세액보다 낮아지지 않는 방향의 값이에요.',
      )
  })
})
