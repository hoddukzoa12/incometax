import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'

import type {
  CompleteComplexListRecord,
  ComplexStagingRecord,
} from '../shared/complex.ts'
import {
  collectResumableKaptList,
  hasCompleteSearchLocation,
} from './lib/complex-list.ts'
import {
  evaluateComplexActivationReadiness,
  MAX_KAKAO_NOT_FOUND_RATIO,
  MAX_KAKAO_REJECTED_RATIO,
} from './lib/complex-activation.ts'
import { readKaptPage } from './lib/complex-source.ts'
import { runConcurrentTasks } from './lib/concurrent-tasks.ts'
import {
  activateStaging,
  clearStagedComplexes,
  type D1Location,
  readCompletedComplexLookupIds,
  readRefreshState,
  readRetryableComplexLookupIds,
  readStagedComplexIds,
  readStagingValidation,
  resetComplexListCheckpoint,
  saveComplexListPage,
  stageActiveComplexesForRetry,
  startRefresh,
  upsertComplexRecords,
} from './lib/d1-complex.ts'
import { IngestionMetrics } from './lib/ingestion-metrics.ts'
import { searchKakaoComplex } from './lib/kakao-complex-search.ts'
import { writeJsonReport } from './lib/json-report.ts'

const DATA_GO_KR_SERVICE_KEY_ENV_NAME = 'DATA_GO_KR_SERVICE_KEY'
const KAKAO_REST_API_KEY_ENV_NAME = 'KAKAO_REST_API_KEY'
const DEFAULT_KAKAO_LOOKUP_CONCURRENCY = 4
const PROGRESS_INTERVAL = 100
const D1_WRITE_INVOCATION_BATCH_SIZE = 5_000
const MAX_CONSECUTIVE_FAILURES = 3
const COVERAGE_GUARD_MIN_ATTEMPTS = 100

interface VerificationContract {
  readonly observedAt: string
  readonly totalCount: number
  readonly itemFields: readonly string[]
}

interface IngestionFailure {
  readonly complexId: string
  readonly reason: string
}

