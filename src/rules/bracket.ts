import type { Bracket } from '../../shared/tax-rules'

const MISSING_BRACKET_MESSAGE = 'No tax bracket covers the taxable base'

export const findApplicableTaxBracket = (
  taxableBase: number,
  brackets: readonly Bracket[],
): Bracket => {
  const bracket = brackets.find(({ upTo }) => taxableBase <= upTo)

  if (!bracket) {
    throw new RangeError(MISSING_BRACKET_MESSAGE)
  }

  return bracket
}

export const evaluateBracketTax = (
  taxableBase: number,
  brackets: readonly Bracket[],
): number => {
  const bracket = findApplicableTaxBracket(taxableBase, brackets)

  return Math.max(
    0,
    taxableBase * bracket.rate - bracket.progressiveDeduction,
  )
}
