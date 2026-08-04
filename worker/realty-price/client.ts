import {
  REALTY_PRICE_APARTMENT_REFERER,
  REALTY_PRICE_ORIGIN,
} from '../config/external-apis'
import { DEFAULT_FETCHER } from '../http/fetch'

const REALTY_REQUEST_INTERVAL_MS = 260
const REALTY_REQUEST_TIMEOUT_MS = 10_000
const REALTY_RETRY_DELAYS_MS = [450, 1_000, 1_800] as const
const CAPTCHA_PATTERN = /(?:reCAPTCHA|captcha|capcha)/i
const JSON_CONTENT_PATTERN = /application\/(?:[\w.+-]*\+)?json/i
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (compatible; incometax-official-price/1.0)'

export type RealtyRow = Record<string, unknown>

interface RealtyModel {
  readonly list?: unknown
  readonly totalCnt?: unknown
  readonly total_cnt?: unknown
}

interface RealtyResponseEnvelope {
  readonly model?: RealtyModel
  readonly modelMap?: RealtyModel
}

export type RealtySourceFailureKind =
  | 'unavailable'
  | 'captcha'
  | 'invalidResponse'

export class RealtySourceError extends Error {
  readonly kind: RealtySourceFailureKind
  readonly retryable: boolean

  constructor(
    kind: RealtySourceFailureKind,
    message: string,
    retryable: boolean,
  ) {
    super(message)
    this.name = 'RealtySourceError'
    this.kind = kind
    this.retryable = retryable
  }
}

export interface RealtyClientDependencies {
  readonly fetcher?: typeof fetch
  readonly now?: () => number
  readonly sleep?: (milliseconds: number) => Promise<void>
}

const defaultSleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds))

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function containsCaptcha(value: unknown): boolean {
  if (typeof value === 'string') return CAPTCHA_PATTERN.test(value)
  if (Array.isArray(value)) return value.some(containsCaptcha)
  if (!isRecord(value)) return false

  return Object.entries(value).some(
    ([key, entry]) =>
      (CAPTCHA_PATTERN.test(key) && Boolean(entry)) || containsCaptcha(entry),
  )
}

function jsonContainsCaptcha(text: string): boolean {
  try {
    return containsCaptcha(JSON.parse(text))
  } catch {
    return false
  }
}

function parseEnvelope(text: string): RealtyResponseEnvelope {
  let payload: unknown
  try {
    payload = JSON.parse(text)
  } catch {
    if (CAPTCHA_PATTERN.test(text)) {
      throw new RealtySourceError(
        'captcha',
        '부동산공시가격알리미가 CAPTCHA 확인을 요구했습니다.',
        false,
      )
    }
    throw new RealtySourceError(
      'invalidResponse',
      '부동산공시가격알리미가 JSON이 아닌 응답을 반환했습니다.',
      false,
    )
  }

  if (containsCaptcha(payload)) {
    throw new RealtySourceError(
      'captcha',
      '부동산공시가격알리미가 CAPTCHA 확인을 요구했습니다.',
      false,
    )
  }
  if (!isRecord(payload)) {
    throw new RealtySourceError(
      'invalidResponse',
      '부동산공시가격알리미 응답 객체가 없습니다.',
      false,
    )
  }

  const model = isRecord(payload.model) ? payload.model : undefined
  const modelMap = isRecord(payload.modelMap) ? payload.modelMap : undefined
  if (!model && !modelMap) {
    throw new RealtySourceError(
      'invalidResponse',
      '부동산공시가격알리미 응답에 model/modelMap이 없습니다.',
      false,
    )
  }
  return { model, modelMap }
}

export function responseList(response: RealtyResponseEnvelope): RealtyRow[] {
  const list = response.model?.list ?? response.modelMap?.list
  if (list === undefined || list === null) return []
  if (!Array.isArray(list) || !list.every(isRecord)) {
    throw new RealtySourceError(
      'invalidResponse',
      '부동산공시가격알리미 list 형식이 변경되었습니다.',
      false,
    )
  }
  return list
}

