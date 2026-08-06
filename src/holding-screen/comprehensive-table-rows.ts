import { HOLDING_TAX_MESSAGES } from '../messages/holding-tax'
import type { HoldingTaxYearCalculation } from './calculation'
import {
  burdenCapValue,
  comparisonValues,
  creditValue,
  type TableRow,
} from './comparison-table-values'
import { formatNullableWon, formatRate, formatWon } from './format'

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
  ) => calculations.map(({ result }) =>
    burdenCapValue(result.comprehensiveTax.taxBurdenCap, pick, format))

  return [
    {
      label: HOLDING_TAX_MESSAGES.ownedOfficialPriceTotal,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).ownedOfficialPriceTotal,
        formatWon,
      ),
    },
    {
      label: HOLDING_TAX_MESSAGES.residentOwnedOfficialPrice,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).residentOwnedOfficialPrice,
        formatWon,
      ),
    },
    {
      label: HOLDING_TAX_MESSAGES.taxableThreshold,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).taxableThreshold,
        formatWon,
      ),
    },
    {
      label: HOLDING_TAX_MESSAGES.basicDeduction,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).basicDeduction,
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
      label: HOLDING_TAX_MESSAGES.baseTax,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).baseTax,
        formatWon,
      ),
    },
    {
      label: HOLDING_TAX_MESSAGES.propertyTaxCreditRatio,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).propertyTaxFairMarketValueRatio,
        formatRate,
      ),
    },
    {
      label: HOLDING_TAX_MESSAGES.propertyTaxCredit,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).propertyTaxCredit,
        formatWon,
      ),
    },
    {
      label: HOLDING_TAX_MESSAGES.calculatedTax,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).netTax,
        formatWon,
      ),
      strong: true,
    },
    {
      label: HOLDING_TAX_MESSAGES.recognitionActualYears,
      values: calculations.map(({ result }) => {
        const period = result.comprehensiveTax.residenceRecognition.creditPeriod
        return period === null
          ? HOLDING_TAX_MESSAGES.unavailable
          : HOLDING_TAX_MESSAGES.years(period.actualYears)
      }),
    },
    {
      label: HOLDING_TAX_MESSAGES.recognitionAddedYears,
      values: calculations.map(({ result }) => {
        const period = result.comprehensiveTax.residenceRecognition.creditPeriod
        return period === null
          ? HOLDING_TAX_MESSAGES.unavailable
          : HOLDING_TAX_MESSAGES.years(period.recognizedYears)
      }),
    },
    {
      label: HOLDING_TAX_MESSAGES.recognitionCreditYears,
      values: calculations.map(({ result }) => {
        const period = result.comprehensiveTax.residenceRecognition.creditPeriod
        return period === null
          ? HOLDING_TAX_MESSAGES.unavailable
          : HOLDING_TAX_MESSAGES.years(period.years)
      }),
    },
    {
      label: HOLDING_TAX_MESSAGES.ageCreditRate,
      values: creditValues((result) => result.ageRate, formatRate),
    },
    {
      label: HOLDING_TAX_MESSAGES.holdingCreditRate,
      values: creditValues((result) => result.holdingPeriodRate, formatRate),
    },
    {
      label: HOLDING_TAX_MESSAGES.residenceCreditRate,
      values: creditValues((result) => result.residencePeriodRate, formatRate),
    },
    {
      label: HOLDING_TAX_MESSAGES.periodCreditRate,
      values: creditValues((result) => result.periodRate, formatRate),
    },
    {
      label: HOLDING_TAX_MESSAGES.nominalCreditRate,
      values: creditValues((result) => result.nominalRate, formatRate),
    },
    {
      label: HOLDING_TAX_MESSAGES.appliedCreditRate,
      values: creditValues((result) => result.appliedRate, formatRate),
    },
    {
      label: HOLDING_TAX_MESSAGES.calculatedCredit,
      values: creditValues((result) => result.calculatedAmount, formatWon),
    },
    {
      label: HOLDING_TAX_MESSAGES.creditAmountCap,
      values: creditValues(
        (result) => result.amountCap,
        (amountCap) => amountCap === null
          ? HOLDING_TAX_MESSAGES.noAmountCap
          : formatWon(amountCap),
      ),
    },
    {
      label: HOLDING_TAX_MESSAGES.taxCredit,
      values: creditValues((result) => result.amount, formatWon),
      strong: true,
    },
    {
      label: HOLDING_TAX_MESSAGES.burdenCapRate,
      values: capValues((result) => result.rate, formatRate),
    },
    {
      label: HOLDING_TAX_MESSAGES.priorYearBase,
      values: capValues((result) => result.priorYearBase, formatWon),
    },
    {
      label: HOLDING_TAX_MESSAGES.maximumTaxBurden,
      values: capValues((result) => result.maximumTaxBurden, formatWon),
    },
    {
      label: HOLDING_TAX_MESSAGES.currentYearBase,
      values: capValues((result) => result.currentYearBase, formatWon),
    },
    {
      label: HOLDING_TAX_MESSAGES.burdenCapDeduction,
      values: capValues((result) => result.excessAmount, formatWon),
      strong: true,
    },
    {
      label: HOLDING_TAX_MESSAGES.payableTax,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).payableTax,
        (value) => formatNullableWon(value, HOLDING_TAX_MESSAGES.unavailable),
      ),
    },
    {
      label: HOLDING_TAX_MESSAGES.ruralSpecialTax,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).ruralSpecialTax,
        (value) => formatNullableWon(value, HOLDING_TAX_MESSAGES.unavailable),
      ),
    },
    {
      label: HOLDING_TAX_MESSAGES.comprehensiveTaxTotal,
      values: comparisonValues(
        calculations,
        (calculation) => select(calculation).totalTax,
        (value) => formatNullableWon(value, HOLDING_TAX_MESSAGES.unavailable),
      ),
      strong: true,
    },
  ]
}
