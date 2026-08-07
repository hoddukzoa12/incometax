import { HoldingTaxChangeReasons, sampleCalculations } from 'incometax'

/**
 * "무엇 때문에 늘었나요?"에 답하는 2단계.
 * 나열한 항목의 기여액 합이 헤드라인 증감액과 일치해야 한다 — 안 맞으면 화면이 거짓말을 한다.
 * 방향은 색이 아니라 "늘리는 요인 / 줄이는 요인" 문구로 표시한다(세액 증가에 빨강 금지).
 */
export function Default() {
  return <HoldingTaxChangeReasons calculations={sampleCalculations} />
}
