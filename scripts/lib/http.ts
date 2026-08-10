const REQUEST_TIMEOUT_MS = 15_000
const OUTAGE_MAX_RETRIES = 10
const OUTAGE_RETRY_BASE_DELAY_MS = 1_000
const OUTAGE_RETRY_MAX_DELAY_MS = 30_000
const THROTTLE_MAX_RETRIES = 20
const THROTTLE_RETRY_BASE_DELAY_MS = 1_000
const THROTTLE_RETRY_MAX_DELAY_MS = 2_000
const RETRY_JITTER_RATIO = 0.25

// 2026-08-04 측정에서 K-apt 목록 API는 요청당 60초 동안 무응답인 상태가 수 분간
// 이어졌다. 15초 타임아웃과 10회 재시도, 1/2/4/8/16/30초(이후 30초 상한)
// 지수 백오프는 음의 지터가 연속되어도 약 5분의 타임아웃 장애를 버틴다.
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504])

export class HttpResponseError extends Error {
  readonly status: number
  readonly responseBody: string

  constructor(status: number, statusText: string, responseBody: string) {
    super(`HTTP ${status} ${statusText}: ${responseBody}`)
    this.name = 'HttpResponseError'
    this.status = status
    this.responseBody = responseBody
  }
}

export class HttpRequestError extends Error {
  readonly attempts: number

  constructor(attempts: number, cause: unknown) {
    const reason = cause instanceof Error ? cause.message : String(cause)
    super(`HTTP request failed after ${attempts} attempts: ${reason}`, { cause })
    this.name = 'HttpRequestError'
    this.attempts = attempts
  }
}

export class NonRetryableRequestError extends Error {}

interface HttpDependencies {
  readonly fetch: typeof globalThis.fetch
  readonly delay: (milliseconds: number) => Promise<void>
  readonly random: () => number
  readonly timeoutSignal: (milliseconds: number) => AbortSignal
  readonly now: () => number
  readonly wallClockNow: () => number
  readonly observer?: HttpMetricsObserver
}

export type HttpAttemptOutcome = 'response' | 'timeout' | 'networkError'

export interface HttpAttemptMeasurement {
  readonly durationMs: number
  readonly status: number | null
  readonly outcome: HttpAttemptOutcome
  readonly retryAfter: string | null
}

export type HttpRetryReason =
  | `http:${number}`
  | 'timeout'
  | 'networkError'
  | 'parseError'

export interface HttpRetryMeasurement {
  readonly reason: HttpRetryReason
  readonly scheduledDelayMs: number
  readonly actualDelayMs: number
  readonly delaySource: 'policy' | 'retryAfter'
}

export interface HttpMetricsObserver {
  readonly beforeAttempt?: () => void | Promise<void>
  readonly recordAttempt: (measurement: HttpAttemptMeasurement) => void
  readonly recordRetry: (measurement: HttpRetryMeasurement) => void
}

type ResponseParser<T> = (response: Response) => Promise<T>

const delay = async (milliseconds: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, milliseconds))
}

const exponentialRetryDelay = (
  retry: number,
  baseDelayMs: number,
  maxDelayMs: number,
  random: () => number,
): number => {
  const exponentialDelay = Math.min(
    baseDelayMs * 2 ** retry,
    maxDelayMs,
  )
  const jitterRange = exponentialDelay * RETRY_JITTER_RATIO
  return Math.round(
    exponentialDelay - jitterRange + random() * jitterRange * 2,
  )
}

const retryAfterDelay = (
  header: string | null,
  wallClockNow: () => number,
): number | null => {
  if (header === null) return null
  const trimmed = header.trim()
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1_000
  const resetAt = Date.parse(trimmed)
  if (Number.isNaN(resetAt)) return null
  return Math.max(0, resetAt - wallClockNow())
}

const isTimeoutError = (error: unknown): boolean =>
  error instanceof Error &&
  (error.name === 'TimeoutError' || error.name === 'AbortError')

const retryReason = (
  error: unknown,
  status: number | null,
): HttpRetryReason => {
  if (error instanceof HttpResponseError) return `http:${error.status}`
  if (isTimeoutError(error)) return 'timeout'
  if (status !== null) return 'parseError'
  return 'networkError'
}

