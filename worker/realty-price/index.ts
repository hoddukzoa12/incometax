import type {
  AddressUnitOptionsRequest,
  ApartmentUnitOptionsRequest,
  ApartmentUnitOptionsResult,
  OfficialPriceFailure,
  OfficialPriceLookupResult,
  OfficialPriceRequest,
} from '../../shared/official-price'
import { addressApartmentIdentity } from '../../shared/official-price'
import {
  resolveAddressToPnu,
  type AddressPnuResolution,
} from '../ldong/lookup'
import type { LdongRefreshEnv } from '../ldong/refresh'
import {
  lookupApartmentOfficialPrice,
  lookupApartmentUnitOptions,
} from './apartment'
import type {
  ApartmentUnitOptionsCache,
  OfficialPriceCache,
} from './cache'
import {
  realtyPriceClient,
  RealtyPriceClient,
  RealtySourceError,
} from './client'
import { lookupDetachedHouseOfficialPrice } from './detached-house'
import { loadLatestNoticeDate } from './notice-date'
import {
  parsePnu,
  type NoticeDate,
  type ParsedPnu,
} from './params'

interface OfficialPriceServiceDependencies {
  readonly client?: RealtyPriceClient
  readonly cache?: OfficialPriceCache
  readonly unitOptionsCache?: ApartmentUnitOptionsCache
  readonly now?: () => number
  readonly resolvePnu?: typeof resolveAddressToPnu
}

type PnuLookup =
  | { readonly status: 'found'; readonly pnu: string; readonly parsed: ParsedPnu }
  | {
      readonly status: 'failed'
      readonly result:
        | {
            readonly key: string
            readonly status: 'noData'
            readonly reason: 'addressNotFound'
          }
        | {
            readonly key: string
            readonly status: 'failed'
            readonly failure: OfficialPriceFailure
          }
    }

function invalidRequest(
  key: string,
  message: string,
): Extract<OfficialPriceLookupResult, { readonly status: 'failed' }> {
  return {
    key,
    status: 'failed',
    failure: { kind: 'invalidRequest', message, retryable: false },
  }
}

function sourceFailure(error: unknown): OfficialPriceFailure {
  if (error instanceof RealtySourceError) {
    const kindBySourceError = {
      unavailable: 'sourceUnavailable',
      captcha: 'captchaRequired',
      invalidResponse: 'invalidSourceResponse',
    } as const
    return {
      kind: kindBySourceError[error.kind],
      message: error.message,
      retryable: error.retryable,
    }
  }

  return {
    kind: 'sourceUnavailable',
    message: error instanceof Error ? error.message : '공시가격 원천 조회 실패',
    retryable: true,
  }
}

export class OfficialPriceService {
  private readonly client: RealtyPriceClient
  private readonly cache?: OfficialPriceCache
  private readonly unitOptionsCache?: ApartmentUnitOptionsCache
  private readonly now: () => number
  private readonly resolvePnu: typeof resolveAddressToPnu
  private noticePromise: Promise<NoticeDate> | null = null

  constructor(dependencies: OfficialPriceServiceDependencies = {}) {
    this.client = dependencies.client ?? realtyPriceClient
    this.cache = dependencies.cache
    this.unitOptionsCache = dependencies.unitOptionsCache
    this.now = dependencies.now ?? Date.now
    this.resolvePnu = dependencies.resolvePnu ?? resolveAddressToPnu
  }

  async lookupBatch(
    requests: readonly OfficialPriceRequest[],
    env: LdongRefreshEnv,
    context?: ExecutionContext,
  ): Promise<readonly OfficialPriceLookupResult[]> {
    const results: OfficialPriceLookupResult[] = []
    for (const request of requests) {
      results.push(await this.lookup(request, env, context))
    }
    return results
  }

  async lookup(
    request: OfficialPriceRequest,
    env: LdongRefreshEnv,
    context?: ExecutionContext,
  ): Promise<OfficialPriceLookupResult> {
    const validationFailure = this.validateRequest(request)
    if (validationFailure) return validationFailure

    try {
      const pnuLookup = await this.lookupPnu(
        request.key,
        request.address,
        request.pnu,
        env,
        context,
      )
      if (pnuLookup.status === 'failed') return pnuLookup.result
      const { pnu, parsed: parsedPnu } = pnuLookup

      const cached = await this.cache?.get(request, pnu)
      if (cached) return cached

      const result = request.assetKind === 'apartment'
        ? await lookupApartmentOfficialPrice(
            request,
            pnu,
            parsedPnu,
            await this.latestNoticeDate(),
            this.client,
          )
        : await lookupDetachedHouseOfficialPrice(
            request,
            pnu,
            parsedPnu,
            this.client,
          )
      await this.cache?.put(request, pnu, result)
      return result
    } catch (error) {
      return {
        key: request.key,
        status: 'failed',
        failure: sourceFailure(error),
      }
    }
  }

