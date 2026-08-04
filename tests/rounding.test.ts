import { describe, expect, it } from 'vitest'

import { roundTaxAmount } from '../src/rules/rounding'

describe('roundTaxAmount', () => {
  it('rounds a tax amount to the nearest won', () => {
    expect(roundTaxAmount(1_234.49)).toBe(1_234)
    expect(roundTaxAmount(1_234.5)).toBe(1_235)
  })

  it('leaves an integer won amount unchanged', () => {
    expect(roundTaxAmount(1_234)).toBe(1_234)
  })
})
