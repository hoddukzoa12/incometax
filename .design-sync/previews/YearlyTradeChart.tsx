import { YearlyTradeChart, sampleTrades } from 'incometax'

/** 연도별 평균 실거래가 추이. */
export function Default() {
  return <YearlyTradeChart trades={sampleTrades} areaLabel="76.79㎡" />
}
