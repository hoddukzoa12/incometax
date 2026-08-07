import {
  HoldingTaxResultSummary,
  sampleCalculations,
  sampleTaxedItems,
} from 'incometax'

/**
 * 결과 화면 1단계 — 이 제품이 답해야 할 숫자가 여기 있다.
 * 은마 1동 101호(공시가격 22.37억, 1세대1주택, 지분 100%)를 실제 엔진으로 계산한 값이다.
 */
export function Default() {
  return (
    <HoldingTaxResultSummary
      calculations={sampleCalculations}
      taxedItems={sampleTaxedItems}
      detailsOpen={false}
      reasonsOpen={false}
      onDetailsToggle={() => {}}
      onReasonsToggle={() => {}}
    />
  )
}

/** 변경 이유를 펼친 상태 — "무엇 때문에 늘었나"에 답하는 단계. */
export function ReasonsOpen() {
  return (
    <HoldingTaxResultSummary
      calculations={sampleCalculations}
      taxedItems={sampleTaxedItems}
      detailsOpen={false}
      reasonsOpen
      onDetailsToggle={() => {}}
      onReasonsToggle={() => {}}
    />
  )
}
