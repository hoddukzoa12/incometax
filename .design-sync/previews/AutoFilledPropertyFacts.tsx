import { AutoFilledPropertyFacts, sampleController, sampleTaxedItems } from 'incometax'

/**
 * 조건 화면의 "자동으로 확인한 값" 블록.
 * 공시가격·조정대상지역·내 소유 지분을 묻지 않고 채운 뒤 고칠 때만 입력을 연다.
 */
export function Default() {
  return (
    <AutoFilledPropertyFacts controller={sampleController} item={sampleTaxedItems[0]} />
  )
}

/** 공동명의 — 지분이 100% 가 아닌 물건. */
export function JointOwnership() {
  return (
    <AutoFilledPropertyFacts
      controller={sampleController}
      item={{ ...sampleTaxedItems[0], ownershipShare: 0.5, isSoleHouseholdOwner: false }}
    />
  )
}
