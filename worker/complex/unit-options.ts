import type { ApartmentUnitOptionsResult } from '../../shared/official-price'
import { buildPnu, parseLotAddress } from '../ldong/address'
import type { LdongRefreshEnv } from '../ldong/refresh'
import type { OfficialPriceService } from '../realty-price'
import { findComplex } from './catalog'

const BAD_REQUEST_STATUS = 400
const NOT_FOUND_STATUS = 404
const COMPLEX_NOT_FOUND_MESSAGE = '단지를 찾을 수 없습니다.'

export const handleComplexUnitOptions = async (
  url: URL,
  database: D1Database,
  encodedComplexId: string,
  service: OfficialPriceService,
  env: LdongRefreshEnv,
  context: ExecutionContext,
): Promise<Response> => {
  let complexId: string
  try {
    complexId = decodeURIComponent(encodedComplexId).trim()
    if (!complexId) throw new TypeError('Invalid complex id')
  } catch (error) {
    if (!(error instanceof TypeError || error instanceof URIError)) throw error
    return Response.json({ error: error.message }, { status: BAD_REQUEST_STATUS })
  }

  const complex = await findComplex(database, complexId)
  if (!complex) {
    return Response.json(
      { error: COMPLEX_NOT_FOUND_MESSAGE },
      { status: NOT_FOUND_STATUS },
    )
  }
  const parsedAddress = parseLotAddress(complex.legalAddress)
  const pnu = parsedAddress
    ? buildPnu(parsedAddress, complex.legalDongCode) ?? undefined
    : undefined
  const dong = url.searchParams.get('dong')?.trim() || undefined
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
