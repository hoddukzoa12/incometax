import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'

import {
  collectPages,
  readKaptBasis,
  readKaptPage,
  recordFields,
  requireString,
} from './lib/complex-source.ts'
import {
  type ComplexDraft,
  normalizeKaptBasisResponse,
} from './lib/complex-normalizer.ts'
import {
  type D1Location,
  readRefreshState,
  readStagedComplexIds,
  readStagingValidation,
  startRefresh,
  upsertComplexDrafts,
} from './lib/d1-complex.ts'
import { writeJsonReport } from './lib/json-report.ts'

const SERVICE_KEY_ENV_NAME = 'DATA_GO_KR_SERVICE_KEY'
const DETAIL_REQUEST_INTERVAL_MS = 100
const PROGRESS_INTERVAL = 100
const D1_WRITE_BATCH_SIZE = 50
const MAX_CONSECUTIVE_FAILURES = 3

interface VerificationContract {
  readonly observedAt: string
  readonly totalCount: number
  readonly itemFields: readonly string[]
}

interface IngestionFailure {
  readonly complexId: string
  readonly reason: string
}

const delay = async (milliseconds: number): Promise<void> => {
  await new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))
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

const sameFields = (actual: readonly string[], expected: readonly string[]): boolean =>
  actual.length === expected.length &&
  [...actual].sort().every((field, index) => field === [...expected].sort()[index])

const main = async (): Promise<void> => {
  const { values } = parseArgs({
    options: {
      verification: { type: 'string' },
      output: { type: 'string' },
      remote: { type: 'boolean', default: false },
    },
    strict: true,
  })
  if (!values.verification || !values.output) {
    throw new Error(
      'Usage: npm run ingest:complexes -- --verification <summary.json> --output <json>',
    )
  }

  const serviceKey = process.env[SERVICE_KEY_ENV_NAME]
  if (!serviceKey) throw new Error(`Missing ${SERVICE_KEY_ENV_NAME}`)
  const location: D1Location = values.remote ? 'remote' : 'local'

  const verification = await readVerificationContract(values.verification)
  const firstPage = await readKaptPage(serviceKey, 1)
  if (firstPage.totalCount !== verification.totalCount) {
    throw new Error(
      `Source count changed after verification: ${verification.totalCount} -> ${firstPage.totalCount}`,
    )
  }
  const listRecords = await collectPages(
    firstPage.items,
    firstPage.totalCount,
    async (page) => (await readKaptPage(serviceKey, page)).items,
  )
  if (!sameFields(recordFields(listRecords), verification.itemFields)) {
    throw new Error('K-apt list fields changed after verification')
  }
  const sourceIds = new Set(
    listRecords.map((record, index) =>
      requireString(record.kaptCode, `items[${index}].kaptCode`),
    ),
  )
  if (sourceIds.size !== listRecords.length) {
    throw new Error(
      `K-apt list contains duplicate complex codes: ${listRecords.length - sourceIds.size}`,
    )
  }
  const refreshState = await readRefreshState(location)
  let stagedIds = await readStagedComplexIds(location)
  const hasStaleStaging = [...stagedIds].some((id) => !sourceIds.has(id))
  if (
    refreshState?.verification_observed_at !== verification.observedAt ||
    refreshState.expected_count !== verification.totalCount ||
    hasStaleStaging
  ) {
    await startRefresh(
      verification.observedAt,
      verification.totalCount,
      new Date().toISOString(),
      location,
    )
    stagedIds = new Set()
  }

  const pendingWrites: ComplexDraft[] = []
  const failures: IngestionFailure[] = []
  let fetched = 0
  let consecutiveFailures = 0

  for (const [index, listRecord] of listRecords.entries()) {
    let complexId = `record-${index}`
    try {
      complexId = requireString(listRecord.kaptCode, `items[${index}].kaptCode`)
      if (stagedIds.has(complexId)) continue
      const detail = normalizeKaptBasisResponse(
        await readKaptBasis(serviceKey, complexId),
      )
      if (detail.complexId !== complexId) {
        throw new Error(`K-apt basis response code mismatch: ${detail.complexId}`)
      }
      const listedLegalDongCode = requireString(
        listRecord.bjdCode,
        `items[${index}].bjdCode`,
      )
      if (detail.legalDongCode !== listedLegalDongCode) {
        throw new Error(
          `K-apt basis legal dong mismatch: ${listedLegalDongCode} -> ${detail.legalDongCode}`,
        )
      }
      pendingWrites.push(detail)
      fetched += 1
      consecutiveFailures = 0
      if (pendingWrites.length >= D1_WRITE_BATCH_SIZE) {
        await upsertComplexDrafts(
          pendingWrites,
          new Date().toISOString(),
          location,
        )
        pendingWrites.length = 0
      }
    } catch (error) {
      const failure = {
        complexId,
        reason: error instanceof Error ? error.message : String(error),
      }
      failures.push(failure)
      consecutiveFailures += 1
      console.error(`Complex ingestion failed: ${failure.complexId}: ${failure.reason}`)
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.error(
          `Stopping after ${consecutiveFailures} consecutive failures; staged data remains resumable`,
        )
        break
      }
    }

    if ((index + 1) % PROGRESS_INTERVAL === 0) {
      console.log(
        `Fetched ${index + 1}/${listRecords.length}; failures=${failures.length}`,
      )
    }
    if (index < listRecords.length - 1) {
      await delay(DETAIL_REQUEST_INTERVAL_MS)
    }
  }

  await upsertComplexDrafts(
    pendingWrites,
    new Date().toISOString(),
    location,
  )

  const outputPath = resolve(values.output)
  const validation = await readStagingValidation(location)
  await writeJsonReport(outputPath, { fetched, failures, validation })
  console.log(
    JSON.stringify(
      {
        sourceCount: listRecords.length,
        fetched,
        staged: validation.total_count,
        failures: failures.length,
      },
      null,
      2,
    ),
  )

  if (
    failures.length > 0 ||
    validation.total_count !== verification.totalCount
  ) {
    throw new Error(
      'Complex ingestion is incomplete; D1 replacement must not run with this output',
    )
  }
}

await main()
