import { HOLDING_TAX_MESSAGES } from '../messages/holding-tax'
import type { HoldingTaxYearCalculation } from './calculation'
import {
  burdenCapValue,
  comparisonValues,
  creditValue,
  type TableRow,
} from './comparison-table-values'
import { comprehensiveTableBasis } from './comprehensive-table-basis'
import {
  formatNullableWon,
  formatRate,
  formatWon,
} from './format'

export const comprehensiveRows = (
  calculations: readonly HoldingTaxYearCalculation[],
): readonly TableRow[] => {
  const select = (calculation: HoldingTaxYearCalculation) =>
    calculation.result.comprehensiveTax
  const creditValues = <T,>(
    pick: Parameters<typeof creditValue<T>>[1],
    format: (value: T) => string,
  ) => calculations.map(({ result }) =>
    creditValue(result.comprehensiveTax.taxCredit, pick, format))
  const capValues = <T,>(
    pick: Parameters<typeof burdenCapValue<T>>[1],
    format: (value: T) => string,
  ) => calculations.map(({ year, result }) =>
    year === calculations[0].year
      ? HOLDING_TAX_MESSAGES.unavailable
      : burdenCapValue(
          result.comprehensiveTax.taxBurdenCap,
          pick,
          format,
        ))
  const basis = comprehensiveTableBasis(calculations)

  return [
    {
      label: HOLDING_TAX_MESSAGES.ownedOfficialPriceTotal,
      basis: HOLDING_TAX_MESSAGES.basisSum,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).ownedOfficialPriceTotal,
        formatWon,
      ),
    },
    {
      label: HOLDING_TAX_MESSAGES.residentOwnedOfficialPrice,
      basis: HOLDING_TAX_MESSAGES.basisResidentPrice,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).residentOwnedOfficialPrice,
        formatWon,
      ),
    },
    {
      label: HOLDING_TAX_MESSAGES.taxableThreshold,
      basis: HOLDING_TAX_MESSAGES.basisTaxableThreshold,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).taxableThreshold,
        formatWon,
      ),
    },
    {
      label: HOLDING_TAX_MESSAGES.basicDeduction,
      basis: HOLDING_TAX_MESSAGES.basisBasicDeduction,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).basicDeduction,
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
      label: HOLDING_TAX_MESSAGES.taxableBase,
      basis: HOLDING_TAX_MESSAGES.basisComprehensiveTaxableBase,
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
      label: HOLDING_TAX_MESSAGES.baseTax,
      basis: basis.bracket,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).baseTax,
        formatWon,
      ),
    },
    {
      label: HOLDING_TAX_MESSAGES.propertyTaxCreditRatio,
      basis: HOLDING_TAX_MESSAGES.basisFairMarketValueRatio,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).propertyTaxFairMarketValueRatio,
        formatRate,
      ),
    },
    {
      label: HOLDING_TAX_MESSAGES.propertyTaxCredit,
      basis: HOLDING_TAX_MESSAGES.basisPropertyTaxCredit,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).propertyTaxCredit,
        formatWon,
      ),
    },
    {
      label: HOLDING_TAX_MESSAGES.calculatedTax,
      basis: HOLDING_TAX_MESSAGES.basisCalculatedTax,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).netTax,
        formatWon,
      ),
      strong: true,
    },
    {
      label: HOLDING_TAX_MESSAGES.recognitionActualYears,
      basis: HOLDING_TAX_MESSAGES.basisResidenceRecognition,
      values: calculations.map(({ result }) => {
        const period = result.comprehensiveTax.residenceRecognition.creditPeriod
        return period === null
          ? HOLDING_TAX_MESSAGES.unavailable
          : HOLDING_TAX_MESSAGES.years(period.actualYears)
      }),
    },
    {
      label: HOLDING_TAX_MESSAGES.recognitionAddedYears,
      basis: HOLDING_TAX_MESSAGES.basisResidenceRecognition,
      values: calculations.map(({ result }) => {
        const period = result.comprehensiveTax.residenceRecognition.creditPeriod
        return period === null
          ? HOLDING_TAX_MESSAGES.unavailable
          : HOLDING_TAX_MESSAGES.years(period.recognizedYears)
      }),
    },
    {
      label: HOLDING_TAX_MESSAGES.recognitionCreditYears,
      basis: HOLDING_TAX_MESSAGES.basisResidenceRecognition,
      values: calculations.map(({ result }) => {
        const period = result.comprehensiveTax.residenceRecognition.creditPeriod
        return period === null
          ? HOLDING_TAX_MESSAGES.unavailable
          : HOLDING_TAX_MESSAGES.years(period.years)
      }),
    },
    {
      label: HOLDING_TAX_MESSAGES.ageCreditRate,
      basis: HOLDING_TAX_MESSAGES.basisCreditRate,
      values: creditValues((result) => result.ageRate, formatRate),
    },
    {
      label: HOLDING_TAX_MESSAGES.holdingCreditRate,
      basis: HOLDING_TAX_MESSAGES.basisCreditRate,
      values: creditValues((result) => result.holdingPeriodRate, formatRate),
    },
    {
      label: HOLDING_TAX_MESSAGES.residenceCreditRate,
      basis: HOLDING_TAX_MESSAGES.basisCreditRate,
      values: creditValues((result) => result.residencePeriodRate, formatRate),
    },
    {
      label: HOLDING_TAX_MESSAGES.periodCreditRate,
      basis: HOLDING_TAX_MESSAGES.basisCreditRate,
      values: creditValues((result) => result.periodRate, formatRate),
    },
    {
      label: HOLDING_TAX_MESSAGES.nominalCreditRate,
      basis: HOLDING_TAX_MESSAGES.basisCreditRate,
      values: creditValues((result) => result.nominalRate, formatRate),
    },
    {
      label: HOLDING_TAX_MESSAGES.appliedCreditRate,
      basis: HOLDING_TAX_MESSAGES.basisCreditRate,
      values: creditValues((result) => result.appliedRate, formatRate),
    },
    {
      label: HOLDING_TAX_MESSAGES.calculatedCredit,
      basis: HOLDING_TAX_MESSAGES.basisCreditAmount,
      values: creditValues((result) => result.calculatedAmount, formatWon),
    },
    {
      label: HOLDING_TAX_MESSAGES.creditAmountCap,
      basis: HOLDING_TAX_MESSAGES.basisCreditAmount,
      values: creditValues(
        (result) => result.amountCap,
        (amountCap) => amountCap === null
          ? HOLDING_TAX_MESSAGES.noAmountCap
          : formatWon(amountCap),
      ),
    },
    {
      label: HOLDING_TAX_MESSAGES.taxCredit,
      basis: HOLDING_TAX_MESSAGES.basisCreditAmount,
      values: creditValues((result) => result.amount, formatWon),
      strong: true,
    },
    {
      label: HOLDING_TAX_MESSAGES.burdenCapRate,
      basis: basis.burdenCap,
      values: capValues((result) => result.rate, formatRate),
    },
    {
      label: HOLDING_TAX_MESSAGES.priorYearBase,
      basis: basis.burdenCap,
      values: capValues((result) => result.priorYearBase, formatWon),
    },
    {
      label: HOLDING_TAX_MESSAGES.maximumTaxBurden,
      basis: basis.burdenCap,
      values: capValues((result) => result.maximumTaxBurden, formatWon),
    },
    {
      label: HOLDING_TAX_MESSAGES.currentYearBase,
      basis: basis.burdenCap,
      values: capValues((result) => result.currentYearBase, formatWon),
    },
    {
      label: HOLDING_TAX_MESSAGES.burdenCapDeduction,
      basis: basis.burdenCap,
      values: capValues((result) => result.excessAmount, formatWon),
      strong: true,
    },
    {
      label: HOLDING_TAX_MESSAGES.payableTax,
      basis: HOLDING_TAX_MESSAGES.basisPayableTax,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).payableTax,
        (value) => formatNullableWon(value, HOLDING_TAX_MESSAGES.unavailable),
      ),
    },
    {
      label: HOLDING_TAX_MESSAGES.ruralSpecialTax,
      basis: basis.ruralSpecialTax,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).ruralSpecialTax,
        (value) => formatNullableWon(value, HOLDING_TAX_MESSAGES.unavailable),
      ),
    },
    {
      label: HOLDING_TAX_MESSAGES.comprehensiveTaxTotal,
      basis: HOLDING_TAX_MESSAGES.basisSum,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).totalTax,
        (value) => formatNullableWon(value, HOLDING_TAX_MESSAGES.unavailable),
      ),
      strong: true,
    },
  ]
}
