import { TradeAreaSelect, sampleAreaOptions } from 'incometax'

/**
 * 실거래를 전용면적별로 거른다. 면적마다 거래 건수가 함께 보인다.
 * 선택만 바뀌는 변형은 정적 카드에서 구분되지 않으므로 하나만 둔다.
 */
export function Default() {
  return (
    <TradeAreaSelect
      options={sampleAreaOptions}
      selectedAreaKey={sampleAreaOptions[0].key}
      onChange={() => {}}
    />
  )
}
