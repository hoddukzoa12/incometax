import type { AreaKind } from '../shared/tax-rules'
import { isLegalDongCode } from '../shared/legal-dong'

const LEGAL_DISTRICT_CODE_LENGTH = 5

/**
 * 조정대상지역 현행본 메타데이터.
 *
 * 국토교통부는 조정대상지역을 `고시`가 아니라 「주택법」 제63조의2에
 * 따른 `공고`로 발령한다. 아래 현행본의 부록 "조정대상지역 지정 현황"은
 * 2026-07-01 기준 서울 25개 자치구와 경기 15개 시·구를 열거한다.
 *
 * 갱신 절차:
 * 1. 매 배포 전 및 최소 월 1회 국가법령정보센터에서 "조정대상지역 지정"의
 *    현행 공고 번호·시행일을 확인한다.
 * 2. 새 지정 또는 해제 공고가 있으면 공고 부록의 전체 현황을 기준으로 아래
 *    5자리 시군구 법정동코드 prefix를 교체한다. 주소 문자열은 사용하지 않는다.
 * 3. `noticeNumber`, `effectiveOn`, `lastAmendedOn`, `verifiedOn`,
 *    `reviewDueOn`과 지정/비지정 회귀 테스트를 같은 변경에서 갱신한다.
 *
 * `reviewDueOn`이 지났거나 국가법령정보센터의 현행 공고 번호가 달라졌으면
 * 이 스냅샷은 stale이다. 확인 전에는 임의로 지역을 추가하거나 제거하지 않는다.
 */
export const ADJUSTED_AREA_SNAPSHOT = {
  authority: '국토교통부',
  noticeNumber: '국토교통부공고 제2026-882호',
  effectiveOn: '2026-07-01',
  lastAmendedOn: '2026-07-01',
  verifiedOn: '2026-08-05',
  reviewDueOn: '2026-09-05',
  sourceUrl:
    'https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000281588&chrClsCd=010201',
  publicationIndexUrl: 'https://www.molit.go.kr/USR/I0204/m_45/lst.jsp',
  legalDongCodeSourceUrl: 'https://www.code.go.kr/bbsmng/dataBbsL.do',
} as const

/**
 * 공고가 전 시군구를 지정하므로 10자리 법정동코드의 5자리 시군구 prefix로
 * 관리한다. 값은 감사 가능성을 위한 표시명이며 판정에는 코드 key만 사용한다.
 */
export const ADJUSTED_LEGAL_DISTRICT_CODE_PREFIXES = {
  // 서울특별시 전 지역(25개 자치구)
  '11110': '서울특별시 종로구',
  '11140': '서울특별시 중구',
  '11170': '서울특별시 용산구',
  '11200': '서울특별시 성동구',
  '11215': '서울특별시 광진구',
  '11230': '서울특별시 동대문구',
  '11260': '서울특별시 중랑구',
  '11290': '서울특별시 성북구',
  '11305': '서울특별시 강북구',
  '11320': '서울특별시 도봉구',
  '11350': '서울특별시 노원구',
  '11380': '서울특별시 은평구',
  '11410': '서울특별시 서대문구',
  '11440': '서울특별시 마포구',
  '11470': '서울특별시 양천구',
  '11500': '서울특별시 강서구',
  '11530': '서울특별시 구로구',
  '11545': '서울특별시 금천구',
  '11560': '서울특별시 영등포구',
  '11590': '서울특별시 동작구',
  '11620': '서울특별시 관악구',
  '11650': '서울특별시 서초구',
  '11680': '서울특별시 강남구',
  '11710': '서울특별시 송파구',
  '11740': '서울특별시 강동구',

  // 경기도(15개 시·구)
  '41111': '경기도 수원시 장안구',
  '41115': '경기도 수원시 팔달구',
  '41117': '경기도 수원시 영통구',
  '41131': '경기도 성남시 수정구',
  '41133': '경기도 성남시 중원구',
  '41135': '경기도 성남시 분당구',
  '41173': '경기도 안양시 동안구',
  '41210': '경기도 광명시',
  '41290': '경기도 과천시',
  '41310': '경기도 구리시',
  '41430': '경기도 의왕시',
  '41450': '경기도 하남시',
  '41463': '경기도 용인시 기흥구',
  '41465': '경기도 용인시 수지구',
  '41597': '경기도 화성시 동탄구',
} as const

export const resolveAreaKind = (legalDongCode: string): AreaKind => {
  if (!isLegalDongCode(legalDongCode)) {
    throw new TypeError('legalDongCode must be a 10-digit code')
  }

  const legalDistrictCode = legalDongCode.slice(0, LEGAL_DISTRICT_CODE_LENGTH)
  return Object.hasOwn(
    ADJUSTED_LEGAL_DISTRICT_CODE_PREFIXES,
    legalDistrictCode,
  ) ? 'adjusted' : 'general'
}
