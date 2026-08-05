import type { ComplexTradesResponse } from '../../shared/trade'
import { D1ComplexTradeStore } from '../trade/d1-store'
import {
  lookupComplexTrades,
  type ComplexTradeStore,
} from '../trade/on-demand'

const BAD_REQUEST_STATUS = 400
const NOT_FOUND_STATUS = 404
const BAD_GATEWAY_STATUS = 502
const COMPLEX_NOT_FOUND_MESSAGE = '단지를 찾을 수 없습니다.'
const TRADE_LOOKUP_FAILED_MESSAGE =
  '실거래가 원천 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.'

interface ComplexTradesHandlerDependencies {
  readonly store?: ComplexTradeStore
  readonly lookup?: typeof lookupComplexTrades
}

const pendingLookups = new Map<string, Promise<ComplexTradesResponse | null>>()

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export const handleComplexTrades = async (
  database: D1Database,
  encodedComplexId: string,
  serviceKey: string,
  dependencies: ComplexTradesHandlerDependencies = {},
): Promise<Response> => {
  let complexId: string
  try {
    complexId = decodeURIComponent(encodedComplexId).trim()
    if (!complexId) throw new TypeError('Invalid complex id')
  } catch (error) {
    if (!(error instanceof TypeError || error instanceof URIError)) throw error
    return Response.json(
      { error: error.message },
      { status: BAD_REQUEST_STATUS },
    )
  }

  try {
    let pending = pendingLookups.get(complexId)
    if (!pending) {
      pending = (dependencies.lookup ?? lookupComplexTrades)(
        dependencies.store ?? new D1ComplexTradeStore(database),
        complexId,
        serviceKey,
        { log: console.info },
      )
      pendingLookups.set(complexId, pending)
    }
    const result = await pending.finally(() => {
      if (pendingLookups.get(complexId) === pending) {
        pendingLookups.delete(complexId)
      }
    })
    if (!result) {
      return Response.json(
        { error: COMPLEX_NOT_FOUND_MESSAGE },
        { status: NOT_FOUND_STATUS },
      )
    }
    return Response.json(result, {
      headers: { 'cache-control': 'no-store' },
    })
  } catch (error) {
    console.error('실거래가 온디맨드 조회 실패', complexId, errorMessage(error))
    return Response.json(
      { error: TRADE_LOOKUP_FAILED_MESSAGE, retryable: true },
      {
        status: BAD_GATEWAY_STATUS,
        headers: { 'cache-control': 'no-store' },
      },
    )
  }
}
