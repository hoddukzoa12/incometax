import type { AssetKind } from '../../shared/assets'
import { SIDEBAR_MESSAGES } from './sidebar'

export const PORTFOLIO_MESSAGES = {
  title: '내 부동산',
  toggleLabel: (count: number) => `내 부동산 ${count}건`,
  open: '내 부동산 목록 열기',
  close: '내 부동산 목록 닫기',
  emptyTitle: '아직 담은 부동산이 없습니다.',
  emptyDescription:
    '지도에서 단지를 선택한 뒤 내 부동산으로 추가해 주세요.',
  addFromSidebar: '내 부동산으로 추가',
  addIncompleteGuide:
    '동·호 또는 공시가격을 고르기 전에도 추가할 수 있습니다.',
  officialPriceLabel: '공시가격',
  officialPriceIncomplete: '공시가격 미입력',
  ownershipShareLabel: '내 소유 지분',
  ownershipShareUnit: '%',
  ownershipShareInvalid: '지분은 0%부터 100% 사이여야 합니다.',
  residencyLabel: '거주 여부',
  residing: '거주 주택',
  nonResiding: '비거주 주택',
  soleHouseholdOwner: '세대 내 1인 단독 소유',
  areaKindLabel: '지역 구분',
  adjustedArea: '조정대상지역',
  generalArea: '일반지역',
  remove: '목록에서 삭제',
  identitySeparator: ' · ',
  unitIdentity: (dong: string | null, ho: string | null) => [
    dong ? `${dong}${SIDEBAR_MESSAGES.dongSuffix}` : null,
    ho ? `${ho}${SIDEBAR_MESSAGES.roomSuffix}` : null,
  ].filter((value): value is string => value !== null).join(' '),
  assetKind: {
    apartment: '아파트',
    detachedHouse: '단독·다가구주택',
  } satisfies Readonly<Record<AssetKind, string>>,
} as const
