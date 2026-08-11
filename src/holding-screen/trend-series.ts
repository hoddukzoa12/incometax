import type { HoldingTaxResult } from '../../shared/holding-tax'
import type {
  HoldingTaxPriorYearCalculation,
  HoldingTaxYearCalculation,
} from './calculation'

const ZERO_AMOUNT = 0

/**
 * 막대 하나가 한 해다.
 *
 * `basis` 는 공시가격의 출처다 — 고시된 값으로 계산했는지, 상승률을 곱해
 * 만든 값인지. 시안은 이 둘을 실선과 빗금으로 나눈다. 화면에서 구분하지 않으면
 * 추정치가 고시값처럼 읽힌다.
 */
export interface HoldingTaxTrendPoint {
  readonly year: number
  readonly basis: 'published' | 'projected'
  /** 재산세 + 종부세. 종부세가 아직 확정 못 한 해는 null 이다. */
  readonly totalTax: number | null
  readonly propertyTax: number
  readonly comprehensiveTax: number | null
  /** 세부담상한으로 깎인 금액. 상한이 안 걸렸으면 0 이다. */
  readonly burdenCapRelief: number
  readonly officialPriceTotal: number
}

const officialPriceTotal = (result: HoldingTaxResult): number =>
  result.propertyTaxes.reduce(
    (total, propertyTax) => total + propertyTax.fullOfficialPrice,
    ZERO_AMOUNT,
  )

const burdenCapRelief = (result: HoldingTaxResult): number => {
  const cap = result.comprehensiveTax.taxBurdenCap
  return cap.status === 'computed' ? cap.excessAmount : ZERO_AMOUNT
}

const toPoint = (
  year: number,
  basis: HoldingTaxTrendPoint['basis'],
  result: HoldingTaxResult,
): HoldingTaxTrendPoint => ({
  year,
  basis,
  totalTax: result.totalTax,
  propertyTax: result.propertyTaxTotal,
  comprehensiveTax: result.comprehensiveTax.totalTax,
  burdenCapRelief: burdenCapRelief(result),
  officialPriceTotal: officialPriceTotal(result),
})

/**
 * 직전 연도는 고시된 공시가격으로 계산하므로 `published` 다.
 * 비교 연도의 첫 해도 고시값을 그대로 쓴다 — 상승률은 그 다음 해부터 곱해진다
 * (`calculation.ts` 의 `projectedOfficialPrice`).
 */
export const buildHoldingTaxTrend = (
  calculations: readonly HoldingTaxYearCalculation[],
  priorYearCalculation: HoldingTaxPriorYearCalculation | undefined,
): readonly HoldingTaxTrendPoint[] => {
  const [firstYear] = calculations
  const points = calculations.map(({ year, result }) =>
    toPoint(
      year,
      firstYear !== undefined && year === firstYear.year
        ? 'published'
        : 'projected',
      result,
    ))
  if (priorYearCalculation === undefined) return points
  return [
    toPoint(
      priorYearCalculation.year,
      'published',
      priorYearCalculation.result,
    ),
    ...points,
  ]
}
