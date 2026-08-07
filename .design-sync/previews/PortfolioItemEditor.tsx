import { PortfolioItemEditor, sampleTaxedItems } from 'incometax'

/** 내 부동산 목록의 한 건 — 단지·동호·전용면적·공시가격과 삭제. */
export function Default() {
  return <PortfolioItemEditor item={sampleTaxedItems[0]} onRemove={() => {}} />
}

/** 공시가격을 아직 조회하지 않은 건 — 동·호를 고르기 전 상태다. */
export function WithoutOfficialPrice() {
  return (
    <PortfolioItemEditor
      item={{ ...sampleTaxedItems[0], officialPrice: null, officialPriceBaseDate: null, dong: null, ho: null }}
      onRemove={() => {}}
    />
  )
}
