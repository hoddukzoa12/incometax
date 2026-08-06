import type {
  ComprehensiveTaxBurdenCapResult,
  ComprehensiveTaxCreditResult,
} from '../../shared/holding-tax'
import { HOLDING_TAX_MESSAGES } from '../messages/holding-tax'
import { TAX_RULES_BY_YEAR } from '../rules'
import {
  HOLDING_TAX_COMPARISON_YEARS,
  type HoldingTaxComparisonYear,
} from './assessment-calendar'
import type { HoldingTaxYearCalculation } from './calculation'
import {
  statementRows,
  type StatementRows,
  type StatementValue,
} from './comparison-table-values'
import {
  formatDeductionWon,
  formatInlineWon,
  formatRate,
  formatWon,
} from './format'

const MISSING_INDEX = -1
const ZERO_AMOUNT = 0
const ONE_YEAR = 1

type BurdenCapBasisKind = 'modeled' | 'observed' | 'unavailable'

const OBSERVED_BURDEN_CAP_YEAR = HOLDING_TAX_COMPARISON_YEARS[0]

const burdenCapBasisKind = (
  calculation: HoldingTaxYearCalculation,
): BurdenCapBasisKind => {
  const capResult = calculation.result.comprehensiveTax.taxBurdenCap
  if (capResult.status === 'notComputed') return 'unavailable'
  return calculation.year === OBSERVED_BURDEN_CAP_YEAR
    ? 'observed'
    : 'modeled'
}

const burdenCapBasis = (
  calculation: HoldingTaxYearCalculation,
): string => {
  const messages: Readonly<Record<BurdenCapBasisKind, string>> = {
    observed: HOLDING_TAX_MESSAGES.basisBurdenCap.observed(
      calculation.year - ONE_YEAR,
    ),
    modeled: HOLDING_TAX_MESSAGES.basisBurdenCap.modeled,
    unavailable: HOLDING_TAX_MESSAGES.basisBurdenCap.unavailable,
  }
  return messages[burdenCapBasisKind(calculation)]
}

const formatAmount = (value: StatementValue): string => value === null
  ? HOLDING_TAX_MESSAGES.unavailable
  : formatWon(value)

const formatDeduction = (value: StatementValue): string => value === null
  ? HOLDING_TAX_MESSAGES.unavailable
  : formatDeductionWon(value)

const creditAmount = (result: ComprehensiveTaxCreditResult): StatementValue =>
  result.status === 'notComputed' ? null : result.amount

const burdenCapDeduction = (
  result: ComprehensiveTaxBurdenCapResult,
): StatementValue => result.status === 'notComputed'
  ? null
  : result.excessAmount

export const comprehensiveRows = (
  calculations: readonly HoldingTaxYearCalculation[],
  selectedYear: HoldingTaxComparisonYear,
): StatementRows => {
  const selectedIndex = calculations.findIndex(
    ({ year }) => year === selectedYear,
  )
  if (selectedIndex === MISSING_INDEX) {
    throw new RangeError(HOLDING_TAX_MESSAGES.yearUnavailable(selectedYear))
  }

  const results = calculations.map(({ result }) => result.comprehensiveTax)
  const selectedCalculation = calculations[selectedIndex]
  const selected = results[selectedIndex]
  const deductionBasis = selectedCalculation.result
    .comprehensiveTaxHouseholdKind === 'oneHouse'
    ? HOLDING_TAX_MESSAGES.basisOneHouseDeduction
    : HOLDING_TAX_MESSAGES.basisMultiHouseDeduction
  const ruralSpecialTaxRate = TAX_RULES_BY_YEAR[selectedYear]
    .comprehensiveTax.ruralSpecialTaxRate

  return statementRows([
    {
      label: HOLDING_TAX_MESSAGES.ownedOfficialPriceTotal,
      basis: HOLDING_TAX_MESSAGES.basisOwnedOfficialPriceTotal,
      values: results.map(({ ownedOfficialPriceTotal }) =>
        ownedOfficialPriceTotal),
      format: formatAmount,
    },
    {
      label: HOLDING_TAX_MESSAGES.basicDeduction,
      basis: deductionBasis,
      values: results.map(({ basicDeduction }) => basicDeduction),
      format: formatAmount,
    },
    {
      label: HOLDING_TAX_MESSAGES.comprehensiveTaxableBase,
      basis: HOLDING_TAX_MESSAGES.basisComprehensiveTaxableBaseWithRate(
        formatRate(selected.fairMarketValueRatio),
      ),
      helpTerm: 'taxableBase',
      values: results.map(({ taxableBase }) => taxableBase),
      format: formatAmount,
    },
    {
      label: HOLDING_TAX_MESSAGES.calculatedTax,
      basis: HOLDING_TAX_MESSAGES.basisBracketTax(
        formatRate(selected.appliedRate.rate),
        formatInlineWon(selected.appliedRate.progressiveDeduction),
      ),
      values: results.map(({ baseTax }) => baseTax),
      format: formatAmount,
    },
    {
      label: HOLDING_TAX_MESSAGES.propertyTaxCredit,
      basis: HOLDING_TAX_MESSAGES.basisPropertyTaxCredit,
      values: results.map(({ propertyTaxCredit }) => propertyTaxCredit),
      format: formatDeduction,
    },
    {
      label: HOLDING_TAX_MESSAGES.taxCredit,
      basis: HOLDING_TAX_MESSAGES.basisTaxCredit,
      values: results.map(({ taxCredit }) => creditAmount(taxCredit)),
      format: formatDeduction,
    },
    {
      label: HOLDING_TAX_MESSAGES.burdenCapDeduction,
      basis: burdenCapBasis(selectedCalculation),
      values: results.map(({ taxBurdenCap }) =>
        burdenCapDeduction(taxBurdenCap)),
      format: formatDeduction,
    },
    {
      label: HOLDING_TAX_MESSAGES.ruralSpecialTax,
      basis: HOLDING_TAX_MESSAGES.basisRuralSpecialTax(
        formatRate(ruralSpecialTaxRate),
      ),
      values: results.map(({ ruralSpecialTax }) =>
        ruralSpecialTax ?? ZERO_AMOUNT),
      format: formatAmount,
    },
    {
      label: HOLDING_TAX_MESSAGES.statementTotal,
      basis: HOLDING_TAX_MESSAGES.basisComprehensiveTaxSum,
      values: results.map(({ totalTax }) => totalTax),
      format: formatAmount,
      strong: true,
    },
  ], selectedIndex)
}
