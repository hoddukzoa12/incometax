import { REALTY_PRICE_PATHS } from '../config/external-apis'
import {
  type RealtyPriceClient,
  RealtySourceError,
  responseList,
} from './client'
import { requiredText } from './normalize'
import type { NoticeDate } from './params'

const NOTICE_DATE_NAME_PATTERN =
  /(\d{4})년.*공시일자\s*:\s*(\d{4})\.(\d{2})\.(\d{2})/

export async function loadLatestNoticeDate(
  client: RealtyPriceClient,
  now: () => number,
): Promise<NoticeDate> {
  const currentYear = String(new Date(now()).getFullYear())
  const rows = responseList(await client.request(
    REALTY_PRICE_PATHS.noticeDates,
    { year: currentYear },
  ))
  const first = rows[0]
  if (!first) {
    throw new RealtySourceError(
      'invalidResponse',
      '공동주택 고시일자를 확인하지 못했습니다.',
      false,
    )
  }

  const code = requiredText(first, 'code', '고시일자 code')
  const name = requiredText(first, 'name', '고시일자 name')
  const match = NOTICE_DATE_NAME_PATTERN.exec(name)
  if (!match) {
    throw new RealtySourceError(
      'invalidResponse',
      '공동주택 고시일자 형식이 변경되었습니다.',
      false,
    )
  }
  return {
    code,
    year: match[1],
    publishedDate: `${match[2]}${match[3]}${match[4]}`,
  }
}
