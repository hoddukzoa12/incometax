import type {
  ApartmentOfficialPriceRequest,
  OfficialPriceLookupResult,
} from '../../shared/official-price'
import { REALTY_PRICE_PATHS } from '../config/external-apis'
import { RealtyPriceClient, responseList } from './client'
import {
  findComplex,
  findUnit,
  noData,
  normalizeHistory,
  requiredText,
  text,
  validateOptionRows,
} from './normalize'
import {
  apartmentParams,
  type NoticeDate,
  type ParsedPnu,
} from './params'

export async function lookupApartmentOfficialPrice(
  request: ApartmentOfficialPriceRequest,
  pnu: string,
  parsedPnu: ParsedPnu,
  notice: NoticeDate,
  client: RealtyPriceClient,
): Promise<OfficialPriceLookupResult> {
  const common = apartmentParams(request, parsedPnu, notice)
  const complexRows = responseList(await client.request(
    REALTY_PRICE_PATHS.apartmentSearch,
    common,
  ))
  validateOptionRows(complexRows, '단지')
  const complex = findComplex(complexRows, request.complexName)
  if (!complex) return noData(request.key, 'complexNotFound')

  const complexCode = requiredText(complex, 'code', '단지 code')
  const noticeDate = text(complex.notice_date) || notice.code
  const dongRows = responseList(await client.request(
    REALTY_PRICE_PATHS.apartmentSearch,
    {
      ...common,
      notice_date: noticeDate,
      gbnApt: 'DONG',
      apt_code: complexCode,
    },
  ))
  validateOptionRows(dongRows, '동')
  const dong = findUnit(dongRows, request.dong, '동')
  if (!dong) return noData(request.key, 'dongNotFound')

  const dongCode = requiredText(dong, 'code', '동 code')
  const dongName = requiredText(dong, 'name', '동 name')
  const roomRows = responseList(await client.request(
    REALTY_PRICE_PATHS.apartmentSearch,
    {
      ...common,
      notice_date: noticeDate,
      gbnApt: 'HO',
      apt_code: complexCode,
      dong_code: dongCode,
      dong_name: dongName,
    },
  ))
  validateOptionRows(roomRows, '호')
  const room = findUnit(roomRows, request.room, '호')
  if (!room) return noData(request.key, 'roomNotFound')

  const roomCode = requiredText(room, 'code', '호 code')
  const roomName = requiredText(room, 'name', '호 name')
  const priceRows = responseList(await client.request(
    REALTY_PRICE_PATHS.apartmentPrices,
    {
      ...common,
      notice_date: noticeDate,
      gbnApt: 'HO',
      apt_code: complexCode,
      dong_code: dongCode,
      dong_name: dongName,
      ho_code: roomCode,
      ho_name: roomName,
    },
  ))
  if (!priceRows.length) return noData(request.key, 'priceNotFound')

  return {
    key: request.key,
    status: 'found',
    value: {
      assetKind: request.assetKind,
      pnu,
      detailAddress: text(priceRows[0].full_addr_name) ||
        `${request.address} ${request.complexName} ${dongName}동 ${roomName}호`,
      items: normalizeHistory(priceRows, {
        date: 'notice_date_name',
        price: 'notice_amt',
        area: 'priv_area',
      }),
    },
  }
}
