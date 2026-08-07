import type { ReactNode } from 'react'
import { ComparisonTableRow } from 'incometax'

/**
 * 계산서의 한 행. `<tr>` 이라 반드시 표 안에서 쓴다 —
 * 표 밖에 두면 높이 0 으로 접힌다.
 */
const wrap = (children: ReactNode) => (
  <table className="holding-tax-table">
    <thead>
      <tr><th>항목</th><th>금액</th><th>근거</th></tr>
    </thead>
    <tbody>{children}</tbody>
  </table>
)

/** 금액 행 — 값과 그 값이 나온 근거를 나란히 놓는다. */
export function AmountRow() {
  return wrap(
    <ComparisonTableRow row={{
      label: '과세표준',
      amount: '1,006,650,000 원',
      basis: '공정시장가액비율 45% 적용',
    }} />,
  )
}

/** 용어 도움말이 붙은 행 — helpTerm 을 주면 항목 옆에 ? 가 나온다. */
export function WithHelp() {
  return wrap(
    <ComparisonTableRow row={{
      label: '공정시장가액비율',
      amount: '45%',
      basis: '공시가격과 세대 주택 수에 따른 비율',
      helpTerm: 'fairMarketValueRatio',
    }} />,
  )
}

/** 합계 행 — strong 으로 강조한다. */
export function TotalRow() {
  return wrap(
    <ComparisonTableRow row={{
      label: '보유세 총액',
      amount: '8,421,246 원',
      basis: '재산세 + 종합부동산세',
      strong: true,
    }} />,
  )
}

/** 여러 행이 이어진 실제 계산서 모습. */
export function Statement() {
  return wrap(
    <>
      <ComparisonTableRow row={{ label: '공시가격', amount: '2,237,000,000 원', basis: '입력값' }} />
      <ComparisonTableRow row={{ label: '과세표준', amount: '1,006,650,000 원', basis: '공정시장가액비율 45% 적용' }} />
      <ComparisonTableRow row={{ label: '재산세', amount: '3,396,600 원', basis: '과세표준 × 0.4% − 630,000원' }} />
      <ComparisonTableRow row={{ label: '지방교육세', amount: '679,320 원', basis: '재산세의 20%' }} />
      <ComparisonTableRow row={{ label: '합계', amount: '5,485,230 원', basis: '재산세 + 지방교육세 + 도시지역분', strong: true }} />
    </>,
  )
}
