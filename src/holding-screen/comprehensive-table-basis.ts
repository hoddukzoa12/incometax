import { HOLDING_TAX_MESSAGES } from '../messages/holding-tax'
import { TAX_RULES_BY_YEAR } from '../rules'
import type { HoldingTaxYearCalculation } from './calculation'
import { formatInlineWon, formatRate } from './format'

export const comprehensiveTableBasis = (
  calculations: readonly HoldingTaxYearCalculation[],
) => {
  const bracket = HOLDING_TAX_MESSAGES.basisList(
    calculations.map(({ year, result }) => {
      const applied = result.comprehensiveTax.appliedRate
      return HOLDING_TAX_MESSAGES.basisByYear(
        year,
        HOLDING_TAX_MESSAGES.basisBracketTax(
          formatRate(applied.rate),
          formatInlineWon(applied.progressiveDeduction),
        ),
      )
    }),
  )
  const burdenCap = HOLDING_TAX_MESSAGES.basisList(
    calculations.map(({ year }) => HOLDING_TAX_MESSAGES.basisByYear(
      year,
      year === calculations[0].year
        ? HOLDING_TAX_MESSAGES.basisCurrentYearBurdenCap
        : HOLDING_TAX_MESSAGES.basisBurdenCap,
    )),
  )
  const ruralSpecialTax = HOLDING_TAX_MESSAGES.basisList(
    calculations.map(({ year }) => HOLDING_TAX_MESSAGES.basisByYear(
      year,
      HOLDING_TAX_MESSAGES.basisRuralSpecialTax(
        formatRate(
          TAX_RULES_BY_YEAR[year].comprehensiveTax.ruralSpecialTaxRate,
        ),
      ),
    )),
  )
  return { bracket, burdenCap, ruralSpecialTax }
}
