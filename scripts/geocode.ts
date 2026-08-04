import { resolve } from 'node:path'
import { parseArgs } from 'node:util'

import {
  activateStaging,
  type D1Location,
  readRefreshState,
  readStagedAddresses,
  readStagingValidation,
  updateGeocodedComplexes,
} from './lib/d1-complex.ts'
import {
  geocodeAddress,
  type GeocodingResult,
} from './lib/kakao-geocoder.ts'
import { writeJsonReport } from './lib/json-report.ts'

const KAKAO_REST_KEY_ENV_NAME = 'KAKAO_REST_API_KEY'
const REQUEST_INTERVAL_MS = 100
const D1_WRITE_BATCH_SIZE = 50
const PROGRESS_INTERVAL = 100
const MAX_CONSECUTIVE_REQUEST_FAILURES = 3

const delay = async (milliseconds: number): Promise<void> => {
  await new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))
}

const requiredRegionsPresent = (validation: {
  readonly seoul_count: number
  readonly busan_count: number
  readonly gyeonggi_count: number
  readonly jeju_count: number
}): boolean =>
  validation.seoul_count > 0 &&
  validation.busan_count > 0 &&
  validation.gyeonggi_count > 0 &&
  validation.jeju_count > 0

const main = async (): Promise<void> => {
  const { values } = parseArgs({
    options: {
      output: { type: 'string' },
      remote: { type: 'boolean', default: false },
    },
    strict: true,
  })

  if (!values.output) {
    throw new Error(
      'Usage: npm run geocode:complexes -- --output <report.json> [--remote]',
    )
  }

  const restApiKey = process.env[KAKAO_REST_KEY_ENV_NAME]
  if (!restApiKey) throw new Error(`Missing ${KAKAO_REST_KEY_ENV_NAME}`)
  const location: D1Location = values.remote ? 'remote' : 'local'
  const refreshState = await readRefreshState(location)
  if (!refreshState) {
    throw new Error('No verified complex refresh is staged')
  }
  const expectedStagedCount =
    refreshState.expected_count - refreshState.exclusions.length

  const inputs = await readStagedAddresses(location)
  const results: GeocodingResult[] = []
  const pendingWrites: GeocodingResult[] = []
  let consecutiveRequestFailures = 0
  console.log(`Geocoding ${inputs.length} staged complex records (batch only)`)

  for (const [index, input] of inputs.entries()) {
    let result = await geocodeAddress(
      { complexId: input.complex_id, address: input.primary_address },
      restApiKey,
    )
    if (result.status === 'notFound' && input.fallback_address !== null) {
      await delay(REQUEST_INTERVAL_MS)
      result = await geocodeAddress(
        { complexId: input.complex_id, address: input.fallback_address },
        restApiKey,
      )
    }
    results.push(result)
    pendingWrites.push(result)

    if (result.status === 'failed') {
      consecutiveRequestFailures += 1
    } else {
      consecutiveRequestFailures = 0
    }

    if (result.status !== 'success') {
      const reason = result.status === 'failed' ? result.reason : 'not found'
      console.error(
        `Geocoding ${result.status}: ${result.complexId} (${result.sourceAddress}): ${reason}`,
      )
    }
    if (pendingWrites.length >= D1_WRITE_BATCH_SIZE) {
      await updateGeocodedComplexes(pendingWrites, location)
      pendingWrites.length = 0
    }
    if (consecutiveRequestFailures >= MAX_CONSECUTIVE_REQUEST_FAILURES) {
      console.error(
        `Stopping after ${consecutiveRequestFailures} consecutive request failures; staged coordinates remain resumable`,
      )
      break
    }
    if ((index + 1) % PROGRESS_INTERVAL === 0) {
      const failureCount = results.filter(
        (completed) => completed.status !== 'success',
      ).length
      console.log(
        `Geocoded ${index + 1}/${inputs.length}; failures=${failureCount}`,
      )
    }
    if (index < inputs.length - 1) await delay(REQUEST_INTERVAL_MS)
  }

  await updateGeocodedComplexes(pendingWrites, location)
  const validation = await readStagingValidation(location)
  const failures = results.filter((result) => result.status !== 'success')
  const report = {
    attempted: inputs.length,
    succeeded: results.length - failures.length,
    failures,
    validation,
  }
  await writeJsonReport(resolve(values.output), report)

  if (validation.total_count !== expectedStagedCount) {
    throw new Error(
      `Staging count ${validation.total_count} does not match expected usable source count ${expectedStagedCount}`,
    )
  }
  if (validation.geocoded_count !== expectedStagedCount) {
    throw new Error(
      `Only ${validation.geocoded_count}/${expectedStagedCount} records were geocoded; live data was kept`,
    )
  }
  if (!requiredRegionsPresent(validation)) {
    throw new Error('Required regional samples are missing; live data was kept')
  }

  await activateStaging(location)
  console.log(
    JSON.stringify(
      {
        activated: validation.total_count,
        geocoded: validation.geocoded_count,
        geocodingFailures: failures.length,
      },
      null,
      2,
    ),
  )
}

await main().catch((error: unknown) => {
  const reason = error instanceof Error ? error.message : String(error)
  console.error(`Complex geocoding stopped cleanly: ${reason}`)
  process.exitCode = 1
})
