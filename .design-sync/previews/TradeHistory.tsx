import { TradeHistory, sampleTrades } from 'incometax'

/** 최근 실거래 목록 — 전용 76.79㎡ 로 거른 결과. */
export function Default() {
  return <TradeHistory trades={sampleTrades} areaKey="76.79" />
}

/** 해당 면적의 거래가 없는 경우. */
export function Empty() {
  return <TradeHistory trades={[]} areaKey="59.98" />
}
