import { withKoreanParticle } from '../i18n/korean-particle'

export const MAP_MESSAGES = {
  clusterSuffix: '개 단지',
  loading: '지도에서 단지를 불러오고 있어요.',
  loadError: '단지 정보를 불러오지 못했어요. 지도를 다시 움직여 주세요.',
  mapLabel: '부동산 단지 지도',
  missingKey: '카카오맵 JavaScript 키 환경변수를 설정해 주세요.',
  truncated: '단지가 너무 많아 일부만 표시했어요. 지도를 확대해 주세요.',
  zoomIn: '지도 확대',
  householdCount: (count: number) => `${count.toLocaleString('ko-KR')}세대`,
  addSymbol: '+',
  removeSymbol: '−',
  stackedName: (name: string, others: number) => `${name} 외 ${others}`,
  stackedCount: (count: number) => `${count}개 단지`,
  stackedOpen: (count: number) =>
    `같은 자리의 단지 ${count}곳 펼치기`,
  addToPortfolio: (name: string) =>
    `${withKoreanParticle(name, '을/를')} 내 부동산에 담기`,
  removeFromPortfolio: (name: string) =>
    `${withKoreanParticle(name, '을/를')} 내 부동산에서 빼기`,
} as const
