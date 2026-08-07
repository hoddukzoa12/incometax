import { formatInlineWon } from '../format/won'
import { HOLDING_TAX_MESSAGES } from '../messages/holding-tax'
import { roundTaxAmount, TAX_RULES_BY_YEAR } from '../rules'
import { HOLDING_TAX_DEFAULT_YEAR } from './assessment-calendar'
import type { HoldingTaxYearCalculation } from './calculation'

export type HoldingTaxChangeRow = {
  readonly key: string
  readonly label: string
  readonly fromYear: number
  readonly toYear: number
  readonly fromValue: string
  readonly toValue: string
  readonly contribution: number
}

const ZERO_AMOUNT = 0

const burdenCapTotalDeduction = (
  calculation: HoldingTaxYearCalculation,
): number | null => {
  const comprehensive = calculation.result.comprehensiveTax
  if (
    comprehensive.taxBurdenCap.excessAmount === ZERO_AMOUNT
  ) return ZERO_AMOUNT
  if (
    comprehensive.taxCredit.amount === null ||
    comprehensive.payableTax === null ||
    comprehensive.ruralSpecialTax === null
  ) return null

  const payableWithoutCap = roundTaxAmount(Math.max(
    ZERO_AMOUNT,
    comprehensive.netTax - comprehensive.taxCredit.amount,
  ))
  const ruralSpecialTaxWithoutCap = roundTaxAmount(
    payableWithoutCap *
      TAX_RULES_BY_YEAR[calculation.year]
        .comprehensiveTax.ruralSpecialTaxRate,
  )
  return (
    payableWithoutCap - comprehensive.payableTax +
    ruralSpecialTaxWithoutCap - comprehensive.ruralSpecialTax
  )
}

const formatCapDeduction = (deduction: number): string =>
  deduction === ZERO_AMOUNT
    ? HOLDING_TAX_MESSAGES.burdenCapNotApplied
    : HOLDING_TAX_MESSAGES.burdenCapApplied(formatInlineWon(deduction))

const compareByAbsoluteContribution = (
  left: HoldingTaxChangeRow,
  right: HoldingTaxChangeRow,
): number => Math.abs(right.contribution) - Math.abs(left.contribution)

export const holdingTaxChangeRows = (
  calculations: readonly HoldingTaxYearCalculation[],
): readonly HoldingTaxChangeRow[] => {
  const current = calculations[0]
  const target = calculations.find(
    ({ year }) => year === HOLDING_TAX_DEFAULT_YEAR,
  )
  if (
    current === undefined ||
    target === undefined ||
    current.result.totalTax === null ||
    target.result.totalTax === null
  ) return []

  const currentCapDeduction = burdenCapTotalDeduction(current)
  const targetCapDeduction = burdenCapTotalDeduction(target)
  if (currentCapDeduction === null || targetCapDeduction === null) return []

  const capContribution = currentCapDeduction - targetCapDeduction
  const currentBeforeCap = current.result.totalTax + currentCapDeduction
  const targetBeforeCap = target.result.totalTax + targetCapDeduction
  const beforeCapContribution = targetBeforeCap - currentBeforeCap
  const rows: HoldingTaxChangeRow[] = []

  if (
    currentCapDeduction !== ZERO_AMOUNT ||
    targetCapDeduction !== ZERO_AMOUNT
  ) {
    rows.push({
      key: `${current.year}:${target.year}:burdenCap`,
      label: HOLDING_TAX_MESSAGES.burdenCapChangeReason,
      fromYear: current.year,
      toYear: target.year,
      fromValue: formatCapDeduction(currentCapDeduction),
      toValue: formatCapDeduction(targetCapDeduction),
      contribution: capContribution,
    })
  }

  if (beforeCapContribution !== ZERO_AMOUNT) {
    rows.push({
      key: `${current.year}:${target.year}:beforeBurdenCap`,
      label: HOLDING_TAX_MESSAGES.beforeBurdenCapTax,
      fromYear: current.year,
      toYear: target.year,
      fromValue: formatInlineWon(currentBeforeCap),
      toValue: formatInlineWon(targetBeforeCap),
      contribution: beforeCapContribution,
    })
  }

  return rows.sort(compareByAbsoluteContribution)
}
