import { HoldingTaxComparisonTable, sampleCalculations, sampleTaxedItems } from 'incometax'

/**
 * 3단계 계산 근거 — 항목·금액·근거 3열의 계산서.
 * 연도 탭으로 2026/2027/2028 을 오간다. 값이 3개 연도 모두 0 이거나 윗행과 같으면
 * 행을 감추므로, 49행짜리 검산표가 20행으로 줄어 있다.
 */
export function Default() {
  return (
    <HoldingTaxComparisonTable
      calculations={sampleCalculations}
      taxedItems={sampleTaxedItems}
    />
  )
}