function isRetryableStatus(status: number): boolean {
  return status === 400 || status === 429 || status >= 500
}

export class RealtyPriceClient {
  private readonly fetcher: typeof fetch
  private readonly now: () => number
  private readonly sleep: (milliseconds: number) => Promise<void>
  private queue: Promise<void> = Promise.resolve()
  private lastRequestStartedAt = Number.NEGATIVE_INFINITY

  constructor(dependencies: RealtyClientDependencies = {}) {
    this.fetcher = dependencies.fetcher ?? DEFAULT_FETCHER
    this.now = dependencies.now ?? Date.now
    this.sleep = dependencies.sleep ?? defaultSleep
  }

  request(
    path: string,
    params: Readonly<Record<string, string>>,
    referer = REALTY_PRICE_APARTMENT_REFERER,
  ): Promise<RealtyResponseEnvelope> {
    const scheduled = this.queue.then(() =>
      this.requestWithRetries(path, params, referer),
    )
    this.queue = scheduled.then(
      () => undefined,
      () => undefined,
    )
    return scheduled
  }

  private async pace(): Promise<void> {
    const elapsed = this.now() - this.lastRequestStartedAt
    if (elapsed < REALTY_REQUEST_INTERVAL_MS) {
      await this.sleep(REALTY_REQUEST_INTERVAL_MS - elapsed)
    }
    this.lastRequestStartedAt = this.now()
  }

  private async requestWithRetries(
    path: string,
    params: Readonly<Record<string, string>>,
    referer: string,
  ): Promise<RealtyResponseEnvelope> {
    const url = new URL(path, REALTY_PRICE_ORIGIN)
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }

    for (
      let attempt = 0;
      attempt <= REALTY_RETRY_DELAYS_MS.length;
      attempt += 1
    ) {
      await this.pace()
      const controller = new AbortController()
      const timeout = setTimeout(
        () => controller.abort(),
        REALTY_REQUEST_TIMEOUT_MS,
      )

      let response: Response
      try {
        response = await this.fetcher(url, {
          headers: {
            accept: 'application/json, text/javascript, */*; q=0.01',
            referer,
            'user-agent': BROWSER_USER_AGENT,
            'x-requested-with': 'XMLHttpRequest',
          },
          signal: controller.signal,
        })
      } catch (error) {
        clearTimeout(timeout)
        if (attempt === REALTY_RETRY_DELAYS_MS.length) {
          const detail = error instanceof Error ? error.message : '연결 실패'
          throw new RealtySourceError(
            'unavailable',
            `부동산공시가격알리미 연결 실패: ${detail}`,
            true,
          )
        }
        await this.sleep(REALTY_RETRY_DELAYS_MS[attempt])
        continue
      }

      clearTimeout(timeout)
      const text = await response.text()
      const contentType = response.headers.get('content-type') ?? ''
      const captchaDetected = CAPTCHA_PATTERN.test(text) && (
        !JSON_CONTENT_PATTERN.test(contentType) || jsonContainsCaptcha(text)
      )
      if (captchaDetected) {
        throw new RealtySourceError(
          'captcha',
          '부동산공시가격알리미가 CAPTCHA 확인을 요구했습니다.',
          false,
        )
      }

      if (response.ok) return parseEnvelope(text)

      if (
        !isRetryableStatus(response.status) ||
        attempt === REALTY_RETRY_DELAYS_MS.length
      ) {
        throw new RealtySourceError(
          'unavailable',
          `부동산공시가격알리미 ${path} HTTP ${response.status}`,
          isRetryableStatus(response.status),
        )
      }
      await this.sleep(REALTY_RETRY_DELAYS_MS[attempt])
    }

    throw new RealtySourceError(
      'unavailable',
      `부동산공시가격알리미 ${path} 요청 실패`,
      true,
    )
  }
}

export const realtyPriceClient = new RealtyPriceClient()
