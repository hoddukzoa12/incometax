import { spawn } from 'node:child_process'

import type { ComplexDraft } from './complex-normalizer.ts'
import type { GeocodingResult } from './kakao-geocoder.ts'

const DATABASE_BINDING = 'COMPLEX_DB'
const REQUIRED_REGION_PREFIXES = {
  seoul: '11',
  busan: '26',
  gyeonggi: '41',
  jeju: '50',
} as const

export type D1Location = 'local' | 'remote'

interface D1Result {
  readonly success: boolean
  readonly results: readonly Record<string, unknown>[]
}

export interface RefreshState {
  readonly verification_observed_at: string
  readonly expected_count: number
}

export interface StagedAddress {
  readonly complex_id: string
  readonly primary_address: string
  readonly fallback_address: string | null
}

export interface StagingValidation {
  readonly total_count: number
  readonly geocoded_count: number
  readonly seoul_count: number
  readonly busan_count: number
  readonly gyeonggi_count: number
  readonly jeju_count: number
}

const runWrangler = async (
  sql: string,
  location: D1Location,
): Promise<readonly D1Result[]> => {
  const args = [
    '--no-install',
    'wrangler',
    'd1',
    'execute',
    DATABASE_BINDING,
    `--${location}`,
    '--command',
    sql,
    '--yes',
    '--json',
  ]

  const { code, stdout, stderr } = await new Promise<{
    code: number | null
    stdout: string
    stderr: string
  }>((resolve) => {
    const child = spawn('npx', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      stderr += chunk
    })
    child.on('close', (code) => resolve({ code, stdout, stderr }))
  })

  if (code !== 0) {
    throw new Error(`D1 command failed (${String(code)}): ${stderr || stdout}`)
  }

  const parsed: unknown = JSON.parse(stdout)
  if (!Array.isArray(parsed)) {
    throw new TypeError('Unexpected Wrangler D1 JSON output')
  }
  const results = parsed as D1Result[]
  if (results.some((result) => result.success !== true)) {
    throw new Error('One or more D1 statements were not successful')
  }
  return results
}

const queryRows = async <T extends object>(
  sql: string,
  location: D1Location,
): Promise<readonly T[]> => {
  const results = await runWrangler(sql, location)
  const first = results[0]
  if (!first?.success || !Array.isArray(first.results)) {
    throw new Error('D1 query was not successful')
  }
  return first.results as readonly T[]
}

const sqlString = (value: string): string => `'${value.replaceAll("'", "''")}'`
const sqlNullableString = (value: string | null): string =>
  value === null ? 'NULL' : sqlString(value)

export const readRefreshState = async (
  location: D1Location,
): Promise<RefreshState | null> => {
  const rows = await queryRows<RefreshState>(
    `SELECT verification_observed_at, expected_count
       FROM complex_refresh_state
      WHERE singleton = 1`,
    location,
  )
  return rows[0] ?? null
}

export const startRefresh = async (
  verificationObservedAt: string,
  expectedCount: number,
  startedAt: string,
  location: D1Location,
): Promise<void> => {
  await runWrangler(
    `DELETE FROM complex_staging;
     INSERT INTO complex_refresh_state (
       singleton, verification_observed_at, expected_count, started_at
     ) VALUES (
       1, ${sqlString(verificationObservedAt)}, ${expectedCount}, ${sqlString(startedAt)}
     ) ON CONFLICT(singleton) DO UPDATE SET
       verification_observed_at = excluded.verification_observed_at,
       expected_count = excluded.expected_count,
       started_at = excluded.started_at;`,
    location,
  )
}

export const readStagedComplexIds = async (
  location: D1Location,
): Promise<Set<string>> => {
  const rows = await queryRows<{ complex_id: string }>(
    'SELECT complex_id FROM complex_staging',
    location,
  )
  return new Set(rows.map((row) => row.complex_id))
}

