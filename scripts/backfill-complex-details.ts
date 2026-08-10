import { resolve } from 'node:path'
import { parseArgs } from 'node:util'

import {
  DetailRequestController,
  lookupComplexDetail,
  type ComplexDetailOutcome,
} from './lib/complex-detail-backfill.ts'
import { runConcurrentTasks } from './lib/concurrent-tasks.ts'
import {
  COMPLEX_DETAIL_ORDER,
  readComplexDetailProgress,
  readComplexDetailTargets,
  saveComplexDetailOutcomes,
} from './lib/d1-complex-detail.ts'
import type { D1Location } from './lib/d1.ts'
import { IngestionMetrics } from './lib/ingestion-metrics.ts'
import { writeJsonReport } from './lib/json-report.ts'

const DATA_GO_KR_SERVICE_KEY_ENV_NAME = 'DATA_GO_KR_SERVICE_KEY'
const DEFAULT_MAX_COMPLEXES = 7_500
const DEFAULT_MAX_API_ATTEMPTS = 7_500
const DEFAULT_CONCURRENCY = 4
const DETAIL_REQUEST_MINIMUM_INTERVAL_MS = 100
const D1_CHECKPOINT_BATCH_SIZE = 50
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
  outcomes: readonly ComplexDetailOutcome[],
): Readonly<Record<ComplexDetailOutcome['status'], number>> => ({
  filled: outcomes.filter((outcome) => outcome.status === 'filled').length,
  noDetail: outcomes.filter((outcome) => outcome.status === 'noDetail').length,
  responseError: outcomes.filter((outcome) => outcome.status === 'responseError').length,
  missingFields: outcomes.filter((outcome) => outcome.status === 'missingFields').length,
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
      'Usage: npm run backfill:complex-details -- --output <json> [--remote] [--max-complexes <count>] [--max-api-attempts <count>] [--concurrency <count>] [--retry-failed]',
    )
  }

  const serviceKey = process.env[DATA_GO_KR_SERVICE_KEY_ENV_NAME]
  if (!serviceKey) throw new Error(`Missing ${DATA_GO_KR_SERVICE_KEY_ENV_NAME}`)

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
  const before = await readComplexDetailProgress(
    location,
    metrics.recordD1Execution,
  )
  const targets = await readComplexDetailTargets(
    maxComplexes,
    retryFailed,
    location,
    metrics.recordD1Execution,
  )
  const requestController = new DetailRequestController({
    maxAttempts: maxApiAttempts,
    minimumIntervalMs: DETAIL_REQUEST_MINIMUM_INTERVAL_MS,
    recordPacingSleep: (durationMs) =>
      metrics.recordSleep('requestPacing', durationMs),
  })

  const lookedUpOutcomes: ComplexDetailOutcome[] = []
  const checkpointedOutcomes: ComplexDetailOutcome[] = []
  let budgetExhausted = false
  let fatalError: string | null = null
  try {
    for (
      let offset = 0;
      offset < targets.length && !budgetExhausted;
      offset += D1_CHECKPOINT_BATCH_SIZE
    ) {
      const batch = targets.slice(offset, offset + D1_CHECKPOINT_BATCH_SIZE)
      const results = await runConcurrentTasks({
        inputs: batch,
        concurrency,
        task: async (target) =>
          lookupComplexDetail({
            serviceKey,
            target,
            requestController,
            recordHttpAttempt: metrics.recordHttpAttempt,
            recordHttpRetry: metrics.recordHttpRetry,
            recordUnusableBackoff: (durationMs) =>
              metrics.recordSleep('unusableDetailBackoff', durationMs),
          }),
        shouldStop: (result) =>
          result.status === 'fulfilled' && result.value.kind === 'budgetExhausted',
      })
      const completed = results.flatMap((result) =>
        result.status === 'fulfilled' && result.value.kind === 'outcome'
          ? [result.value.outcome]
          : [],
      )
      lookedUpOutcomes.push(...completed)
      await saveComplexDetailOutcomes(
        completed,
        new Date().toISOString(),
        location,
        metrics.recordD1Execution,
      )
      checkpointedOutcomes.push(...completed)
      budgetExhausted = results.some(
        (result) =>
          result.status === 'fulfilled' && result.value.kind === 'budgetExhausted',
      )
      if (
        checkpointedOutcomes.length > 0 &&
        (checkpointedOutcomes.length % PROGRESS_INTERVAL === 0 || budgetExhausted)
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
    after = await readComplexDetailProgress(
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
    order: COMPLEX_DETAIL_ORDER,
    retryFailed,
    limits: { maxComplexes, maxApiAttempts, concurrency },
    selected: targets.length,
    lookedUp: lookedUpOutcomes.length,
    checkpointed: checkpointedOutcomes.length,
    apiAttempts: requestController.attempts,
    budgetExhausted,
    fatalError,
    outcomes: counts,
    failures: lookedUpOutcomes
      .filter((outcome) => outcome.status !== 'filled')
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
  console.error(`Complex detail backfill stopped: ${reason}`)
  process.exitCode = 1
})
