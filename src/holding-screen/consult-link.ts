import type { StoredPortfolioItem } from '../../shared/portfolio'
import { CONSULT_REQUEST_URL } from '../messages/consult'

/**
 * 상담신청 폼의 칸 이름. 받는 쪽(`023339001.com/상담신청/`)의 `name` 속성과
 * 글자 하나까지 같아야 채워진다 — docs/consult-form-prefill.md 참조.
 *
 * 주소만 보낸다. 상담 내용과 개인정보 동의는 본인이 적고 누를 몫이다.
 */
const ADDRESS_FIELD = '부동산주소'

/**
 * 한 채를 한 줄로 적는다 — 도로명 주소에 동·호까지 이어 붙인다.
 *
 *     서울 강남구 삼성로 212 21동 101호
 *
 * `address` 는 도로명이 있으면 도로명, 없으면 지번이다
 * (`UnitLookup` 의 `complex.roadAddress ?? complex.legalAddress`).
 */
const describeItem = (item: StoredPortfolioItem): string => [
  item.address,
  item.dong === null ? null : `${item.dong}동`,
  item.ho === null ? null : `${item.ho}호`,
].filter((part): part is string => part !== null && part !== '').join(' ')

/**
 * 계산에 쓴 부동산의 주소를 실어 상담신청 링크를 만든다.
 *
 * 한 채가 한 줄이므로 여러 채는 줄바꿈으로 나눈다.
 * 담은 것이 없으면 파라미터를 붙이지 않는다 — 빈 칸이 채워져 오면 상담사가
 * 사용자가 적은 것으로 오해한다.
 */
export const buildConsultRequestUrl = (
  items: readonly StoredPortfolioItem[],
): string => {
  const url = new URL(CONSULT_REQUEST_URL)
  const address = items.map(describeItem).join('\n')
  if (address !== '') url.searchParams.set(ADDRESS_FIELD, address)
  return url.toString()
}
