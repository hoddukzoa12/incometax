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

/**
 * 세부담상한 기준액의 SSOT. 현재 문서화된 실무 엑셀 해석에 따라 재산세 본세와
 * 종부세 산출세액만 더한다. 세무사 확인 후 정의가 바뀌면 이 함수만 변경한다.
 */
const calculateTaxBurdenBase = (
  propertyBaseTax: number,
  comprehensiveCalculatedTax: number,
): number => propertyBaseTax + comprehensiveCalculatedTax

const resolvePriorYearTax = (
  priorYearTax: PriorYearHoldingTax | undefined,
):
  | {
      readonly status: 'complete'
      readonly propertyBaseTax: number
      readonly comprehensiveCalculatedTax: number
    }
  | {
      readonly status: 'missing'
      readonly missingInputs: readonly ComprehensiveTaxBurdenCapMissingInput[]
    } => {
  const propertyBaseTax = priorYearTax?.propertyBaseTax
  const comprehensiveCalculatedTax =
    priorYearTax?.comprehensiveCalculatedTax

  if (
    propertyBaseTax !== undefined &&
    comprehensiveCalculatedTax !== undefined
  ) {
    return {
      status: 'complete',
      propertyBaseTax,
      comprehensiveCalculatedTax,
    }
  }

  const missingInputs: ComprehensiveTaxBurdenCapMissingInput[] = []

  if (propertyBaseTax === undefined) {
    missingInputs.push('priorYearPropertyBaseTax')
  }
  if (comprehensiveCalculatedTax === undefined) {
    missingInputs.push('priorYearComprehensiveCalculatedTax')
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

  const priorYearTaxResolution = resolvePriorYearTax(priorYearTax)
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
    priorYearTaxResolution.comprehensiveCalculatedTax,
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
