import type {
  ComplexListRecord,
  ComplexStagingRecord,
} from '../../shared/complex.ts'
import {
  sqlNullableNumber,
  sqlNullableString,
  sqlString,
} from '../../worker/d1/sql.ts'

// Cloudflare D1 SQL statement limit:
// https://developers.cloudflare.com/d1/platform/limits/
export const D1_SQL_STATEMENT_MAX_BYTES = 100_000
const D1_SQL_STATEMENT_SAFETY_MARGIN_BYTES = 10_000
const D1_SQL_STATEMENT_CHUNK_MAX_BYTES =
  D1_SQL_STATEMENT_MAX_BYTES - D1_SQL_STATEMENT_SAFETY_MARGIN_BYTES

const COMPLEX_UPSERT_PREFIX = `INSERT INTO complex_staging (
       complex_id, name, legal_address, road_address, legal_dong_code,
       approval_date, building_count, household_count, lat, lng,
       place_url, lookup_status, backfill_reason, updated_at
     ) VALUES `
const COMPLEX_UPSERT_SUFFIX = `
     ON CONFLICT(complex_id) DO UPDATE SET
       name = excluded.name,
       legal_address = CASE
         WHEN excluded.lookup_status = 'matched' THEN excluded.legal_address
         ELSE complex_staging.legal_address
       END,
       road_address = CASE
         WHEN excluded.lookup_status = 'matched' THEN excluded.road_address
         ELSE COALESCE(complex_staging.road_address, excluded.road_address)
       END,
       legal_dong_code = excluded.legal_dong_code,
       approval_date = COALESCE(excluded.approval_date, complex_staging.approval_date),
       building_count = COALESCE(excluded.building_count, complex_staging.building_count),
       household_count = COALESCE(excluded.household_count, complex_staging.household_count),
       lat = excluded.lat,
       lng = excluded.lng,
       place_url = COALESCE(excluded.place_url, complex_staging.place_url),
       lookup_status = excluded.lookup_status,
       backfill_reason = excluded.backfill_reason,
       updated_at = excluded.updated_at;`
const COMPLEX_UPSERT_ROW_SEPARATOR = ',\n'
const COMPLEX_LIST_CHECKPOINT_PREFIX = `INSERT INTO complex_list_checkpoint (
       page, complex_id, name, legal_dong_code,
       province, district, legal_dong, ri
     ) VALUES `
const COMPLEX_LIST_CHECKPOINT_SUFFIX = `
     ON CONFLICT(page, complex_id) DO UPDATE SET
       name = excluded.name,
       legal_dong_code = excluded.legal_dong_code,
       province = excluded.province,
       district = excluded.district,
       legal_dong = excluded.legal_dong,
       ri = excluded.ri;`

const complexDraftSqlRow = (
  record: ComplexStagingRecord,
  updatedAt: string,
): string =>
  `(${[
    sqlString(record.complexId),
    sqlString(record.name),
    sqlString(record.legalAddress),
    sqlNullableString(record.roadAddress),
    sqlString(record.legalDongCode),
    sqlNullableString(record.approvalDate),
    sqlNullableNumber(record.buildingCount),
    sqlNullableNumber(record.householdCount),
    sqlNullableNumber(record.lat),
    sqlNullableNumber(record.lng),
    sqlNullableString(record.placeUrl),
    sqlString(record.lookupStatus),
    sqlNullableString(record.backfillReason),
    sqlString(updatedAt),
  ].join(', ')})`

const sqlBytes = (value: string): number => Buffer.byteLength(value, 'utf8')

interface ChunkedStatementOptions<RecordType> {
  readonly records: readonly RecordType[]
  readonly prefix: string
  readonly suffix: string
  readonly row: (record: RecordType) => string
  readonly errorLabel: (record: RecordType) => string
}

const chunkedStatements = <RecordType>({
  records,
  prefix,
  suffix,
  row,
  errorLabel,
}: ChunkedStatementOptions<RecordType>): readonly string[] => {
  const statements: string[] = []
  let rows: string[] = []
  const statement = (statementRows: readonly string[]): string =>
    `${prefix}${statementRows.join(COMPLEX_UPSERT_ROW_SEPARATOR)}${suffix}`

  for (const record of records) {
    const sqlRow = row(record)
    if (sqlBytes(statement([sqlRow])) > D1_SQL_STATEMENT_MAX_BYTES) {
      throw new Error(
        `${errorLabel(record)} exceeds the D1 SQL statement byte limit`,
      )
    }
    const candidateRows = [...rows, sqlRow]
    if (
      rows.length > 0 &&
      sqlBytes(statement(candidateRows)) > D1_SQL_STATEMENT_CHUNK_MAX_BYTES
    ) {
      statements.push(statement(rows))
      rows = [sqlRow]
    } else {
      rows = candidateRows
    }
  }
  if (rows.length > 0) statements.push(statement(rows))
  return statements
}

export const complexDraftUpsertStatements = (
  records: readonly ComplexStagingRecord[],
  updatedAt: string,
): readonly string[] =>
  chunkedStatements({
    records,
    prefix: COMPLEX_UPSERT_PREFIX,
    suffix: COMPLEX_UPSERT_SUFFIX,
    row: (record) => complexDraftSqlRow(record, updatedAt),
    errorLabel: (record) => `Complex ${record.complexId}`,
  })

export const complexListCheckpointStatements = (
  page: number,
  records: readonly ComplexListRecord[],
): readonly string[] =>
  chunkedStatements({
    records,
    prefix: COMPLEX_LIST_CHECKPOINT_PREFIX,
    suffix: COMPLEX_LIST_CHECKPOINT_SUFFIX,
    row: (record) =>
      `(${[
        page,
        sqlString(record.complexId),
        sqlString(record.name),
        sqlString(record.legalDongCode),
        sqlNullableString(record.province),
        sqlNullableString(record.district),
        sqlNullableString(record.legalDong),
        sqlNullableString(record.ri),
      ].join(', ')})`,
    errorLabel: (record) => `Complex ${record.complexId} checkpoint`,
  })
