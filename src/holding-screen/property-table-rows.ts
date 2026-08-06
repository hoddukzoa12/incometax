import { HOLDING_TAX_MESSAGES } from '../messages/holding-tax'
import { TAX_RULES_BY_YEAR } from '../rules'
import type { HoldingTaxComparisonYear } from './assessment-calendar'
import type {
  HoldingTaxYearCalculation,
} from './calculation'
import {
  statementRows,
  type StatementRows,
  type StatementValue,
} from './comparison-table-values'
import {
  formatInlineWon,
  formatRate,
  formatWon,
} from './format'

const MISSING_INDEX = -1

const formatAmount = (value: StatementValue): string => value === null
  ? HOLDING_TAX_MESSAGES.unavailable
  : formatWon(value)

export const propertyRows = (
  calculations: readonly HoldingTaxYearCalculation[],
  itemIndex: number,
  selectedYear: HoldingTaxComparisonYear,
): StatementRows => {
  const selectedIndex = calculations.findIndex(
    ({ year }) => year === selectedYear,
  )
  if (selectedIndex === MISSING_INDEX) {
    throw new RangeError(HOLDING_TAX_MESSAGES.yearUnavailable(selectedYear))
  }

  const results = calculations.map(
    ({ result }) => result.propertyTaxes[itemIndex],
  )
  const selected = results[selectedIndex]
  const propertyRules = TAX_RULES_BY_YEAR[selectedYear].propertyTax
  const fullOfficialPrices = results.map(({ fullOfficialPrice }) =>
    fullOfficialPrice)
  const ownedOfficialPrices = results.map(({ ownedOfficialPrice }) =>
    ownedOfficialPrice)
  const fullTaxableBases = results.map(({ fullTaxableBase }) =>
    fullTaxableBase)
  const taxableBases = results.map(({ taxableBase }) => taxableBase)
  const fullBaseTaxes = results.map(({ fullBaseTax }) => fullBaseTax)
  const baseTaxes = results.map(({ baseTax }) => baseTax)
  const ownershipShare = formatRate(selected.ownershipShare)

  return statementRows([
    {
      label: HOLDING_TAX_MESSAGES.officialPrice,
      basis: HOLDING_TAX_MESSAGES.basisInputValue,
      values: fullOfficialPrices,
      format: formatAmount,
    },
    {
      label: HOLDING_TAX_MESSAGES.ownedOfficialPrice,
      basis: HOLDING_TAX_MESSAGES.basisOwnershipApplied(ownershipShare),
      values: ownedOfficialPrices,
      duplicateOf: fullOfficialPrices,
      format: formatAmount,
    },
    {
      label: HOLDING_TAX_MESSAGES.fullTaxableBase,
      basis: HOLDING_TAX_MESSAGES.basisRatioApplied(
        formatRate(selected.fairMarketValueRatio),
      ),
      helpTerm: 'taxableBase',
      values: fullTaxableBases,
      format: formatAmount,
    },
    {
      label: HOLDING_TAX_MESSAGES.taxableBase,
      basis: HOLDING_TAX_MESSAGES.basisTaxableBaseOwnershipApplied(
        ownershipShare,
      ),
      helpTerm: 'taxableBase',
      values: taxableBases,
      duplicateOf: fullTaxableBases,
      format: formatAmount,
    },
    {
      label: HOLDING_TAX_MESSAGES.propertyBaseTax,
      basis: HOLDING_TAX_MESSAGES.basisBracketTax(
        formatRate(selected.appliedRate.rate),
        formatInlineWon(selected.appliedRate.progressiveDeduction),
      ),
      values: fullBaseTaxes,
      format: formatAmount,
    },
    {
      label: HOLDING_TAX_MESSAGES.propertyOwnedBaseTax,
      basis: HOLDING_TAX_MESSAGES.basisPropertyOwnershipApplied(
        ownershipShare,
      ),
      values: baseTaxes,
      duplicateOf: fullBaseTaxes,
      format: formatAmount,
    },
    {
      label: HOLDING_TAX_MESSAGES.localEducationTax,
      basis: HOLDING_TAX_MESSAGES.basisLocalEducationTax(
        formatRate(propertyRules.surtaxes.localEducation.rate),
      ),
      values: results.map(({ localEducationTax }) => localEducationTax),
      format: formatAmount,
    },
    {
      label: HOLDING_TAX_MESSAGES.cityAreaTax,
      basis: HOLDING_TAX_MESSAGES.basisCityAreaTax(
        formatRate(propertyRules.surtaxes.cityArea.rate),
      ),
      values: results.map(({ cityAreaTax }) => cityAreaTax),
      format: formatAmount,
    },
    {
      label: HOLDING_TAX_MESSAGES.statementTotal,
      basis: HOLDING_TAX_MESSAGES.basisPropertyTaxSum,
      values: results.map(({ totalTax }) => totalTax),
      format: formatAmount,
      strong: true,
    },
  ], selectedIndex)
}
