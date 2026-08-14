import type {
  AddressUnitOptionsRequest,
  ApartmentUnitOptionsResult,
} from '../../shared/official-price'
import type { OfficialPriceService } from '../realty-price'

const BAD_REQUEST_STATUS = 400

type AddressUnitOptionsService = Pick<
  OfficialPriceService,
  'lookupAddressApartmentOptions'
>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined
}

function normalizeRequest(value: unknown): AddressUnitOptionsRequest | null {
  if (!isRecord(value)) return null
  const pnu = optionalString(value.pnu)
  const aptCode = optionalString(value.aptCode)
  if (!pnu || !aptCode) return null
  if (value.dong !== undefined && typeof value.dong !== 'string') return null

  const dong = optionalString(value.dong)
  return dong ? { pnu, aptCode, dong } : { pnu, aptCode }
}

export async function handleAddressUnitOptions(
  request: Request,
  service: AddressUnitOptionsService,
): Promise<Response> {
  const body = normalizeRequest(await request.json().catch(() => null))
  if (!body) {
    return Response.json(
      { error: '주소 기반 동·호 조회 요청 형식이 올바르지 않습니다.' },
      { status: BAD_REQUEST_STATUS },
    )
  }

  const result: ApartmentUnitOptionsResult =
    await service.lookupAddressApartmentOptions(body)
  return Response.json(result, {
    headers: { 'cache-control': 'no-store' },
  })
}
