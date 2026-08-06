import { HOLDING_TAX_MESSAGES } from '../messages/holding-tax'
import type { HoldingTaxComparisonYear } from './assessment-calendar'
import type { HoldingTaxYearCalculation } from './calculation'
import {
  statementRows,
  type StatementRows,
  type StatementValue,
} from './comparison-table-values'
import { formatWon } from './format'

const MISSING_INDEX = -1

const formatAmount = (value: StatementValue): string => value === null
  ? HOLDING_TAX_MESSAGES.totalUnavailable
  : formatWon(value)

export const totalRows = (
  calculations: readonly HoldingTaxYearCalculation[],
  selectedYear: HoldingTaxComparisonYear,
): StatementRows => {
  const selectedIndex = calculations.findIndex(
    ({ year }) => year === selectedYear,
  )
  if (selectedIndex === MISSING_INDEX) {
    throw new RangeError(HOLDING_TAX_MESSAGES.yearUnavailable(selectedYear))
  }

  const propertyTotals = calculations.map(
    ({ result }) => result.propertyTaxTotal,
  )
  const comprehensiveTotals = calculations.map(
    ({ result }) => result.comprehensiveTax.totalTax,
  )
  const holdingTotals = calculations.map(({ result }) => result.totalTax)

  return statementRows([
    {
      label: HOLDING_TAX_MESSAGES.propertyTaxTotalAll,
      basis: HOLDING_TAX_MESSAGES.basisPropertyPortfolioSum,
      values: propertyTotals,
      format: formatAmount,
    },
    {
      label: HOLDING_TAX_MESSAGES.comprehensiveTaxTotal,
      basis: HOLDING_TAX_MESSAGES.basisComprehensiveTaxSum,
      values: comprehensiveTotals,
      format: formatAmount,
    },
    {
      label: HOLDING_TAX_MESSAGES.holdingTaxTotal,
      basis: HOLDING_TAX_MESSAGES.basisHoldingTaxSum,
      values: holdingTotals,
      duplicateOf: propertyTotals,
      format: formatAmount,
      strong: true,
    },
  ], selectedIndex)
}
