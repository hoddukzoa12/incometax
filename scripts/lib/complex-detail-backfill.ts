import type { ComplexDraft } from './complex-normalizer.ts'
import {
  KaptBasisNotFoundError,
  UnusableKaptBasisError,
} from './complex-normalizer.ts'
import { readComplexBasisDetail } from './complex-basis.ts'
import {
  NonRetryableRequestError,
  type HttpAttemptMeasurement,
  type HttpMetricsObserver,
  type HttpRetryMeasurement,
} from './http.ts'

export type ComplexDetailCheckpointStatus =
  | 'filled'
  | 'noDetail'
  | 'responseError'
  | 'missingFields'

export interface ComplexDetailTarget {
  readonly complexId: string
  readonly legalDongCode: string
}

export interface ComplexDetailOutcome {
  readonly complexId: string
  readonly status: ComplexDetailCheckpointStatus
  readonly approvalDate: string | null
  readonly buildingCount: number | null
  readonly householdCount: number | null
  readonly apiAttempts: number
  readonly reason: string | null
}

export type ComplexDetailLookupResult =
  | { readonly kind: 'outcome'; readonly outcome: ComplexDetailOutcome }
  | {
      readonly kind: 'budgetExhausted'
      readonly complexId: string
      readonly apiAttempts: 0
    }

export class DetailApiAttemptLimitError extends NonRetryableRequestError {
  constructor(limit: number) {
    super(`Detail API attempt limit reached: ${limit}`)
    this.name = 'DetailApiAttemptLimitError'
  }
}

interface DetailRequestControllerOptions {
  readonly maxAttempts: number
  readonly minimumIntervalMs: number
  readonly now?: () => number
  readonly delay?: (milliseconds: number) => Promise<void>
  readonly recordPacingSleep?: (durationMs: number) => void
}

const defaultDelay = async (milliseconds: number): Promise<void> => {
  await new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))
}

export class DetailRequestController {
  readonly #maxAttempts: number
  readonly #minimumIntervalMs: number
  readonly #now: () => number
  readonly #delay: (milliseconds: number) => Promise<void>
  readonly #recordPacingSleep?: (durationMs: number) => void
  #attempts = 0
  #nextStartAt = 0
  #queue: Promise<void> = Promise.resolve()

  constructor({
    maxAttempts,
    minimumIntervalMs,
    now = performance.now.bind(performance),
    delay = defaultDelay,
    recordPacingSleep,
  }: DetailRequestControllerOptions) {
    if (!Number.isInteger(maxAttempts) || maxAttempts <= 0) {
      throw new TypeError('maxAttempts must be a positive integer')
    }
    if (!Number.isFinite(minimumIntervalMs) || minimumIntervalMs < 0) {
      throw new TypeError('minimumIntervalMs must be non-negative')
    }
    this.#maxAttempts = maxAttempts
    this.#minimumIntervalMs = minimumIntervalMs
    this.#now = now
    this.#delay = delay
    this.#recordPacingSleep = recordPacingSleep
  }

  get attempts(): number {
    return this.#attempts
  }

  readonly beforeAttempt = async (): Promise<void> => {
    const scheduled = this.#queue.then(async () => {
      if (this.#attempts >= this.#maxAttempts) {
        throw new DetailApiAttemptLimitError(this.#maxAttempts)
      }
      const waitMs = Math.max(0, this.#nextStartAt - this.#now())
      if (waitMs > 0) {
        const startedAt = this.#now()
        await this.#delay(waitMs)
        this.#recordPacingSleep?.(this.#now() - startedAt)
      }
      this.#attempts += 1
      this.#nextStartAt = this.#now() + this.#minimumIntervalMs
    })
    this.#queue = scheduled.catch(() => undefined)
    await scheduled
  }
}

type ComplexDetailReader = (
  serviceKey: string,
  complexId: string,
  observer?: HttpMetricsObserver,
  recordBackoff?: (durationMs: number) => void,
) => Promise<ComplexDraft>

interface ComplexDetailLookupOptions {
  readonly serviceKey: string
  readonly target: ComplexDetailTarget
  readonly requestController: DetailRequestController
  readonly recordHttpAttempt: (measurement: HttpAttemptMeasurement) => void
  readonly recordHttpRetry: (measurement: HttpRetryMeasurement) => void
  readonly recordUnusableBackoff: (durationMs: number) => void
  readonly readDetail?: ComplexDetailReader
}

const findError = <ErrorType extends Error>(
  error: unknown,
  constructor: abstract new (...args: never[]) => ErrorType,
): ErrorType | null => {
  let current = error
  while (current instanceof Error) {
    if (current instanceof constructor) return current
    current = current.cause
  }
  return null
}

const MAXIMUM_CHECKPOINT_REASON_LENGTH = 1_000

const errorReason = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error)
  return message.slice(0, MAXIMUM_CHECKPOINT_REASON_LENGTH)
}

const failureOutcome = (
  complexId: string,
  error: unknown,
  apiAttempts: number,
): ComplexDetailOutcome => {
  const unusable = findError(error, UnusableKaptBasisError)
  if (unusable !== null) {
    return {
      complexId,
      status: 'missingFields',
      approvalDate: null,
      buildingCount: null,
      householdCount: null,
      apiAttempts,
      reason: unusable.fields.join(', '),
    }
  }
  if (findError(error, KaptBasisNotFoundError) !== null) {
    return {
      complexId,
      status: 'noDetail',
      approvalDate: null,
      buildingCount: null,
      householdCount: null,
      apiAttempts,
      reason: errorReason(error),
    }
  }
  return {
    complexId,
    status: 'responseError',
    approvalDate: null,
    buildingCount: null,
    householdCount: null,
    apiAttempts,
    reason: errorReason(error),
  }
}

export const lookupComplexDetail = async ({
  serviceKey,
  target,
  requestController,
  recordHttpAttempt,
  recordHttpRetry,
  recordUnusableBackoff,
  readDetail = readComplexBasisDetail,
}: ComplexDetailLookupOptions): Promise<ComplexDetailLookupResult> => {
  let apiAttempts = 0
  const observer: HttpMetricsObserver = {
    beforeAttempt: requestController.beforeAttempt,
    recordAttempt: (measurement) => {
      apiAttempts += 1
      recordHttpAttempt(measurement)
    },
    recordRetry: recordHttpRetry,
  }

  try {
    const detail = await readDetail(
      serviceKey,
      target.complexId,
      observer,
      recordUnusableBackoff,
    )
    if (detail.complexId !== target.complexId) {
      throw new Error(
        `K-apt basis response code mismatch: ${target.complexId} -> ${detail.complexId}`,
      )
    }
    if (detail.legalDongCode !== target.legalDongCode) {
      throw new Error(
        `K-apt basis legal dong mismatch: ${target.legalDongCode} -> ${detail.legalDongCode}`,
      )
    }
    return {
      kind: 'outcome',
      outcome: {
        complexId: target.complexId,
        status: 'filled',
        approvalDate: detail.approvalDate,
        buildingCount: detail.buildingCount,
        householdCount: detail.householdCount,
        apiAttempts,
        reason: null,
      },
    }
  } catch (error) {
    if (error instanceof DetailApiAttemptLimitError && apiAttempts === 0) {
      return { kind: 'budgetExhausted', complexId: target.complexId, apiAttempts: 0 }
    }
    return {
      kind: 'outcome',
      outcome: failureOutcome(target.complexId, error, apiAttempts),
    }
  }
}
