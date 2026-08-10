import { resolve } from 'node:path'
import { parseArgs } from 'node:util'

import {
  lookupComplexPlaceUrl,
  type ComplexPlaceUrlOutcome,
} from './lib/complex-place-url-backfill.ts'
import { DetailRequestController } from './lib/complex-detail-backfill.ts'
import { runConcurrentTasks } from './lib/concurrent-tasks.ts'
import {
  COMPLEX_PLACE_URL_ORDER,
  readComplexPlaceUrlProgress,
  readComplexPlaceUrlTargets,
  saveComplexPlaceUrlOutcomes,
} from './lib/d1-complex-place-url.ts'
import type { D1Location } from './lib/d1.ts'
import { IngestionMetrics } from './lib/ingestion-metrics.ts'
import { writeJsonReport } from './lib/json-report.ts'

const KAKAO_REST_API_KEY_ENV_NAME = 'KAKAO_REST_API_KEY'
const DEFAULT_MAX_COMPLEXES = 25_000
const DEFAULT_MAX_API_ATTEMPTS = 25_000
const DEFAULT_CONCURRENCY = 4
const KAKAO_REQUEST_MINIMUM_INTERVAL_MS = 25
const D1_CHECKPOINT_BATCH_SIZE = 200
const PROGRESS_INTERVAL = 100

