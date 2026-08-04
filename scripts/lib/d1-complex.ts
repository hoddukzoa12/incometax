import {
  RETRYABLE_COMPLEX_LOOKUP_STATUSES,
  type ComplexListExclusion,
  type ComplexListRecord,
  type ComplexStagingRecord,
} from '../../shared/complex.ts'
import {
  complexListCheckpointStatements,
  complexDraftUpsertStatements,
  sqlString,
} from './d1-complex-statements.ts'
import {
  queryD1Rows,
  runD1,
  type D1ExecutionMeasurement,
  type D1ExecutionObserver,
  type D1Location,
} from './d1.ts'
import type { GeocodingResult } from './kakao-geocoder.ts'

const REQUIRED_REGION_PREFIXES = {
  seoul: '11',
  busan: '26',
  gyeonggi: '41',
  jeju: '50',
} as const

export type { D1ExecutionMeasurement, D1ExecutionObserver, D1Location }

export interface RefreshState {
  readonly verification_observed_at: string
  readonly expected_count: number
  readonly next_list_page: number
  readonly list_records: readonly ComplexListRecord[]
  readonly list_fields: readonly string[]
  readonly exclusions: readonly ComplexListExclusion[]
}

interface RefreshStateRow {
  readonly verification_observed_at: string
  readonly expected_count: number
  readonly list_fields_json: string
  readonly excluded_records_json: string
}

interface ListCheckpointRow {
  readonly page: number
  readonly complex_id: string
  readonly name: string
  readonly legal_dong_code: string
  readonly province: string | null
  readonly district: string | null
  readonly legal_dong: string | null
  readonly ri: string | null
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
  readonly pending_count: number
  readonly matched_count: number
  readonly not_found_count: number
  readonly rejected_count: number
}

const runWrangler = async (
  sql: string,
  location: D1Location,
  operation: D1ExecutionMeasurement['operation'],
  observer?: D1ExecutionObserver,
): ReturnType<typeof runD1> => runD1(sql, location, { operation, observer })

const queryRows = async <T extends object>(
  sql: string,
  location: D1Location,
  observer?: D1ExecutionObserver,
): Promise<readonly T[]> => {
  return queryD1Rows<T>(sql, location, observer)
}

const parseExclusions = (
  serialized: string,
): readonly ComplexListExclusion[] => {
  const parsed: unknown = JSON.parse(serialized)
  if (
    !Array.isArray(parsed) ||
    !parsed.every(
      (record) =>
        Array.isArray(record) &&
        record.length === 4 &&
        record.every((field) => typeof field === 'string'),
    )
  ) {
    throw new TypeError('Complex refresh state has invalid exclusions')
  }
  return parsed.map(([complexId, name, legalDongCode, reason]) => ({
    complexId,
    name,
    legalDongCode,
    reason,
  }))
}

const parseListFields = (serialized: string): readonly string[] => {
  const parsed: unknown = JSON.parse(serialized)
  if (!Array.isArray(parsed) || !parsed.every((field) => typeof field === 'string')) {
    throw new TypeError('Complex refresh state has invalid list fields')
  }
  return parsed
}

export const readRefreshState = async (
  location: D1Location,
  observer?: D1ExecutionObserver,
): Promise<RefreshState | null> => {
  const rows = await queryRows<RefreshStateRow>(
    `SELECT verification_observed_at, expected_count,
            list_fields_json, excluded_records_json
       FROM complex_refresh_state
      WHERE singleton = 1`,
    location,
    observer,
  )
  const row = rows[0]
  if (!row) return null
  const checkpointRows = await queryRows<ListCheckpointRow>(
    `SELECT page, complex_id, name, legal_dong_code,
            province, district, legal_dong, ri
       FROM complex_list_checkpoint
      ORDER BY page, complex_id`,
    location,
    observer,
  )
  const checkpointPages = [...new Set(checkpointRows.map((record) => record.page))]
  if (!checkpointPages.every((page, index) => page === index + 1)) {
    throw new Error('Complex list checkpoint pages are not contiguous')
  }
  return {
    verification_observed_at: row.verification_observed_at,
    expected_count: row.expected_count,
    next_list_page: checkpointPages.length + 1,
    list_records: checkpointRows.map((record) => ({
      complexId: record.complex_id,
      name: record.name,
      legalDongCode: record.legal_dong_code,
      province: record.province,
      district: record.district,
      legalDong: record.legal_dong,
      ri: record.ri,
    })),
    list_fields: parseListFields(row.list_fields_json),
    exclusions: parseExclusions(row.excluded_records_json),
  }
}

