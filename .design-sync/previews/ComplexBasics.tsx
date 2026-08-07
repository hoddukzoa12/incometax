import { ComplexBasics, sampleComplex } from 'incometax'

/** 단지 상세 머리 — 지번·사용승인일·동 수·세대 수. */
export function Default() {
  return <ComplexBasics complex={sampleComplex} />
}

/** 자식을 받아 아래에 덧붙일 수 있다 — 사이드바가 탭을 이렇게 붙인다. */
export function WithChildren() {
  return (
    <ComplexBasics complex={sampleComplex}>
      <p style={{ margin: '8px 0 0', fontSize: 12 }}>공시가격 · 최근 실거래가</p>
    </ComplexBasics>
  )
}

/** 정보가 비어 있는 단지 — 적재 원천이 값을 주지 않은 경우다. */
export function Sparse() {
  return (
    <ComplexBasics
      complex={{
        ...sampleComplex,
        approvalDate: null, buildingCount: null, householdCount: null,
        roadAddress: null,
      }}
    />
  )
}
