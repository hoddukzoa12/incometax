import type {
  AddressComplexSearchRequest,
  AddressComplexSearchResult,
} from '../../shared/official-price'
import { REALTY_PRICE_PATHS } from '../config/external-apis'
import { addressToPnu } from '../ldong/lookup'
import type { LdongRefreshEnv } from '../ldong/refresh'
import type { AddressComplexSearchCache } from './cache'
import {
  realtyPriceClient,
  RealtyPriceClient,
  RealtySourceError,
  responseList,
} from './client'
import { loadLatestNoticeDate } from './notice-date'
import { requiredText } from './normalize'
import {
  apartmentParams,
  parsePnu,
  type NoticeDate,
} from './params'

interface AddressComplexSearchDependencies {
  readonly client?: RealtyPriceClient
  readonly cache?: AddressComplexSearchCache
  readonly now?: () => number
  readonly resolvePnu?: typeof addressToPnu
}

type FailedAddressComplexSearchResult = Extract<
  AddressComplexSearchResult,
  { readonly status: 'failed' }
>

function failed(
  kind: string,
  message: string,
  retryable: boolean,
): FailedAddressComplexSearchResult {
  return { status: 'failed', failure: { kind, message, retryable } }
}

function sourceFailure(error: unknown): FailedAddressComplexSearchResult {
  if (error instanceof RealtySourceError) {
    return failed(error.kind, error.message, error.retryable)
  }
  return failed(
    'unavailable',
    error instanceof Error ? error.message : '공동주택 목록 조회 실패',
    true,
  )
}

export class AddressComplexSearchService {
  private readonly client: RealtyPriceClient
  private readonly cache?: AddressComplexSearchCache
  private readonly now: () => number
  private readonly resolvePnu: typeof addressToPnu
  private noticePromise: Promise<NoticeDate> | null = null

  constructor(dependencies: AddressComplexSearchDependencies = {}) {
    this.client = dependencies.client ?? realtyPriceClient
    this.cache = dependencies.cache
    this.now = dependencies.now ?? Date.now
    this.resolvePnu = dependencies.resolvePnu ?? addressToPnu
  }

  async search(
    request: AddressComplexSearchRequest,
    env: LdongRefreshEnv,
    context?: ExecutionContext,
  ): Promise<AddressComplexSearchResult> {
    const address = request.address.trim()
    if (!address) {
      return failed('invalidRequest', 'address가 필요합니다.', false)
    }

    try {
      const pnu = request.pnu?.trim() ||
        await this.resolvePnu(address, env, context)
      if (!pnu) return { status: 'noData' }

      const parsedPnu = parsePnu(pnu)
      if (!parsedPnu) {
        return failed('invalidRequest', 'PNU 형식이 올바르지 않습니다.', false)
      }

      const notice = await this.latestNoticeDate()
      const cached = await this.cache?.getAddressComplexes(pnu, notice.code)
      if (cached) return cached

      const rows = responseList(await this.client.request(
        REALTY_PRICE_PATHS.apartmentSearch,
        apartmentParams(parsedPnu, notice),
      ))
      const result: AddressComplexSearchResult = rows.length > 0
        ? {
            status: 'found',
            complexes: rows.map((row) => ({
              code: requiredText(row, 'code', '단지 code'),
              name: requiredText(row, 'name', '단지 name'),
            })),
            pnu,
          }
        : { status: 'noData' }

      await this.cache?.putAddressComplexes(pnu, notice.code, result)
      return result
    } catch (error) {
      return sourceFailure(error)
    }
  }

  private async latestNoticeDate(): Promise<NoticeDate> {
    if (!this.noticePromise) {
      this.noticePromise = loadLatestNoticeDate(this.client, this.now)
        .catch((error) => {
          this.noticePromise = null
          throw error
        })
    }
    return this.noticePromise
  }
}
