import {
  HoldingTaxConditions,
  sampleConditions,
  sampleController,
} from 'incometax'

/**
 * 계산 전 조건 화면. 자동으로 채운 값을 먼저 보여 주고
 * 세액공제에 필요한 것만 고르게 한다 — 새 질문을 만들지 않는 것이 원칙이다.
 */
export function Default() {
  return (
    <HoldingTaxConditions
      conditions={sampleConditions}
      controller={sampleController}
      missingConditions={[]}
      onChange={() => {}}
      onSubmit={() => {}}
    />
  )
}
