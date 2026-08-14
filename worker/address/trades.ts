import type {
  AddressTradeTarget,
  AddressTradesResponse,
} from '../../shared/trade.ts'
import { lookupAddressTrades } from '../trade/address-trades.ts'

const BAD_REQUEST_STATUS = 400
const BAD_GATEWAY_STATUS = 502
const LEGAL_DONG_CODE_PATTERN = /^\d{10}$/u
const INVALID_REQUEST_MESSAGE =
  '주소 기반 실거래가 요청 형식이 올바르지 않습니다.'
const TRADE_LOOKUP_FAILED_MESSAGE =
  '실거래가 원천 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function requiredString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized || null
}

function normalizeRequest(value: unknown): AddressTradeTarget | null {
  if (!isRecord(value)) return null
  const legalDongCode = requiredString(value.legalDongCode)
  const jibunAddress = requiredString(value.jibunAddress)
  const complexName = requiredString(value.complexName)
  if (
    !legalDongCode ||
    !LEGAL_DONG_CODE_PATTERN.test(legalDongCode) ||
    !jibunAddress ||
    !complexName
  ) return null
  return { legalDongCode, jibunAddress, complexName }
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export async function handleAddressTrades(
  request: Request,
  serviceKey: string,
  context: ExecutionContext,
  lookup: typeof lookupAddressTrades = lookupAddressTrades,
): Promise<Response> {
  const target = normalizeRequest(await request.json().catch(() => null))
  if (!target) {
    return Response.json(
      { error: INVALID_REQUEST_MESSAGE },
      { status: BAD_REQUEST_STATUS },
    )
  }

  try {
    const response: AddressTradesResponse = {
      items: await lookup(target, serviceKey, context),
    }
    return Response.json(response, {
      headers: { 'cache-control': 'no-store' },
    })
  } catch (error) {
    console.error(
      '주소 기반 실거래가 조회 실패',
      target.legalDongCode,
      errorMessage(error),
    )
    return Response.json(
      { error: TRADE_LOOKUP_FAILED_MESSAGE, retryable: true },
      {
        status: BAD_GATEWAY_STATUS,
        headers: { 'cache-control': 'no-store' },
      },
    )
  }
}
