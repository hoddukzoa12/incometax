import { HOLDING_TAX_MESSAGES } from '../messages/holding-tax'
import type { HoldingTaxYearCalculation } from './calculation'
import { comparisonValues, type TableRow } from './comparison-table-values'
import { formatRate, formatWon } from './format'

export const propertyRows = (
  calculations: readonly HoldingTaxYearCalculation[],
  itemIndex: number,
): readonly TableRow[] => {
  const select = (calculation: HoldingTaxYearCalculation) =>
    calculation.result.propertyTaxes[itemIndex]
  return [
    {
      label: HOLDING_TAX_MESSAGES.officialPrice,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).fullOfficialPrice,
        formatWon,
      ),
    },
    {
      label: HOLDING_TAX_MESSAGES.ownershipShare,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).ownershipShare,
        formatRate,
      ),
    },
    {
      label: HOLDING_TAX_MESSAGES.ownedOfficialPrice,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).ownedOfficialPrice,
        formatWon,
      ),
    },
    {
      label: HOLDING_TAX_MESSAGES.fairMarketValueRatio,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).fairMarketValueRatio,
        formatRate,
      ),
    },
    {
      label: HOLDING_TAX_MESSAGES.fullTaxableBase,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).fullTaxableBase,
        formatWon,
      ),
    },
    {
      label: HOLDING_TAX_MESSAGES.taxableBase,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).taxableBase,
        formatWon,
      ),
    },
    {
      label: HOLDING_TAX_MESSAGES.appliedRate,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).appliedRate.rate,
        formatRate,
      ),
    },
    {
      label: HOLDING_TAX_MESSAGES.progressiveDeduction,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).appliedRate.progressiveDeduction,
        formatWon,
      ),
    },
    {
      label: HOLDING_TAX_MESSAGES.fullBaseTax,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).fullBaseTax,
        formatWon,
      ),
      subRow: true,
    },
    {
      label: HOLDING_TAX_MESSAGES.baseTax,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).baseTax,
        formatWon,
      ),
      subRow: true,
    },
    {
      label: HOLDING_TAX_MESSAGES.localEducationTax,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).localEducationTax,
        formatWon,
      ),
      subRow: true,
    },
    {
      label: HOLDING_TAX_MESSAGES.cityAreaTax,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).cityAreaTax,
        formatWon,
      ),
      subRow: true,
    },
    {
      label: HOLDING_TAX_MESSAGES.propertyTaxTotal,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).totalTax,
        formatWon,
      ),
      strong: true,
    },
  ]
}
