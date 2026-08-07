// design-sync 미리보기용 표본 데이터 — 앱 소스가 아니다.
//
// 값을 손으로 적지 않는다. 실제 엔진(calculatePortfolioHoldingTax)에 실제 물건을
// 넣어 계산 결과를 만든다. 세법 룰이 바뀌면 미리보기 숫자도 같이 따라오고,
// 지어낸 숫자가 카드에 박혀 표류하는 일이 없다.
//
// 표본은 은마 1동 101호 — 공시가격 22.37억, 1세대1주택, 지분 100%.
// 브라우저 실측으로 검증된 사례라 카드에 나오는 금액이 실제 화면과 같다.

import { calculatePortfolioHoldingTax } from '../src/holding-screen/calculation'
import type { HoldingTaxConditionValues } from '../src/holding-screen/condition-values'
import { createStoredPortfolioItem } from '../src/portfolio/state'
import type { PortfolioItemSeed } from '../shared/portfolio'

const EUNMA_SEED: PortfolioItemSeed = {
  assetKind: 'apartment',
  complexId: 'A13583507',
  legalDongCode: '1168010600',
  complexName: '은마',
  address: '서울특별시 강남구 삼성로 212',
  dong: '1',
  ho: '101',
  exclusiveArea: 76.79,
  officialPrice: 2_237_000_000,
  officialPriceBaseDate: '2026-01-01',
  priorOfficialPrices: [{ baseDate: '2025-01-01', price: 1_708_000_000 }],
}

export const sampleTaxedItems = [{
  ...createStoredPortfolioItem(EUNMA_SEED, 'A13583507'),
  residency: 'residing' as const,
}]

export const sampleConditions: HoldingTaxConditionValues = {
  ownerAge: 0,
  annualOfficialPriceGrowthRate: 0,
  items: {
    A13583507: {
      holdingYears: 0,
      residenceYears: 0,
      continuesResidence: true,
      qualifyingRelocation: null,
    },
  },
}

/** 엔진 결과 전체. 성공 상태는 'calculated' 다. */
export const sampleComparison =
  calculatePortfolioHoldingTax(sampleTaxedItems, sampleConditions)

/** 세 개년(2026·2027·2028) 계산 결과. */
export const sampleCalculations =
  sampleComparison.status === 'calculated' ? sampleComparison.calculations : []

/**
 * 미리보기용 컨트롤러. 정적 카드라 변경 함수는 no-op 이다 —
 * 카드는 "이 컴포넌트가 어떻게 보이는가"를 보여 주지 상태를 굴리지 않는다.
 */
export const sampleController = {
  items: sampleTaxedItems,
  add: () => {},
  remove: () => {},
  setOwnershipShare: () => {},
  update: () => {},
}

/** 은마 단지 레코드 — 사이드바 상세가 읽는 형태 그대로. */
export const sampleComplex = {
  complexId: 'A13583507',
  name: '은마',
  legalAddress: '서울 강남구 대치동 316',
  roadAddress: '서울 강남구 삼성로 212',
  legalDongCode: '1168010600',
  approvalDate: '1979-08-30',
  buildingCount: 28,
  householdCount: 4424,
  lat: 37.49741836284779,
  lng: 127.06532735974666,
  lookupStatus: 'matched' as const,
  backfillReason: null,
}

/** 실거래 표본 — 전용 76.79㎡ 와 84.43㎡ 두 면적이 섞인 실제 형태. */
export const sampleTrades = [
  { tradeId: 't1', source: 'apt' as const, matchLevel: 'lot' as const,
    dealDate: '2026-06-14', dealAmount: 2_950_000_000, exclusiveArea: 76.79, floor: 7 },
  { tradeId: 't2', source: 'apt' as const, matchLevel: 'lot' as const,
    dealDate: '2026-05-02', dealAmount: 2_880_000_000, exclusiveArea: 76.79, floor: 12 },
  { tradeId: 't3', source: 'apt' as const, matchLevel: 'lot' as const,
    dealDate: '2026-03-21', dealAmount: 3_400_000_000, exclusiveArea: 84.43, floor: 3 },
  { tradeId: 't4', source: 'apt' as const, matchLevel: 'candidate' as const,
    dealDate: '2025-11-08', dealAmount: 2_640_000_000, exclusiveArea: 76.79, floor: null },
]

/** 면적 선택지 — 실거래에서 뽑아낸 형태. */
export const sampleAreaOptions = [
  { key: '76.79', area: 76.79, count: 3 },
  { key: '84.43', area: 84.43, count: 1 },
]
