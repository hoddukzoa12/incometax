import type {
  ApartmentOfficialPriceRequest,
  ComplexOfficialPriceRequest,
  OfficialPriceLookupResult,
} from '../../shared/official-price'
import type { LdongRefreshEnv } from '../ldong/refresh'
import type { OfficialPriceService } from '../realty-price'
import { findComplex } from './catalog'
import { resolveStoredComplexPnu } from './pnu'
import {
  COMPLEX_NOT_FOUND_MESSAGE,
  decodeComplexId,
  INVALID_COMPLEX_ID_MESSAGE,
} from './request'

const BAD_REQUEST_STATUS = 400
const NOT_FOUND_STATUS = 404
const INVALID_REQUEST_MESSAGE = '공시가격 요청 형식이 올바르지 않습니다.'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const requiredString = (value: unknown): string | null =>
  typeof value === 'string' ? value.trim() || null : null

const parseRequest = (value: unknown): ComplexOfficialPriceRequest | null => {
  if (!isRecord(value)) return null
  const key = requiredString(value.key)
  const dong = requiredString(value.dong)
  const room = requiredString(value.room)
  return key && dong && room ? { key, dong, room } : null
}

export const handleComplexOfficialPrice = async (
  request: Request,
  database: D1Database,
  encodedComplexId: string,
  service: OfficialPriceService,
  env: LdongRefreshEnv,
  context: ExecutionContext,
): Promise<Response> => {
  const complexId = decodeComplexId(encodedComplexId)
  if (!complexId) {
    return Response.json(
      { error: INVALID_COMPLEX_ID_MESSAGE },
      { status: BAD_REQUEST_STATUS },
    )
  }

  const body = parseRequest(await request.json().catch(() => null))
  if (!body) {
    return Response.json(
      { error: INVALID_REQUEST_MESSAGE },
      { status: BAD_REQUEST_STATUS },
    )
  }

  const complex = await findComplex(database, complexId)
  if (!complex) {
    return Response.json(
      { error: COMPLEX_NOT_FOUND_MESSAGE },
      { status: NOT_FOUND_STATUS },
    )
  }

  const pnu = resolveStoredComplexPnu(complex)
  if (!pnu) {
    const result: OfficialPriceLookupResult = {
      key: body.key,
      status: 'noData',
      reason: 'addressNotFound',
    }
    return Response.json(result, {
      headers: { 'cache-control': 'no-store' },
    })
  }

  const officialPriceRequest: ApartmentOfficialPriceRequest = {
    assetKind: 'apartment',
    key: body.key,
    address: complex.legalAddress,
    complexName: complex.name,
    dong: body.dong,
    room: body.room,
    pnu,
  }
  const result = await service.lookup(officialPriceRequest, env, context)
  return Response.json(result, {
    headers: { 'cache-control': 'no-store' },
  })
}
