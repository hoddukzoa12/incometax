import { TaxTermHelp } from 'incometax'

/**
 * 법정 용어 옆에 붙는 도움말. 용어 자체는 풀어 쓰지 않고 그대로 두되,
 * ? 를 누르면 설명이 다이얼로그로 열린다(다이얼로그 왼쪽 버튼은 항상 [닫기]).
 */
const row = (label: string, term: Parameters<typeof TaxTermHelp>[0]['term']) => (
  <p style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 8px' }}>
    <span>{label}</span>
    <TaxTermHelp term={term} />
  </p>
)

/** 계산서에서 쓰이는 용어 전부. */
export function AllTerms() {
  return (
    <div>
      {row('재산세', 'propertyTax')}
      {row('종합부동산세', 'comprehensiveTax')}
      {row('과세표준', 'taxableBase')}
      {row('공정시장가액비율', 'fairMarketValueRatio')}
      {row('조정대상지역', 'adjustedArea')}
      {row('1세대1주택', 'oneHouse')}
    </div>
  )
}

/** 표 머리행에 붙은 실제 모습. */
export function InTableHeader() {
  return (
    <table className="holding-tax-table">
      <tbody>
        <tr>
          <th style={{ textAlign: 'left' }}>
            인별 종합부동산세 <TaxTermHelp term="comprehensiveTax" />
          </th>
        </tr>
      </tbody>
    </table>
  )
}
