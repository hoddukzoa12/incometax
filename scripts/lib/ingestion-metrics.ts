import type {
  HttpAttemptMeasurement,
  HttpRetryMeasurement,
} from './http.ts'
import type { D1ExecutionMeasurement } from './d1.ts'

export type IngestionSleepKind =
  | 'requestPacing'
  | 'httpBackoff'
  | 'unusableDetailBackoff'

interface DurationSummary {
  readonly count: number
  readonly p50: number
  readonly p95: number
  readonly max: number
}

export interface IngestionMetricsSummary {
  readonly wallClockMs: number
  readonly requestLatencyMs: DurationSummary
  readonly httpStatusDistribution: Readonly<Record<string, number>>
  readonly transportFailureDistribution: Readonly<Record<string, number>>
  readonly retries: {
    readonly count: number
    readonly reasonDistribution: Readonly<Record<string, number>>
    readonly scheduledBackoffMs: number
    readonly actualBackoffSleepMs: number
    readonly retryAfterHonoredCount: number
  }
  readonly throttleRetryAfterHeaders: {
    readonly present: number
    readonly absent: number
    readonly valueDistribution: Readonly<Record<string, number>>
  }
  readonly timingMs: {
    readonly apiAttempts: number
    readonly d1Reads: number
    readonly d1Writes: number
    readonly requestPacingSleep: number
    readonly httpBackoffSleep: number
    readonly unusableDetailBackoffSleep: number
  }
  readonly d1Invocations: {
    readonly reads: number
    readonly writes: number
  }
}

const increment = (counts: Map<string, number>, key: string): void => {
  counts.set(key, (counts.get(key) ?? 0) + 1)
}

const toRecord = (counts: Map<string, number>): Readonly<Record<string, number>> =>
  Object.fromEntries([...counts.entries()].sort(([left], [right]) =>
    left.localeCompare(right, 'en', { numeric: true }),
  ))

const percentile = (sorted: readonly number[], ratio: number): number => {
  if (sorted.length === 0) return 0
  const index = Math.max(0, Math.ceil(sorted.length * ratio) - 1)
  return sorted[index] ?? 0
}

const summarizeDurations = (durations: readonly number[]): DurationSummary => {
  const sorted = [...durations].sort((left, right) => left - right)
  return {
    count: sorted.length,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    max: sorted.at(-1) ?? 0,
  }
}

export class IngestionMetrics {
  readonly #startedAtMs: number
  readonly #now: () => number
  readonly #requestLatencies: number[] = []
  readonly #httpStatuses = new Map<string, number>()
  readonly #transportFailures = new Map<string, number>()
  readonly #retryReasons = new Map<string, number>()
  readonly #retryAfterValues = new Map<string, number>()
  readonly #sleepDurations: Record<IngestionSleepKind, number> = {
    requestPacing: 0,
    httpBackoff: 0,
    unusableDetailBackoff: 0,
  }
  readonly #d1Durations = { read: 0, write: 0 }
  readonly #d1Invocations = { read: 0, write: 0 }
  #scheduledRetryBackoffMs = 0
  #throttleRetryAfterPresent = 0
  #throttleRetryAfterAbsent = 0
  #retryAfterHonoredCount = 0

  constructor(now: () => number = performance.now.bind(performance)) {
    this.#now = now
    this.#startedAtMs = now()
  }

  readonly recordHttpAttempt = (measurement: HttpAttemptMeasurement): void => {
    this.#requestLatencies.push(measurement.durationMs)
    if (measurement.status === null) {
      increment(this.#transportFailures, measurement.outcome)
      return
    }
    increment(this.#httpStatuses, String(measurement.status))
    if (measurement.status === 429) {
      if (measurement.retryAfter === null) {
        this.#throttleRetryAfterAbsent += 1
      } else {
        this.#throttleRetryAfterPresent += 1
        increment(this.#retryAfterValues, measurement.retryAfter)
      }
    }
  }

  readonly recordHttpRetry = (measurement: HttpRetryMeasurement): void => {
    increment(this.#retryReasons, measurement.reason)
    this.#scheduledRetryBackoffMs += measurement.scheduledDelayMs
    this.#sleepDurations.httpBackoff += measurement.actualDelayMs
    if (measurement.delaySource === 'retryAfter') {
      this.#retryAfterHonoredCount += 1
    }
  }

  readonly recordD1Execution = (measurement: D1ExecutionMeasurement): void => {
    this.#d1Durations[measurement.operation] += measurement.durationMs
    this.#d1Invocations[measurement.operation] += 1
  }

  recordSleep(kind: Exclude<IngestionSleepKind, 'httpBackoff'>, durationMs: number): void {
    this.#sleepDurations[kind] += durationMs
  }

  summary(): IngestionMetricsSummary {
    const retryCount = [...this.#retryReasons.values()].reduce(
      (total, count) => total + count,
      0,
    )
    const apiAttempts = this.#requestLatencies.reduce(
      (total, duration) => total + duration,
      0,
    )
    return {
      wallClockMs: this.#now() - this.#startedAtMs,
      requestLatencyMs: summarizeDurations(this.#requestLatencies),
      httpStatusDistribution: toRecord(this.#httpStatuses),
      transportFailureDistribution: toRecord(this.#transportFailures),
      retries: {
        count: retryCount,
        reasonDistribution: toRecord(this.#retryReasons),
        scheduledBackoffMs: this.#scheduledRetryBackoffMs,
        actualBackoffSleepMs: this.#sleepDurations.httpBackoff,
        retryAfterHonoredCount: this.#retryAfterHonoredCount,
      },
      throttleRetryAfterHeaders: {
        present: this.#throttleRetryAfterPresent,
        absent: this.#throttleRetryAfterAbsent,
        valueDistribution: toRecord(this.#retryAfterValues),
      },
      timingMs: {
        apiAttempts,
        d1Reads: this.#d1Durations.read,
        d1Writes: this.#d1Durations.write,
        requestPacingSleep: this.#sleepDurations.requestPacing,
        httpBackoffSleep: this.#sleepDurations.httpBackoff,
        unusableDetailBackoffSleep:
          this.#sleepDurations.unusableDetailBackoff,
      },
      d1Invocations: {
        reads: this.#d1Invocations.read,
        writes: this.#d1Invocations.write,
      },
    }
  }
}