const parsePositiveInteger = (
  value: string | undefined,
  optionName: string,
  defaultValue: number,
): number => {
  if (value === undefined) return defaultValue
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${optionName} must be a positive integer`)
  }
  return parsed
}

const countOutcomes = (
  outcomes: readonly ComplexPlaceUrlOutcome[],
): Readonly<Record<ComplexPlaceUrlOutcome['status'], number>> => ({
  filled: outcomes.filter((entry) => entry.status === 'filled').length,
  noResult: outcomes.filter((entry) => entry.status === 'noResult').length,
  tooFar: outcomes.filter((entry) => entry.status === 'tooFar').length,
  candidateMismatch: outcomes.filter(
    (entry) => entry.status === 'candidateMismatch',
  ).length,
  missingCoordinates: outcomes.filter(
    (entry) => entry.status === 'missingCoordinates',
  ).length,
  responseError: outcomes.filter(
    (entry) => entry.status === 'responseError',
  ).length,
})

const main = async (): Promise<void> => {
  const { values } = parseArgs({
    options: {
      output: { type: 'string' },
      remote: { type: 'boolean', default: false },
      'max-complexes': { type: 'string' },
      'max-api-attempts': { type: 'string' },
      concurrency: { type: 'string' },
      'retry-failed': { type: 'boolean', default: false },
    },
    strict: true,
  })
  if (!values.output) {
    throw new Error(
      'Usage: npm run backfill:complex-place-urls -- --output <json> [--remote] [--max-complexes <count>] [--max-api-attempts <count>] [--concurrency <count>] [--retry-failed]',
    )
  }

  const restApiKey = process.env[KAKAO_REST_API_KEY_ENV_NAME]
  if (!restApiKey) throw new Error(`Missing ${KAKAO_REST_API_KEY_ENV_NAME}`)

  const maxComplexes = parsePositiveInteger(
    values['max-complexes'],
    '--max-complexes',
    DEFAULT_MAX_COMPLEXES,
  )
  const maxApiAttempts = parsePositiveInteger(
    values['max-api-attempts'],
    '--max-api-attempts',
    DEFAULT_MAX_API_ATTEMPTS,
  )
  const concurrency = parsePositiveInteger(
    values.concurrency,
    '--concurrency',
    DEFAULT_CONCURRENCY,
  )
  const retryFailed = values['retry-failed']
  const location: D1Location = values.remote ? 'remote' : 'local'
  const metrics = new IngestionMetrics()
  const startedAt = new Date().toISOString()
  const before = await readComplexPlaceUrlProgress(
    location,
    metrics.recordD1Execution,
  )
  const targets = await readComplexPlaceUrlTargets(
    maxComplexes,
    retryFailed,
    location,
    metrics.recordD1Execution,
  )
  const requestController = new DetailRequestController({
    maxAttempts: maxApiAttempts,
    minimumIntervalMs: KAKAO_REQUEST_MINIMUM_INTERVAL_MS,
    recordPacingSleep: (durationMs) =>
      metrics.recordSleep('requestPacing', durationMs),
  })

  const lookedUpOutcomes: ComplexPlaceUrlOutcome[] = []
  const checkpointedOutcomes: ComplexPlaceUrlOutcome[] = []
  let budgetExhausted = false
  let quotaExceeded = false
  let quotaError: string | null = null
  let fatalError: string | null = null
  try {
    for (
      let offset = 0;
      offset < targets.length && !budgetExhausted && !quotaExceeded;
      offset += D1_CHECKPOINT_BATCH_SIZE
    ) {
      const batch = targets.slice(offset, offset + D1_CHECKPOINT_BATCH_SIZE)
      const results = await runConcurrentTasks({
        inputs: batch,
        concurrency,
        task: async (target) =>
          lookupComplexPlaceUrl({
            restApiKey,
            target,
            requestController,
            recordHttpAttempt: metrics.recordHttpAttempt,
            recordHttpRetry: metrics.recordHttpRetry,
          }),
        shouldStop: (result) =>
          result.status === 'fulfilled' && result.value.kind !== 'outcome',
      })
      const completed = results.flatMap((result) =>
        result.status === 'fulfilled' && result.value.kind === 'outcome'
          ? [result.value.outcome]
          : [],
      )
      lookedUpOutcomes.push(...completed)
      await saveComplexPlaceUrlOutcomes(
        completed,
        new Date().toISOString(),
        location,
        metrics.recordD1Execution,
      )
      checkpointedOutcomes.push(...completed)
      budgetExhausted = results.some(
        (result) =>
          result.status === 'fulfilled' &&
          result.value.kind === 'budgetExhausted',
      )
      const quotaResult = results.find(
        (result) =>
          result.status === 'fulfilled' &&
          result.value.kind === 'quotaExceeded',
      )
      quotaExceeded = quotaResult !== undefined
      quotaError =
        quotaResult?.status === 'fulfilled' &&
        quotaResult.value.kind === 'quotaExceeded'
          ? quotaResult.value.reason
          : null
      if (
        checkpointedOutcomes.length > 0 &&
        (checkpointedOutcomes.length % PROGRESS_INTERVAL === 0 ||
          budgetExhausted || quotaExceeded)
      ) {
        console.log(
          `Checkpointed ${checkpointedOutcomes.length}/${targets.length}; API attempts=${requestController.attempts}`,
        )
      }
    }
  } catch (error) {
    fatalError = error instanceof Error ? error.message : String(error)
  }

  let after = null
  let progressReadError: string | null = null
  try {
    after = await readComplexPlaceUrlProgress(
      location,
      metrics.recordD1Execution,
    )
  } catch (error) {
    progressReadError = error instanceof Error ? error.message : String(error)
  }
  const counts = countOutcomes(lookedUpOutcomes)
  const completedAt = new Date().toISOString()
  const report = {
    startedAt,
    completedAt,
    location,
    order: COMPLEX_PLACE_URL_ORDER,
    retryFailed,
    limits: { maxComplexes, maxApiAttempts, concurrency },
    selected: targets.length,
    lookedUp: lookedUpOutcomes.length,
    checkpointed: checkpointedOutcomes.length,
    apiAttempts: requestController.attempts,
    budgetExhausted,
    quotaExceeded,
    quotaError,
    fatalError,
    outcomes: counts,
    failures: lookedUpOutcomes
      .filter((entry) => entry.status !== 'filled')
      .map(({ complexId, status, apiAttempts, reason }) => ({
        complexId,
        status,
        apiAttempts,
        reason,
      })),
    before,
    after,
    progressReadError,
    performance: metrics.summary(),
  }
  await writeJsonReport(resolve(values.output), report)
  console.log(JSON.stringify(report, null, 2))
  if (fatalError !== null) throw new Error(fatalError)
}

await main().catch((error: unknown) => {
  const reason = error instanceof Error ? error.message : String(error)
  console.error(`Complex place URL backfill stopped: ${reason}`)
  process.exitCode = 1
})