export const startRefresh = async (
  verificationObservedAt: string,
  expectedCount: number,
  startedAt: string,
  location: D1Location,
  observer?: D1ExecutionObserver,
): Promise<void> => {
  await runWrangler(
    `DELETE FROM complex_list_checkpoint;
     DELETE FROM complex_staging;
     INSERT INTO complex_refresh_state (
       singleton, verification_observed_at, expected_count, started_at,
       list_fields_json, excluded_records_json
     ) VALUES (
       1, ${sqlString(verificationObservedAt)}, ${expectedCount}, ${sqlString(startedAt)},
       '[]', '[]'
     ) ON CONFLICT(singleton) DO UPDATE SET
       verification_observed_at = excluded.verification_observed_at,
       expected_count = excluded.expected_count,
       started_at = excluded.started_at,
       list_fields_json = excluded.list_fields_json,
       excluded_records_json = excluded.excluded_records_json;`,
    location,
    'write',
    observer,
  )
}

export const saveComplexListPage = async (
  page: number,
  records: readonly ComplexListRecord[],
  fields: readonly string[],
  location: D1Location,
  observer?: D1ExecutionObserver,
): Promise<void> => {
  if (records.length === 0) {
    throw new Error(`Complex list page ${page} has no checkpoint records`)
  }
  const pages = await queryRows<{ page: number }>(
    'SELECT DISTINCT page FROM complex_list_checkpoint ORDER BY page',
    location,
    observer,
  )
  if (!pages.every((record, index) => record.page === index + 1)) {
    throw new Error('Complex list checkpoint pages are not contiguous')
  }
  if (page !== pages.length + 1) {
    throw new Error(`Complex list page ${page} checkpoint was not expected`)
  }

  const checkpointStatements = complexListCheckpointStatements(page, records)
  const fieldsStatement = `UPDATE complex_refresh_state
        SET list_fields_json = ${sqlString(JSON.stringify(fields))}
      WHERE singleton = 1;`
  await runD1([...checkpointStatements, fieldsStatement].join('\n'), location, {
    input: 'file',
    operation: 'write',
    observer,
  })
  const committedRows = await queryRows<{ record_count: number }>(
    `SELECT COUNT(*) AS record_count
       FROM complex_list_checkpoint
      WHERE page = ${page}`,
    location,
    observer,
  )
  if (committedRows[0]?.record_count !== records.length) {
    throw new Error(`Complex list page ${page} checkpoint was not committed`)
  }
}

export const resetComplexListCheckpoint = async (
  location: D1Location,
  observer?: D1ExecutionObserver,
): Promise<void> => {
  await runWrangler(
    `DELETE FROM complex_list_checkpoint;
     UPDATE complex_refresh_state
        SET list_fields_json = '[]'
      WHERE singleton = 1;`,
    location,
    'write',
    observer,
  )
}

export const saveComplexExclusion = async (
  exclusion: ComplexListExclusion,
  location: D1Location,
  observer?: D1ExecutionObserver,
): Promise<void> => {
  const serialized = sqlString(
    JSON.stringify([
      exclusion.complexId,
      exclusion.name,
      exclusion.legalDongCode,
      exclusion.reason,
    ]),
  )
  await runWrangler(
    `UPDATE complex_refresh_state
        SET excluded_records_json = json_insert(
              excluded_records_json,
              '$[#]',
              json(${serialized})
            )
      WHERE singleton = 1
        AND NOT EXISTS (
          SELECT 1
            FROM json_each(excluded_records_json)
           WHERE json_extract(value, '$[0]') = ${sqlString(exclusion.complexId)}
        );`,
    location,
    'write',
    observer,
  )
}

export const clearStagedComplexes = async (
  location: D1Location,
  observer?: D1ExecutionObserver,
): Promise<void> => {
  await runWrangler('DELETE FROM complex_staging', location, 'write', observer)
}

export const readStagedComplexIds = async (
  location: D1Location,
  observer?: D1ExecutionObserver,
): Promise<Set<string>> => {
  const rows = await queryRows<{ complex_id: string }>(
    'SELECT complex_id FROM complex_staging',
    location,
    observer,
  )
  return new Set(rows.map((row) => row.complex_id))
}

export const readCompletedComplexLookupIds = async (
  location: D1Location,
  observer?: D1ExecutionObserver,
): Promise<Set<string>> => {
  const rows = await queryRows<{ complex_id: string }>(
    `SELECT complex_id
       FROM complex_staging
      WHERE lookup_status <> 'pending'`,
    location,
    observer,
  )
  return new Set(rows.map((row) => row.complex_id))
}

export const COMPLEX_RETRY_STAGING_SQL = `
  DELETE FROM complex_staging;
  INSERT INTO complex_staging (
    complex_id, name, legal_address, road_address, legal_dong_code,
    approval_date, building_count, household_count, lat, lng,
    lookup_status, backfill_reason, updated_at
  ) SELECT
    complex_id, name, legal_address, road_address, legal_dong_code,
    approval_date, building_count, household_count, lat, lng,
    lookup_status, backfill_reason, updated_at
  FROM complex;`