export const upsertComplexDrafts = async (
  records: readonly ComplexDraft[],
  updatedAt: string,
  location: D1Location,
): Promise<void> => {
  if (records.length === 0) return
  const values = records
    .map(
      (record) =>
        `(${[
          sqlString(record.complexId),
          sqlString(record.name),
          sqlString(record.legalAddress),
          sqlNullableString(record.roadAddress),
          sqlString(record.legalDongCode),
          sqlNullableString(record.approvalDate),
          record.buildingCount,
          record.householdCount,
          sqlString(updatedAt),
        ].join(', ')})`,
    )
    .join(',\n')

  await runWrangler(
    `INSERT INTO complex_staging (
       complex_id, name, legal_address, road_address, legal_dong_code,
       approval_date, building_count, household_count, updated_at
     ) VALUES ${values}
     ON CONFLICT(complex_id) DO UPDATE SET
       name = excluded.name,
       legal_address = excluded.legal_address,
       road_address = excluded.road_address,
       legal_dong_code = excluded.legal_dong_code,
       approval_date = excluded.approval_date,
       building_count = excluded.building_count,
       household_count = excluded.household_count,
       updated_at = excluded.updated_at;`,
    location,
  )
}

export const readStagedAddresses = async (
  location: D1Location,
): Promise<readonly StagedAddress[]> =>
  queryRows<StagedAddress>(
    `SELECT complex_id,
            COALESCE(NULLIF(road_address, ''), legal_address) AS primary_address,
            CASE
              WHEN road_address IS NOT NULL AND road_address <> legal_address
                THEN legal_address
              ELSE NULL
            END AS fallback_address
       FROM complex_staging
      WHERE lat IS NULL OR lng IS NULL
      ORDER BY complex_id`,
    location,
  )

export const updateGeocodedComplexes = async (
  results: readonly GeocodingResult[],
  location: D1Location,
): Promise<void> => {
  const successes = results.filter((result) => result.status === 'success')
  if (successes.length === 0) return
  await runWrangler(
    successes
      .map(
        (result) =>
          `UPDATE complex_staging SET lat = ${result.lat}, lng = ${result.lng}
            WHERE complex_id = ${sqlString(result.complexId)};`,
      )
      .join('\n'),
    location,
  )
}

export const readStagingValidation = async (
  location: D1Location,
): Promise<StagingValidation> => {
  const rows = await queryRows<StagingValidation>(
    `SELECT COUNT(*) AS total_count,
            COALESCE(SUM(CASE WHEN lat IS NOT NULL AND lng IS NOT NULL THEN 1 ELSE 0 END), 0)
              AS geocoded_count,
            COALESCE(SUM(CASE WHEN legal_dong_code LIKE '${REQUIRED_REGION_PREFIXES.seoul}%' AND lat IS NOT NULL THEN 1 ELSE 0 END), 0)
              AS seoul_count,
            COALESCE(SUM(CASE WHEN legal_dong_code LIKE '${REQUIRED_REGION_PREFIXES.busan}%' AND lat IS NOT NULL THEN 1 ELSE 0 END), 0)
              AS busan_count,
            COALESCE(SUM(CASE WHEN legal_dong_code LIKE '${REQUIRED_REGION_PREFIXES.gyeonggi}%' AND lat IS NOT NULL THEN 1 ELSE 0 END), 0)
              AS gyeonggi_count,
            COALESCE(SUM(CASE WHEN legal_dong_code LIKE '${REQUIRED_REGION_PREFIXES.jeju}%' AND lat IS NOT NULL THEN 1 ELSE 0 END), 0)
              AS jeju_count
       FROM complex_staging`,
    location,
  )
  const validation = rows[0]
  if (!validation) throw new Error('D1 validation returned no row')
  return validation
}

export const activateStaging = async (
  location: D1Location,
): Promise<void> => {
  await runWrangler(
    `DELETE FROM complex;
     INSERT INTO complex (
       complex_id, name, legal_address, road_address, legal_dong_code,
       approval_date, building_count, household_count, lat, lng, updated_at
     ) SELECT
       complex_id, name, legal_address, road_address, legal_dong_code,
       approval_date, building_count, household_count, lat, lng, updated_at
     FROM complex_staging;`,
    location,
  )
}
