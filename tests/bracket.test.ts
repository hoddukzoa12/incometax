import { describe, expect, it } from 'vitest'

import type { Bracket } from '../shared/tax-rules'
import {
  evaluateBracketTax,
  findApplicableTaxBracket,
} from '../src/rules/bracket'

const BRACKETS = [
  { upTo: 100, rate: 1 / 10, progressiveDeduction: 0 },
  {
    upTo: Number.POSITIVE_INFINITY,
    rate: 2 / 10,
    progressiveDeduction: 10,
  },
] as const satisfies readonly Bracket[]

describe('evaluateBracketTax', () => {
  it('uses the bracket whose upper boundary includes the taxable base', () => {
    expect(evaluateBracketTax(100, BRACKETS)).toBe(10)
    expect(evaluateBracketTax(101, BRACKETS)).toBeCloseTo(10.2)
  })

  it('never returns a negative tax', () => {
    const deductionExceedsTax = [
      {
        upTo: Number.POSITIVE_INFINITY,
        rate: 1 / 10,
        progressiveDeduction: 20,
      },
    ] as const satisfies readonly Bracket[]

    expect(evaluateBracketTax(100, deductionExceedsTax)).toBe(0)
  })

  it('rejects a table that does not cover the taxable base', () => {
    const incompleteBrackets = [
      { upTo: 100, rate: 1 / 10, progressiveDeduction: 0 },
    ] as const satisfies readonly Bracket[]

    expect(() => evaluateBracketTax(101, incompleteBrackets)).toThrow(RangeError)
  })
})

describe('findApplicableTaxBracket', () => {
  it('returns the inclusive bracket used to calculate the tax', () => {
    expect(findApplicableTaxBracket(100, BRACKETS)).toBe(BRACKETS[0])
    expect(findApplicableTaxBracket(101, BRACKETS)).toBe(BRACKETS[1])
  })

  it('rejects a table that does not cover the taxable base', () => {
    expect(() => findApplicableTaxBracket(101, BRACKETS.slice(0, 1))).toThrow(
      RangeError,
    )
  })
})