export const stageActiveComplexesForRetry = async (
  location: D1Location,
  observer?: D1ExecutionObserver,
): Promise<void> => {
  await runWrangler(
    COMPLEX_RETRY_STAGING_SQL,
    location,
    'write',
    observer,
  )
}

export const readRetryableComplexLookupIds = async (
  location: D1Location,
  observer?: D1ExecutionObserver,
): Promise<Set<string>> => {
  const statuses = RETRYABLE_COMPLEX_LOOKUP_STATUSES.map(sqlString).join(', ')
  const rows = await queryRows<{ complex_id: string }>(
    `SELECT complex_id
       FROM complex_staging
      WHERE lookup_status IN (${statuses})`,
    location,
    observer,
  )
  return new Set(rows.map((row) => row.complex_id))
}

export const upsertComplexRecords = async (
  records: readonly ComplexStagingRecord[],
  updatedAt: string,
  location: D1Location,
  observer?: D1ExecutionObserver,
): Promise<void> => {
  if (records.length === 0) return
  const statements = complexDraftUpsertStatements(records, updatedAt)
  for (const statement of statements) {
    await runD1(statement, location, {
      input: 'file',
      operation: 'write',
      observer,
    })
  }
}

export const readStagedAddresses = async (
  location: D1Location,
  observer?: D1ExecutionObserver,
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
    observer,
  )

export const updateGeocodedComplexes = async (
  results: readonly GeocodingResult[],
  location: D1Location,
  observer?: D1ExecutionObserver,
): Promise<void> => {
  const successes = results.filter((result) => result.status === 'success')
  if (successes.length === 0) return
  await runWrangler(
    successes
      .map(
        (result) =>
          `UPDATE complex_staging
              SET lat = ${result.lat}, lng = ${result.lng},
                  lookup_status = 'matched', backfill_reason = NULL
            WHERE complex_id = ${sqlString(result.complexId)};`,
      )
      .join('\n'),
    location,
    'write',
    observer,
  )
}

export const readStagingValidation = async (
  location: D1Location,
  observer?: D1ExecutionObserver,
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
              AS jeju_count,
            COALESCE(SUM(CASE WHEN lookup_status = 'pending' THEN 1 ELSE 0 END), 0)
              AS pending_count,
            COALESCE(SUM(CASE WHEN lookup_status = 'matched' THEN 1 ELSE 0 END), 0)
              AS matched_count,
            COALESCE(SUM(CASE WHEN lookup_status = 'notFound' THEN 1 ELSE 0 END), 0)
              AS not_found_count,
            COALESCE(SUM(CASE WHEN lookup_status = 'rejected' THEN 1 ELSE 0 END), 0)
              AS rejected_count
       FROM complex_staging`,
    location,
    observer,
  )
  const validation = rows[0]
  if (!validation) throw new Error('D1 validation returned no row')
  return validation
}

export const COMPLEX_ACTIVATION_SQL = `
  INSERT INTO complex (
    complex_id, name, legal_address, road_address, legal_dong_code,
    approval_date, building_count, household_count, lat, lng,
    lookup_status, backfill_reason, updated_at
  ) SELECT
    complex_id, name, legal_address, road_address, legal_dong_code,
    approval_date, building_count, household_count, lat, lng,
    lookup_status, backfill_reason, updated_at
  FROM complex_staging
  WHERE true
  ON CONFLICT(complex_id) DO UPDATE SET
    name = excluded.name,
    legal_address = CASE
      WHEN excluded.lookup_status = 'matched' THEN excluded.legal_address
      ELSE complex.legal_address
    END,
    road_address = CASE
      WHEN excluded.lookup_status = 'matched' THEN excluded.road_address
      ELSE complex.road_address
    END,
    legal_dong_code = excluded.legal_dong_code,
    approval_date = COALESCE(excluded.approval_date, complex.approval_date),
    building_count = COALESCE(excluded.building_count, complex.building_count),
    household_count = COALESCE(excluded.household_count, complex.household_count),
    lat = excluded.lat,
    lng = excluded.lng,
    lookup_status = excluded.lookup_status,
    backfill_reason = excluded.backfill_reason,
    updated_at = excluded.updated_at;
  DELETE FROM complex
   WHERE NOT EXISTS (
     SELECT 1
       FROM complex_staging
      WHERE complex_staging.complex_id = complex.complex_id
   );`

export const activateStaging = async (
  location: D1Location,
  observer?: D1ExecutionObserver,
): Promise<void> => {
  // Wrangler maps the semicolon-separated statements to one D1 batch. D1 batches
  // are transactions, so the upsert and delete-missing steps commit together.
  await runWrangler(COMPLEX_ACTIVATION_SQL, location, 'write', observer)
}