  async lookupApartmentOptions(
    request: ApartmentUnitOptionsRequest,
    env: LdongRefreshEnv,
    context?: ExecutionContext,
  ): Promise<ApartmentUnitOptionsResult> {
    if (!request.key.trim() || !request.address.trim() || !request.complexName.trim()) {
      return invalidRequest(
        request.key,
        '동·호 목록 조회에는 단지명과 주소가 필요합니다.',
      )
    }
    try {
      const pnuLookup = await this.lookupPnu(
        request.key,
        request.address,
        request.pnu,
        env,
        context,
      )
      if (pnuLookup.status === 'failed') return pnuLookup.result

      return await this.lookupParsedApartmentOptions(
        request,
        pnuLookup.pnu,
        pnuLookup.parsed,
      )
    } catch (error) {
      return {
        key: request.key,
        status: 'failed',
        failure: sourceFailure(error),
      }
    }
  }

  async lookupAddressApartmentOptions(
    request: AddressUnitOptionsRequest,
  ): Promise<ApartmentUnitOptionsResult> {
    const pnu = request.pnu.trim()
    const aptCode = request.aptCode.trim()
    const key = addressApartmentIdentity(pnu, aptCode)
    if (!pnu || !aptCode) {
      return invalidRequest(key, '동·호 목록 조회에는 PNU와 단지 코드가 필요합니다.')
    }

    const parsedPnu = parsePnu(pnu)
    if (!parsedPnu) {
      return invalidRequest(key, 'PNU 형식이 올바르지 않습니다.')
    }

    const normalizedRequest: ApartmentUnitOptionsRequest = {
      key,
      address: '',
      complexName: '',
      pnu,
      aptCode,
      dong: request.dong?.trim() || undefined,
    }
    try {
      return await this.lookupParsedApartmentOptions(
        normalizedRequest,
        pnu,
        parsedPnu,
      )
    } catch (error) {
      return { key, status: 'failed', failure: sourceFailure(error) }
    }
  }

  private validateRequest(
    request: OfficialPriceRequest,
  ): OfficialPriceLookupResult | null {
    if (!request.key.trim() || !request.address.trim()) {
      return invalidRequest(request.key, 'key와 address가 필요합니다.')
    }
    if (request.assetKind !== 'apartment') return null
    if (!request.complexName.trim() || !request.dong.trim() || !request.room.trim()) {
      return invalidRequest(
        request.key,
        '공동주택가격 조회에는 단지명·동·호가 모두 필요합니다.',
      )
    }
    return null
  }

  private async lookupPnu(
    key: string,
    address: string,
    pnu: string | undefined,
    env: LdongRefreshEnv,
    context?: ExecutionContext,
  ): Promise<PnuLookup> {
    const resolution: AddressPnuResolution = pnu
      ? { status: 'found', pnu }
      : await this.resolvePnu(address, env, context)
    if (resolution.status === 'noData') {
      return {
        status: 'failed',
        result: { key, status: 'noData', reason: 'addressNotFound' },
      }
    }
    if (resolution.status === 'cacheUnavailable') {
      return {
        status: 'failed',
        result: {
          key,
          status: 'failed',
          failure: {
            kind: 'sourceUnavailable',
            message: '법정동코드 캐시가 준비되지 않았습니다.',
            retryable: true,
          },
        },
      }
    }
    const resolvedPnu = resolution.pnu
    const parsed = parsePnu(resolvedPnu)
    if (!parsed) {
      return {
        status: 'failed',
        result: invalidRequest(key, 'PNU 형식이 올바르지 않습니다.'),
      }
    }
    return { status: 'found', pnu: resolvedPnu, parsed }
  }

  private async lookupParsedApartmentOptions(
    request: ApartmentUnitOptionsRequest,
    pnu: string,
    parsedPnu: ParsedPnu,
  ): Promise<ApartmentUnitOptionsResult> {
    const cached = await this.unitOptionsCache?.getApartmentOptions(request, pnu)
    if (cached) return cached

    const result = await lookupApartmentUnitOptions(
      request,
      pnu,
      parsedPnu,
      await this.latestNoticeDate(),
      this.client,
    )
    await this.unitOptionsCache?.putApartmentOptions(request, pnu, result)
    return result
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