const parsePositiveInteger = (
  value: string | undefined,
  optionName: string,
): number | undefined => {
  if (value === undefined) return undefined
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${optionName} must be a positive integer`)
  }
  return parsed
}

const readVerificationContract = async (
  path: string,
): Promise<VerificationContract> => {
  const parsed: unknown = JSON.parse(await readFile(resolve(path), 'utf8'))
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('observedAt' in parsed) ||
    typeof parsed.observedAt !== 'string' ||
    !('kaptList' in parsed)
  ) {
    throw new TypeError('Verification summary is missing kaptList')
  }
  const kaptList = parsed.kaptList
  if (
    typeof kaptList !== 'object' ||
    kaptList === null ||
    !('pagination' in kaptList) ||
    !('itemFields' in kaptList) ||
    typeof kaptList.pagination !== 'object' ||
    kaptList.pagination === null ||
    !('totalCount' in kaptList.pagination) ||
    !Number.isInteger(kaptList.pagination.totalCount) ||
    !Array.isArray(kaptList.itemFields) ||
    !kaptList.itemFields.every((field) => typeof field === 'string')
  ) {
    throw new TypeError('Verification summary has an invalid kaptList contract')
  }
  return {
    observedAt: parsed.observedAt,
    totalCount: kaptList.pagination.totalCount as number,
    itemFields: kaptList.itemFields,
  }
}

const main = async (): Promise<void> => {
  const { values } = parseArgs({
    options: {
      verification: { type: 'string' },
      output: { type: 'string' },
      remote: { type: 'boolean', default: false },
      'max-lookups': { type: 'string' },
      'lookup-concurrency': { type: 'string' },
      'retry-failed': { type: 'boolean', default: false },
    },
    strict: true,
  })
  if (!values.verification || !values.output) {
    throw new Error(
      'Usage: npm run ingest:complexes -- --verification <summary.json> --output <json> [--max-lookups <count>] [--lookup-concurrency <count>] [--retry-failed]',
    )
  }

  const dataGoKrServiceKey = process.env[DATA_GO_KR_SERVICE_KEY_ENV_NAME]
  if (!dataGoKrServiceKey) {
    throw new Error(`Missing ${DATA_GO_KR_SERVICE_KEY_ENV_NAME}`)
  }
  const kakaoRestApiKey = process.env[KAKAO_REST_API_KEY_ENV_NAME]
  if (!kakaoRestApiKey) throw new Error(`Missing ${KAKAO_REST_API_KEY_ENV_NAME}`)

  const location: D1Location = values.remote ? 'remote' : 'local'
  const retryFailed = values['retry-failed']
  const maxLookups = parsePositiveInteger(values['max-lookups'], '--max-lookups')
  const lookupConcurrency =
    parsePositiveInteger(
      values['lookup-concurrency'],
      '--lookup-concurrency',
    ) ?? DEFAULT_KAKAO_LOOKUP_CONCURRENCY
  const metrics = new IngestionMetrics()
  const httpObserver = {
    recordAttempt: metrics.recordHttpAttempt,
    recordRetry: metrics.recordHttpRetry,
  }

  const verification = await readVerificationContract(values.verification)
  let refreshState = await readRefreshState(location, metrics.recordD1Execution)
  if (
    !refreshState ||
    refreshState.verification_observed_at !== verification.observedAt ||
    refreshState.expected_count !== verification.totalCount
  ) {
    await startRefresh(
      verification.observedAt,
      verification.totalCount,
      new Date().toISOString(),
      location,
      metrics.recordD1Execution,
    )
    refreshState = await readRefreshState(location, metrics.recordD1Execution)
  }
  if (!refreshState) throw new Error('Complex refresh state was not initialized')

  const collectList = async (
    checkpoint: typeof refreshState,
  ): ReturnType<typeof collectResumableKaptList> =>
    collectResumableKaptList({
      checkpoint: {
        nextPage: checkpoint.next_list_page,
        records: checkpoint.list_records,
        fields: checkpoint.list_fields,
      },
      expectedCount: verification.totalCount,
      expectedFields: verification.itemFields,
      readPage: async (page) =>
        readKaptPage(dataGoKrServiceKey, page, httpObserver),
      savePage: async ({ page, records, fields }) =>
        saveComplexListPage(
          page,
          records,
          fields,
          location,
          metrics.recordD1Execution,
        ),
    })

  let completedList = await collectList(refreshState)
  if (!completedList.records.every(hasCompleteSearchLocation)) {
    await resetComplexListCheckpoint(location, metrics.recordD1Execution)
    const resetState = await readRefreshState(
      location,
      metrics.recordD1Execution,
    )
    if (!resetState) throw new Error('Complex list checkpoint reset failed')
    completedList = await collectList(resetState)
  }
  if (!completedList.records.every(hasCompleteSearchLocation)) {
    throw new Error('K-apt list is missing Kakao search location fields')
  }
  const listRecords: readonly CompleteComplexListRecord[] = completedList.records
  const sourceIds = new Set(listRecords.map((record) => record.complexId))

  if (retryFailed) {
    await stageActiveComplexesForRetry(
      location,
      metrics.recordD1Execution,
    )
  }
  const stagedIds = await readStagedComplexIds(
    location,
    metrics.recordD1Execution,
  )
  if ([...stagedIds].some((id) => !sourceIds.has(id))) {
    if (retryFailed) {
      throw new Error('Active complex data contains IDs absent from the K-apt list')
    }
    await clearStagedComplexes(location, metrics.recordD1Execution)
  }
  const initialValidation = await readStagingValidation(
    location,
    metrics.recordD1Execution,
  )
  if (
    retryFailed &&
    initialValidation.total_count !== verification.totalCount
  ) {
    throw new Error(
      `Retry baseline count mismatch: ${initialValidation.total_count}/${verification.totalCount}`,
    )
  }

  const failures: IngestionFailure[] = []
  let lookups = 0
  let matched = 0
  let notFound = 0
  let rejected = 0
  let consecutiveFailures = 0
  let coverageGuardExceeded = false

  const selectedLookupIds = retryFailed
    ? await readRetryableComplexLookupIds(
        location,
        metrics.recordD1Execution,
      )
    : await readCompletedComplexLookupIds(
        location,
        metrics.recordD1Execution,
      )
  const pendingListRecords = listRecords.filter((record) =>
    retryFailed
      ? selectedLookupIds.has(record.complexId)
      : !selectedLookupIds.has(record.complexId),
  )
  const scheduledListRecords =
    maxLookups === undefined
      ? pendingListRecords
      : pendingListRecords.slice(0, maxLookups)
  const reachedLookupLimit =
    scheduledListRecords.length < pendingListRecords.length
  let stopLookups = false

  for (
    let offset = 0;
    offset < scheduledListRecords.length && !stopLookups;
    offset += D1_WRITE_INVOCATION_BATCH_SIZE
  ) {
    const batch = scheduledListRecords.slice(
      offset,
      offset + D1_WRITE_INVOCATION_BATCH_SIZE,
    )
    const results = await runConcurrentTasks({
      inputs: batch,
      concurrency: lookupConcurrency,
      task: async (listRecord) =>
        searchKakaoComplex(listRecord, kakaoRestApiKey, httpObserver),
      shouldStop: (result) => {
        lookups += 1
        if (result.status === 'fulfilled') {
          const record = result.value
          if (record.lookupStatus === 'matched') matched += 1
          else if (record.lookupStatus === 'notFound') notFound += 1
          else rejected += 1
          consecutiveFailures = 0
        } else {
          const failure = {
            complexId: result.input.complexId,
            reason:
              result.reason instanceof Error
                ? result.reason.message
                : String(result.reason),
          }
          failures.push(failure)
          consecutiveFailures += 1
          console.error(
            `Complex lookup failed: ${failure.complexId}: ${failure.reason}`,
          )
        }

        const completedThisRun = matched + notFound + rejected
        if (
          !retryFailed &&
          !coverageGuardExceeded &&
          completedThisRun >= COVERAGE_GUARD_MIN_ATTEMPTS &&
          notFound / completedThisRun > MAX_KAKAO_NOT_FOUND_RATIO
        ) {
          coverageGuardExceeded = true
          console.error(
            `Stopping because Kakao not-found ratio ${notFound}/${completedThisRun} exceeds ${MAX_KAKAO_NOT_FOUND_RATIO}`,
          )
        }
        if (lookups % PROGRESS_INTERVAL === 0) {
          console.log(
            `Looked up ${lookups}; matched=${matched}, rejected=${rejected}, notFound=${notFound}, failures=${failures.length}`,
          )
        }
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          stopLookups = true
          console.error(
            `Stopping after ${consecutiveFailures} consecutive failures; staged data remains resumable`,
          )
          return true
        }
        if (coverageGuardExceeded) stopLookups = true
        return coverageGuardExceeded
      },
    })
    const pendingWrites: ComplexStagingRecord[] = results.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    )
    await upsertComplexRecords(
      pendingWrites,
      new Date().toISOString(),
      location,
      metrics.recordD1Execution,
    )
    stopLookups ||= results.length < batch.length
  }

  const validation = await readStagingValidation(
    location,
    metrics.recordD1Execution,
  )
  const cumulativeNotFoundRatio =
    validation.total_count === 0
      ? 0
      : validation.not_found_count / validation.total_count
  const cumulativeRejectedRatio =
    validation.total_count === 0
      ? 0
      : validation.rejected_count / validation.total_count
  const cumulativeNotFoundGuardExceeded =
    cumulativeNotFoundRatio > MAX_KAKAO_NOT_FOUND_RATIO
  const completedThisRun = matched + notFound + rejected
  const retriedRejectedRatio =
    completedThisRun === 0 ? 0 : rejected / completedThisRun
  const rejectedGuardRatio = cumulativeRejectedRatio
  const rejectedGuardExceeded =
    rejectedGuardRatio > MAX_KAKAO_REJECTED_RATIO
  const activationReadiness = evaluateComplexActivationReadiness({
    expectedCount: verification.totalCount,
    validation,
    failedLookupCount: failures.length,
    coverageGuardExceeded,
  })
  const complete = activationReadiness.ready
  const failureReason =
    maxLookups === undefined && !activationReadiness.ready
      ? `${activationReadiness.reason}; activation was skipped`
      : null

  let activated = false
  if (maxLookups === undefined && activationReadiness.ready) {
    await activateStaging(
      activationReadiness,
      location,
      metrics.recordD1Execution,
    )
    activated = true
  }
  const performanceSummary = metrics.summary()
  const report = {
    sourceCount: verification.totalCount,
    failures,
    validation,
    lookup: {
      attempted: lookups,
      matched,
      rejected,
      notFound,
      maxLookups: maxLookups ?? null,
      concurrency: lookupConcurrency,
      retryFailed,
      reachedLookupLimit,
      coverageGuardExceeded,
      cumulativeNotFoundRatio,
      cumulativeNotFoundGuardExceeded,
      cumulativeRejectedRatio,
      retriedRejectedRatio,
      rejectedGuardRatio,
      rejectedGuardExceeded,
      complete,
      activated,
      cumulative: {
        matched: validation.matched_count,
        rejected: validation.rejected_count,
        notFound: validation.not_found_count,
        pending: validation.pending_count,
      },
      delta: {
        matched: validation.matched_count - initialValidation.matched_count,
        rejected: validation.rejected_count - initialValidation.rejected_count,
        notFound:
          validation.not_found_count - initialValidation.not_found_count,
        pending: validation.pending_count - initialValidation.pending_count,
      },
    },
    performance: performanceSummary,
  }
  await writeJsonReport(resolve(values.output), report)
  console.log(JSON.stringify(report, null, 2))

  if (failureReason !== null) throw new Error(failureReason)
}

await main().catch((error: unknown) => {
  const reason = error instanceof Error ? error.message : String(error)
  console.error(`Complex ingestion stopped cleanly: ${reason}`)
  process.exitCode = 1
})
