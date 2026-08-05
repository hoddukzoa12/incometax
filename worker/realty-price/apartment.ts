import type {
  ApartmentUnitOption,
  ApartmentUnitOptionsRequest,
  ApartmentUnitOptionsResult,
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

interface ApartmentLookupContext {
  readonly common: Record<string, string>
  readonly complexCode: string
  readonly noticeDate: string
}

type ApartmentUnitOptionsSourceResult = Exclude<
  ApartmentUnitOptionsResult,
  { readonly status: 'failed' }
>

const loadApartmentContext = async (
  request: ApartmentUnitOptionsRequest,
  parsedPnu: ParsedPnu,
  notice: NoticeDate,
  client: RealtyPriceClient,
): Promise<ApartmentLookupContext | null> => {
  const common = apartmentParams({
    ...request,
    assetKind: 'apartment',
    dong: request.dong ?? '',
    room: '',
  }, parsedPnu, notice)
  const complexRows = responseList(await client.request(
    REALTY_PRICE_PATHS.apartmentSearch,
    common,
  ))
  validateOptionRows(complexRows, '단지')
  const complex = findComplex(complexRows, request.complexName)
  if (!complex) return null
  return {
    common,
    complexCode: requiredText(complex, 'code', '단지 code'),
    noticeDate: text(complex.notice_date) || notice.code,
  }
}

const loadDongRows = async (
  context: ApartmentLookupContext,
  client: RealtyPriceClient,
) => {
  const rows = responseList(await client.request(
    REALTY_PRICE_PATHS.apartmentSearch,
    {
      ...context.common,
      notice_date: context.noticeDate,
      gbnApt: 'DONG',
      apt_code: context.complexCode,
    },
  ))
  validateOptionRows(rows, '동')
  return rows
}

const loadRoomRows = async (
  context: ApartmentLookupContext,
  dongCode: string,
  dongName: string,
  client: RealtyPriceClient,
) => {
  const rows = responseList(await client.request(
    REALTY_PRICE_PATHS.apartmentSearch,
    {
      ...context.common,
      notice_date: context.noticeDate,
      gbnApt: 'HO',
      apt_code: context.complexCode,
      dong_code: dongCode,
      dong_name: dongName,
    },
  ))
  validateOptionRows(rows, '호')
  return rows
}

const toOptions = (
  rows: readonly Record<string, unknown>[],
  label: string,
): readonly ApartmentUnitOption[] => rows.map((row) => ({
  code: requiredText(row, 'code', `${label} code`),
  name: requiredText(row, 'name', `${label} name`),
}))

export async function lookupApartmentUnitOptions(
  request: ApartmentUnitOptionsRequest,
  pnu: string,
  parsedPnu: ParsedPnu,
  notice: NoticeDate,
  client: RealtyPriceClient,
): Promise<ApartmentUnitOptionsSourceResult> {
  const context = await loadApartmentContext(request, parsedPnu, notice, client)
  if (!context) {
    return { key: request.key, status: 'noData', reason: 'complexNotFound' }
  }
  const dongRows = await loadDongRows(context, client)
  if (!request.dong) {
    return {
      key: request.key,
      status: 'found',
      value: { pnu, dongs: toOptions(dongRows, '동'), rooms: [] },
    }
  }
  const dong = findUnit(dongRows, request.dong, '동')
  if (!dong) {
    return { key: request.key, status: 'noData', reason: 'dongNotFound' }
  }
  const rooms = await loadRoomRows(
    context,
    requiredText(dong, 'code', '동 code'),
    requiredText(dong, 'name', '동 name'),
    client,
  )
  return {
    key: request.key,
    status: 'found',
    value: {
      pnu,
      dongs: toOptions(dongRows, '동'),
      rooms: toOptions(rooms, '호'),
    },
  }
}

export async function lookupApartmentOfficialPrice(
  request: ApartmentOfficialPriceRequest,
  pnu: string,
  parsedPnu: ParsedPnu,
  notice: NoticeDate,
  client: RealtyPriceClient,
): Promise<OfficialPriceLookupResult> {
  const context = await loadApartmentContext(request, parsedPnu, notice, client)
  if (!context) return noData(request.key, 'complexNotFound')
  const dongRows = await loadDongRows(context, client)
  const dong = findUnit(dongRows, request.dong, '동')
  if (!dong) return noData(request.key, 'dongNotFound')

  const dongCode = requiredText(dong, 'code', '동 code')
  const dongName = requiredText(dong, 'name', '동 name')
  const roomRows = await loadRoomRows(context, dongCode, dongName, client)
  const room = findUnit(roomRows, request.room, '호')
  if (!room) return noData(request.key, 'roomNotFound')

  const roomCode = requiredText(room, 'code', '호 code')
  const roomName = requiredText(room, 'name', '호 name')
  const priceRows = responseList(await client.request(
    REALTY_PRICE_PATHS.apartmentPrices,
    {
      ...context.common,
      notice_date: context.noticeDate,
      gbnApt: 'HO',
      apt_code: context.complexCode,
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
