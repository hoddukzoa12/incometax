import type {
  OfficialPriceFailure,
  OfficialPriceLookupResult,
  OfficialPriceRequest,
} from '../../shared/official-price'
import { REALTY_PRICE_PATHS } from '../config/external-apis'
import {
  resolveAddressToPnu,
  type AddressPnuResolution,
} from '../ldong/lookup'
import type { LdongRefreshEnv } from '../ldong/refresh'
import { lookupApartmentOfficialPrice } from './apartment'
import type { OfficialPriceCache } from './cache'
import {
  realtyPriceClient,
  RealtyPriceClient,
  RealtySourceError,
  responseList,
} from './client'
import { lookupDetachedHouseOfficialPrice } from './detached-house'
import { noData, requiredText } from './normalize'
import { parsePnu, type NoticeDate } from './params'

const NOTICE_DATE_NAME_PATTERN =
  /(\d{4})년.*공시일자\s*:\s*(\d{4})\.(\d{2})\.(\d{2})/

interface OfficialPriceServiceDependencies {
  readonly client?: RealtyPriceClient
  readonly cache?: OfficialPriceCache
  readonly now?: () => number
  readonly resolvePnu?: typeof resolveAddressToPnu
}

function invalidRequest(key: string, message: string): OfficialPriceLookupResult {
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
  private readonly now: () => number
  private readonly resolvePnu: typeof resolveAddressToPnu
  private noticePromise: Promise<NoticeDate> | null = null

  constructor(dependencies: OfficialPriceServiceDependencies = {}) {
    this.client = dependencies.client ?? realtyPriceClient
    this.cache = dependencies.cache
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
      const resolution: AddressPnuResolution = request.pnu
        ? { status: 'found', pnu: request.pnu }
        : await this.resolvePnu(request.address, env, context)
      const resolutionFailure = this.handleResolution(request.key, resolution)
      if (resolutionFailure) return resolutionFailure

      const pnu = resolution.status === 'found' ? resolution.pnu : ''
      const parsedPnu = parsePnu(pnu)
      if (!parsedPnu) {
        return invalidRequest(request.key, 'PNU 형식이 올바르지 않습니다.')
      }

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

  private handleResolution(
    key: string,
    resolution: AddressPnuResolution,
  ): OfficialPriceLookupResult | null {
    if (resolution.status === 'noData') return noData(key, 'addressNotFound')
    if (resolution.status === 'found') return null
    return {
      key,
      status: 'failed',
      failure: {
        kind: 'sourceUnavailable',
        message: '법정동코드 캐시가 준비되지 않았습니다.',
        retryable: true,
      },
    }
  }

  private async latestNoticeDate(): Promise<NoticeDate> {
    if (!this.noticePromise) {
      this.noticePromise = this.loadLatestNoticeDate().catch((error) => {
        this.noticePromise = null
        throw error
      })
    }
    return this.noticePromise
  }

  private async loadLatestNoticeDate(): Promise<NoticeDate> {
    const currentYear = String(new Date(this.now()).getFullYear())
    const rows = responseList(await this.client.request(
      REALTY_PRICE_PATHS.noticeDates,
      { year: currentYear },
    ))
    const first = rows[0]
    if (!first) {
      throw new RealtySourceError(
        'invalidResponse',
        '공동주택 고시일자를 확인하지 못했습니다.',
        false,
      )
    }

    const code = requiredText(first, 'code', '고시일자 code')
    const name = requiredText(first, 'name', '고시일자 name')
    const match = NOTICE_DATE_NAME_PATTERN.exec(name)
    if (!match) {
      throw new RealtySourceError(
        'invalidResponse',
        '공동주택 고시일자 형식이 변경되었습니다.',
        false,
      )
    }
    return {
      code,
      year: match[1],
      publishedDate: `${match[2]}${match[3]}${match[4]}`,
    }
  }
}
