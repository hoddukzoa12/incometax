import type {
  ComprehensiveTaxBurdenCapResult,
  ComprehensiveTaxCreditResult,
} from '../../shared/holding-tax'
import { HOLDING_TAX_MESSAGES } from '../messages/holding-tax'
import type { HoldingTaxHelpTerm } from '../messages/holding-tax'
import type { HoldingTaxYearCalculation } from './calculation'

export type TableRow = {
  readonly label: string
  readonly values: readonly string[]
  readonly basis: string
  readonly helpTerm?: HoldingTaxHelpTerm
  readonly strong?: boolean
  readonly subRow?: boolean
}

export const comparisonValues = <T,>(
  calculations: readonly HoldingTaxYearCalculation[],
  select: (calculation: HoldingTaxYearCalculation) => T,
  format: (value: T) => string,
): readonly string[] => calculations.map((calculation) =>
  format(select(calculation)))

export const creditValue = <T,>(
  result: ComprehensiveTaxCreditResult,
  select: (computed: Extract<
    ComprehensiveTaxCreditResult,
    { readonly status: 'computed' }
  >) => T,
  format: (value: T) => string,
): string => {
  if (result.status === 'notApplicable') {
    return HOLDING_TAX_MESSAGES.taxCreditNotApplicable
  }
  if (result.status === 'notComputed') {
    return HOLDING_TAX_MESSAGES.unavailable
  }
  return format(select(result))
}

export const burdenCapValue = <T,>(
  result: ComprehensiveTaxBurdenCapResult,
  select: (computed: Extract<
    ComprehensiveTaxBurdenCapResult,
    { readonly status: 'computed' }
  >) => T,
  format: (value: T) => string,
): string => {
  if (result.status === 'notApplicable') {
    return HOLDING_TAX_MESSAGES.burdenCapNotApplicable
  }
  if (result.status === 'notComputed') {
    return HOLDING_TAX_MESSAGES.unavailable
  }
  return format(select(result))
}
