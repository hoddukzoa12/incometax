import type {
  ComprehensiveTaxBurdenCapMissingInput,
  ComprehensiveTaxBurdenCapResult,
  PriorYearHoldingTax,
} from '../../shared/holding-tax'
import type {
  ComprehensiveTaxBurdenCapRules,
} from '../../shared/tax-rules'
import { roundTaxAmount } from '../rules'

const ZERO_AMOUNT = 0

/** 세부담상한 기준액 — holding-tax-v3-spec.md §3.11. */
const calculateTaxBurdenBase = (
  propertyBaseTax: number,
  comprehensiveTax: number,
): number => propertyBaseTax + comprehensiveTax

const PRIOR_COMPREHENSIVE_TAX_MISSING_INPUT = {
  afterCreditBeforeBurdenCap:
    'priorYearComprehensiveTaxAfterCreditBeforeBurdenCap',
} as const satisfies Readonly<
  Record<
    ComprehensiveTaxBurdenCapRules['priorComprehensiveTaxKind'],
    ComprehensiveTaxBurdenCapMissingInput
  >
>

const resolvePriorYearTax = (
  priorYearTax: PriorYearHoldingTax | undefined,
  priorComprehensiveTaxKind:
    ComprehensiveTaxBurdenCapRules['priorComprehensiveTaxKind'],
):
  | {
      readonly status: 'complete'
      readonly propertyBaseTax: number
      readonly comprehensiveTax: number
    }
  | {
      readonly status: 'missing'
      readonly missingInputs: readonly ComprehensiveTaxBurdenCapMissingInput[]
    } => {
  const propertyBaseTax = priorYearTax?.propertyBaseTax
  const priorComprehensiveTaxes = {
    afterCreditBeforeBurdenCap:
      priorYearTax?.comprehensiveTaxAfterCreditBeforeBurdenCap,
  } as const
  const comprehensiveTax =
    priorComprehensiveTaxes[priorComprehensiveTaxKind]

  if (
    propertyBaseTax !== undefined &&
    comprehensiveTax !== undefined
  ) {
    return {
      status: 'complete',
      propertyBaseTax,
      comprehensiveTax,
    }
  }

  const missingInputs: ComprehensiveTaxBurdenCapMissingInput[] = []

  if (propertyBaseTax === undefined) {
    missingInputs.push('priorYearPropertyBaseTax')
  }
  if (comprehensiveTax === undefined) {
    missingInputs.push(
      PRIOR_COMPREHENSIVE_TAX_MISSING_INPUT[priorComprehensiveTaxKind],
    )
  }

  return { status: 'missing', missingInputs }
}

export const calculateComprehensiveTaxBurdenCap = (
  currentPropertyBaseTax: number,
  currentComprehensiveCalculatedTax: number,
  priorYearTax: PriorYearHoldingTax | undefined,
  rules: ComprehensiveTaxBurdenCapRules,
): ComprehensiveTaxBurdenCapResult => {
  if (currentComprehensiveCalculatedTax <= ZERO_AMOUNT) {
    return {
      status: 'notApplicable',
      reason: 'noComprehensiveTax',
      excessAmount: ZERO_AMOUNT,
    }
  }

  const priorYearTaxResolution = resolvePriorYearTax(
    priorYearTax,
    rules.priorComprehensiveTaxKind,
  )
  if (priorYearTaxResolution.status === 'missing') {
    return {
      status: 'notComputed',
      rate: rules.rate,
      missingInputs: priorYearTaxResolution.missingInputs,
      excessAmount: ZERO_AMOUNT,
    }
  }

  const priorYearBase = calculateTaxBurdenBase(
    priorYearTaxResolution.propertyBaseTax,
    priorYearTaxResolution.comprehensiveTax,
  )
  const currentYearBase = calculateTaxBurdenBase(
    currentPropertyBaseTax,
    currentComprehensiveCalculatedTax,
  )
  const maximumTaxBurden = priorYearBase * rules.rate
  const excessAmount = Math.max(
    ZERO_AMOUNT,
    currentYearBase - maximumTaxBurden,
  )

  return {
    status: 'computed',
    rate: rules.rate,
    priorYearBase: roundTaxAmount(priorYearBase),
    maximumTaxBurden: roundTaxAmount(maximumTaxBurden),
    currentYearBase: roundTaxAmount(currentYearBase),
    excessAmount: roundTaxAmount(excessAmount),
  }
}
