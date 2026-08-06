import { HOLDING_TAX_MESSAGES } from '../messages/holding-tax'
import { TAX_RULES_BY_YEAR } from '../rules'
import type { HoldingTaxYearCalculation } from './calculation'
import { comparisonValues, type TableRow } from './comparison-table-values'
import {
  formatInlineWon,
  formatRate,
  formatWon,
} from './format'

export const propertyRows = (
  calculations: readonly HoldingTaxYearCalculation[],
  itemIndex: number,
): readonly TableRow[] => {
  const select = (calculation: HoldingTaxYearCalculation) =>
    calculation.result.propertyTaxes[itemIndex]
  const first = select(calculations[0])
  const propertyRules = TAX_RULES_BY_YEAR[calculations[0].year].propertyTax
  const bracketBasis = HOLDING_TAX_MESSAGES.basisList(
    calculations.map((calculation) => {
      const applied = select(calculation).appliedRate
      return HOLDING_TAX_MESSAGES.basisByYear(
        calculation.year,
        HOLDING_TAX_MESSAGES.basisBracketTax(
          formatRate(applied.rate),
          formatInlineWon(applied.progressiveDeduction),
        ),
      )
    }),
  )
  const preferentialBasis = first.preferentialRateApplied
    ? HOLDING_TAX_MESSAGES.basisPreferentialApplied
    : first.fullOfficialPrice >
        propertyRules.preferentialRateMaximumOfficialPrice
      ? HOLDING_TAX_MESSAGES.basisPreferentialNotApplied(
          formatInlineWon(
            propertyRules.preferentialRateMaximumOfficialPrice,
          ),
        )
      : HOLDING_TAX_MESSAGES.basisPreferentialHouseholdNotApplied
  return [
    {
      label: HOLDING_TAX_MESSAGES.officialPrice,
      basis: HOLDING_TAX_MESSAGES.basisOfficialPrice,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).fullOfficialPrice,
        formatWon,
      ),
    },
    {
      label: HOLDING_TAX_MESSAGES.ownershipShare,
      basis: HOLDING_TAX_MESSAGES.basisOwnershipShare,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).ownershipShare,
        formatRate,
      ),
    },
    {
      label: HOLDING_TAX_MESSAGES.ownedOfficialPrice,
      basis: HOLDING_TAX_MESSAGES.basisOwnedOfficialPrice,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).ownedOfficialPrice,
        formatWon,
      ),
    },
    {
      label: HOLDING_TAX_MESSAGES.fairMarketValueRatio,
      basis: HOLDING_TAX_MESSAGES.basisFairMarketValueRatio,
      helpTerm: 'fairMarketValueRatio',
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).fairMarketValueRatio,
        formatRate,
      ),
    },
    {
      label: HOLDING_TAX_MESSAGES.fullTaxableBase,
      basis: HOLDING_TAX_MESSAGES.basisFullTaxableBase,
      helpTerm: 'taxableBase',
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).fullTaxableBase,
        formatWon,
      ),
    },
    {
      label: HOLDING_TAX_MESSAGES.taxableBase,
      basis: HOLDING_TAX_MESSAGES.basisOwnedTaxableBase,
      helpTerm: 'taxableBase',
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).taxableBase,
        formatWon,
      ),
    },
    {
      label: HOLDING_TAX_MESSAGES.appliedRate,
      basis: HOLDING_TAX_MESSAGES.basisAppliedRate,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).appliedRate.rate,
        formatRate,
      ),
    },
    {
      label: HOLDING_TAX_MESSAGES.progressiveDeduction,
      basis: HOLDING_TAX_MESSAGES.basisProgressiveDeduction,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).appliedRate.progressiveDeduction,
        formatWon,
      ),
    },
    {
      label: HOLDING_TAX_MESSAGES.preferentialRate,
      basis: preferentialBasis,
      helpTerm: 'oneHouse',
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).preferentialRateApplied,
        (applied) => applied
          ? HOLDING_TAX_MESSAGES.applied
          : HOLDING_TAX_MESSAGES.notApplied,
      ),
    },
    {
      label: HOLDING_TAX_MESSAGES.fullBaseTax,
      basis: bracketBasis,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).fullBaseTax,
        formatWon,
      ),
      subRow: true,
    },
    {
      label: HOLDING_TAX_MESSAGES.baseTax,
      basis: HOLDING_TAX_MESSAGES.basisOwnedBaseTax,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).baseTax,
        formatWon,
      ),
      subRow: true,
    },
    {
      label: HOLDING_TAX_MESSAGES.localEducationTax,
      basis: HOLDING_TAX_MESSAGES.basisLocalEducationTax(
        formatRate(propertyRules.surtaxes.localEducation.rate),
      ),
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).localEducationTax,
        formatWon,
      ),
      subRow: true,
    },
    {
      label: HOLDING_TAX_MESSAGES.cityAreaTax,
      basis: HOLDING_TAX_MESSAGES.basisCityAreaTax(
        formatRate(propertyRules.surtaxes.cityArea.rate),
      ),
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).cityAreaTax,
        formatWon,
      ),
      subRow: true,
    },
    {
      label: HOLDING_TAX_MESSAGES.propertyTaxTotal,
      basis: HOLDING_TAX_MESSAGES.basisSum,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).totalTax,
        formatWon,
      ),
      strong: true,
    },
  ]
}
