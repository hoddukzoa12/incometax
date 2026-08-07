import { useState } from 'react'
import { OfficialPriceGrowthFact, sampleTaxedItems } from 'incometax'

/**
 * 공시가격 상승률 가정. 기본값 0% 인 이유는 두 가지다 —
 * 세법 개편 효과와 시세 효과를 섞지 않기 위해서고, 우리가 상승률을 예측하면
 * 근거 없는 수치를 내세우는 것이 되기 때문이다.
 * [수정]을 열면 이 단지의 과거 실적을 사실로 보여 준다(오른 해와 내린 해를 함께).
 */
export function Default() {
  return (
    <OfficialPriceGrowthFact
      annualGrowthRate={0}
      items={sampleTaxedItems}
      onChange={() => {}}
    />
  )
}

/** 연 5% 를 가정한 상태. */
export function FivePercent() {
  return (
    <OfficialPriceGrowthFact
      annualGrowthRate={0.05}
      items={sampleTaxedItems}
      onChange={() => {}}
    />
  )
}

/** 실제 쓰임 — 값을 상태로 받는다. */
export function Interactive() {
  const [rate, setRate] = useState(0.09)
  return (
    <OfficialPriceGrowthFact
      annualGrowthRate={rate}
      items={sampleTaxedItems}
      onChange={setRate}
    />
  )
}
