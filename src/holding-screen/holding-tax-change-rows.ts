import { HOLDING_TAX_MESSAGES } from '../messages/holding-tax'
import type { HoldingTaxYearCalculation } from './calculation'
import { formatInlineWon, formatRate } from './format'

export type HoldingTaxChangeRow = {
  readonly key: string
  readonly label: string
  readonly fromYear: number
  readonly toYear: number
  readonly fromValue: string
  readonly toValue: string
}

type ChangeDefinition = {
  readonly key: string
  readonly label: string
  readonly select: (calculation: HoldingTaxYearCalculation) => number
  readonly format: (value: number) => string
}

const CHANGE_DEFINITIONS: readonly ChangeDefinition[] = [
  {
    key: 'basicDeduction',
    label: HOLDING_TAX_MESSAGES.basicDeduction,
    select: ({ result }) => result.comprehensiveTax.basicDeduction,
    format: formatInlineWon,
  },
  {
    key: 'fairMarketValueRatio',
    label: HOLDING_TAX_MESSAGES.fairMarketValueRatio,
    select: ({ result }) => result.comprehensiveTax.fairMarketValueRatio,
    format: formatRate,
  },
  {
    key: 'appliedRate',
    label: HOLDING_TAX_MESSAGES.appliedRate,
    select: ({ result }) => result.comprehensiveTax.appliedRate.rate,
    format: formatRate,
  },
]

export const holdingTaxChangeRows = (
  calculations: readonly HoldingTaxYearCalculation[],
): readonly HoldingTaxChangeRow[] => calculations.slice(1).flatMap(
  (current, transitionIndex) => {
    const previous = calculations[transitionIndex]
    return CHANGE_DEFINITIONS.flatMap((definition) => {
      const from = definition.select(previous)
      const to = definition.select(current)
      if (from === to) return []
      return [{
        key: `${previous.year}:${current.year}:${definition.key}`,
        label: definition.label,
        fromYear: previous.year,
        toYear: current.year,
        fromValue: definition.format(from),
        toValue: definition.format(to),
      }]
    })
  },
)
