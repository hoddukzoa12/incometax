import type { ApartmentUnitOptionsResult } from '../../shared/official-price'
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

export const handleComplexUnitOptions = async (
  url: URL,
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

  const complex = await findComplex(database, complexId)
  if (!complex) {
    return Response.json(
      { error: COMPLEX_NOT_FOUND_MESSAGE },
      { status: NOT_FOUND_STATUS },
    )
  }
  const pnu = resolveStoredComplexPnu(complex)
  const dong = url.searchParams.get('dong')?.trim() || undefined
  if (!pnu) {
    const result: ApartmentUnitOptionsResult = {
      key: complexId,
      status: 'noData',
      reason: 'addressNotFound',
    }
    return Response.json(result, {
      headers: { 'cache-control': 'no-store' },
    })
  }
  const result: ApartmentUnitOptionsResult = await service.lookupApartmentOptions(
    {
      key: complexId,
      address: complex.legalAddress,
      complexName: complex.name,
      pnu,
      dong,
    },
    env,
    context,
  )
  return Response.json(result, {
    headers: { 'cache-control': 'no-store' },
  })
}