const fetchParsedResponse = async <T>(
  url: URL,
  accept: string,
  parse: ResponseParser<T>,
  init: Omit<RequestInit, 'signal'> = {},
  dependencyOverrides: Partial<HttpDependencies> = {},
): Promise<T> => {
  const dependencies: HttpDependencies = {
    fetch: globalThis.fetch,
    delay,
    random: Math.random,
    timeoutSignal: AbortSignal.timeout,
    now: performance.now.bind(performance),
    wallClockNow: Date.now,
    ...dependencyOverrides,
  }
  let lastError: unknown
  let attempts = 0
  let outageRetries = 0
  let throttleRetries = 0

  while (true) {
    await dependencies.observer?.beforeAttempt?.()
    attempts += 1
    const attemptStartedAt = dependencies.now()
    let attemptStatus: number | null = null
    let attemptOutcome: HttpAttemptOutcome = 'networkError'
    let retryAfter: string | null = null
    try {
      const headers = new Headers(init.headers)
      headers.set('accept', accept)
      const response = await dependencies.fetch(url, {
        ...init,
        headers,
        signal: dependencies.timeoutSignal(REQUEST_TIMEOUT_MS),
      })
      attemptStatus = response.status
      attemptOutcome = 'response'
      retryAfter = response.headers.get('retry-after')

      if (!response.ok) {
        const responseBody = await response.text()
        const error = new HttpResponseError(
          response.status,
          response.statusText,
          responseBody,
        )

        if (!RETRYABLE_STATUS_CODES.has(response.status)) {
          throw error
        }

        lastError = error
      } else {
        return await parse(response)
      }
    } catch (error) {
      if (isTimeoutError(error)) attemptOutcome = 'timeout'
      if (error instanceof NonRetryableRequestError) throw error
      if (
        error instanceof HttpResponseError &&
        !RETRYABLE_STATUS_CODES.has(error.status)
      ) {
        throw error
      }
      lastError = error
    } finally {
      dependencies.observer?.recordAttempt({
        durationMs: dependencies.now() - attemptStartedAt,
        status: attemptStatus,
        outcome: attemptOutcome,
        retryAfter,
      })
    }

    const reason = retryReason(lastError, attemptStatus)
    const isThrottle = reason === 'http:429'
    const retry = isThrottle ? throttleRetries : outageRetries
    const maxRetries = isThrottle
      ? THROTTLE_MAX_RETRIES
      : OUTAGE_MAX_RETRIES
    if (retry >= maxRetries) break

    const serverDelayMs = isThrottle
      ? retryAfterDelay(retryAfter, dependencies.wallClockNow)
      : null
    const scheduledDelayMs =
      serverDelayMs ??
      exponentialRetryDelay(
        retry,
        isThrottle
          ? THROTTLE_RETRY_BASE_DELAY_MS
          : OUTAGE_RETRY_BASE_DELAY_MS,
        isThrottle
          ? THROTTLE_RETRY_MAX_DELAY_MS
          : OUTAGE_RETRY_MAX_DELAY_MS,
        dependencies.random,
      )
    const delayStartedAt = dependencies.now()
    await dependencies.delay(scheduledDelayMs)
    dependencies.observer?.recordRetry({
      reason,
      scheduledDelayMs,
      actualDelayMs: dependencies.now() - delayStartedAt,
      delaySource: serverDelayMs === null ? 'policy' : 'retryAfter',
    })
    if (isThrottle) throttleRetries += 1
    else outageRetries += 1
  }

  throw new HttpRequestError(attempts, lastError)
}

export const fetchParsedJson = async <T>(
  url: URL,
  parse: (value: unknown) => T,
  init: Omit<RequestInit, 'signal'> = {},
  dependencyOverrides: Partial<HttpDependencies> = {},
): Promise<T> =>
  fetchParsedResponse(
    url,
    'application/json',
    async (response) => parse((await response.json()) as unknown),
    init,
    dependencyOverrides,
  )

export const fetchJson = async (
  url: URL,
  init: Omit<RequestInit, 'signal'> = {},
  dependencyOverrides: Partial<HttpDependencies> = {},
): Promise<unknown> =>
  fetchParsedJson(url, (value) => value, init, dependencyOverrides)

export const fetchText = async (
  url: URL,
  init: Omit<RequestInit, 'signal'> = {},
  dependencyOverrides: Partial<HttpDependencies> = {},
): Promise<string> =>
  fetchParsedText(url, (value) => value, init, dependencyOverrides)

export const fetchParsedText = async <T>(
  url: URL,
  parse: (value: string) => T,
  init: Omit<RequestInit, 'signal'> = {},
  dependencyOverrides: Partial<HttpDependencies> = {},
): Promise<T> =>
  fetchParsedResponse(
    url,
    'application/xml,text/xml,*/*',
    async (response) => parse(await response.text()),
    init,
    dependencyOverrides,
  )
