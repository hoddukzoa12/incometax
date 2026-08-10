import { INITIAL_MAP_CENTER } from '../../src/map/initial-center.ts'
import {
  sqlNullableString,
  sqlString,
} from '../../worker/d1/sql.ts'
import type {
  ComplexDetailOutcome,
  ComplexDetailTarget,
} from './complex-detail-backfill.ts'
import {
  queryD1Rows,
  runD1,
  type D1ExecutionObserver,
  type D1Location,
} from './d1.ts'

export const COMPLEX_DETAIL_ORDER =
  'initialMapDistanceThenComplexId' as const

const targetCheckpointPredicate = (retryFailed: boolean): string =>
  retryFailed
    ? "checkpoint.status IN ('noDetail', 'responseError', 'missingFields')"
    : 'checkpoint.complex_id IS NULL'

export const complexDetailTargetsSql = (
  limit: number,
  retryFailed: boolean,
): string => {
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new TypeError('Complex detail target limit must be a positive integer')
  }
  const { latitude, longitude } = INITIAL_MAP_CENTER
  return `SELECT complex.complex_id, complex.legal_dong_code
       FROM complex
       LEFT JOIN complex_detail_checkpoint AS checkpoint
         ON checkpoint.complex_id = complex.complex_id
      WHERE complex.household_count IS NULL
        AND ${targetCheckpointPredicate(retryFailed)}
      ORDER BY (complex.lat IS NULL OR complex.lng IS NULL) ASC,
               ((complex.lat - ${latitude}) * (complex.lat - ${latitude})) +
               ((complex.lng - ${longitude}) * (complex.lng - ${longitude})) ASC,
               complex.complex_id ASC
      LIMIT ${limit}`
}

interface ComplexDetailTargetRow {
  readonly complex_id: string
  readonly legal_dong_code: string
}

export const readComplexDetailTargets = async (
  limit: number,
  retryFailed: boolean,
  location: D1Location,
  observer?: D1ExecutionObserver,
): Promise<readonly ComplexDetailTarget[]> => {
  const rows = await queryD1Rows<ComplexDetailTargetRow>(
    complexDetailTargetsSql(limit, retryFailed),
    location,
    observer,
  )
  return rows.map((row) => ({
    complexId: row.complex_id,
    legalDongCode: row.legal_dong_code,
  }))
}

export interface ComplexDetailProgress {
  readonly total: number
  readonly filled: number
  readonly remaining: number
  readonly checkpoint_filled: number
  readonly no_detail: number
  readonly response_error: number
  readonly missing_fields: number
}

export const readComplexDetailProgress = async (
  location: D1Location,
  observer?: D1ExecutionObserver,
): Promise<ComplexDetailProgress> => {
  const rows = await queryD1Rows<ComplexDetailProgress>(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(household_count IS NOT NULL), 0) AS filled,
            COALESCE(SUM(household_count IS NULL), 0) AS remaining,
            (SELECT COUNT(*) FROM complex_detail_checkpoint WHERE status = 'filled')
              AS checkpoint_filled,
            (SELECT COUNT(*) FROM complex_detail_checkpoint WHERE status = 'noDetail')
              AS no_detail,
            (SELECT COUNT(*) FROM complex_detail_checkpoint WHERE status = 'responseError')
              AS response_error,
            (SELECT COUNT(*) FROM complex_detail_checkpoint WHERE status = 'missingFields')
              AS missing_fields
       FROM complex`,
    location,
    observer,
  )
  const progress = rows[0]
  if (!progress) throw new Error('Complex detail progress query returned no row')
  return progress
}

const detailCheckpointStatement = (
  outcome: ComplexDetailOutcome,
  attemptedAt: string,
): string => `INSERT INTO complex_detail_checkpoint (
       complex_id, status, attempt_count, api_attempt_count, reason, attempted_at
     ) VALUES (
       ${sqlString(outcome.complexId)}, ${sqlString(outcome.status)}, 1,
       ${outcome.apiAttempts}, ${sqlNullableString(outcome.reason)},
       ${sqlString(attemptedAt)}
     ) ON CONFLICT(complex_id) DO UPDATE SET
       status = excluded.status,
       attempt_count = complex_detail_checkpoint.attempt_count + 1,
       api_attempt_count = complex_detail_checkpoint.api_attempt_count + excluded.api_attempt_count,
       reason = excluded.reason,
       attempted_at = excluded.attempted_at;`

export const complexDetailOutcomeStatements = (
  outcomes: readonly ComplexDetailOutcome[],
  attemptedAt: string,
): string =>
  outcomes.map((outcome) => {
    if (
      outcome.status === 'filled' &&
      (outcome.buildingCount === null || outcome.householdCount === null)
    ) {
      throw new TypeError(
        `Filled complex detail is missing counts: ${outcome.complexId}`,
      )
    }
    const update = outcome.status === 'filled'
      ? `UPDATE complex
            SET approval_date = ${sqlNullableString(outcome.approvalDate)},
                building_count = ${String(outcome.buildingCount)},
                household_count = ${String(outcome.householdCount)},
                updated_at = ${sqlString(attemptedAt)}
          WHERE complex_id = ${sqlString(outcome.complexId)};\n`
      : ''
    return `${update}${detailCheckpointStatement(outcome, attemptedAt)}`
  }).join('\n')

export const COMPLEX_DETAIL_WRITE_INPUT = 'file' as const

export const saveComplexDetailOutcomes = async (
  outcomes: readonly ComplexDetailOutcome[],
  attemptedAt: string,
  location: D1Location,
  observer?: D1ExecutionObserver,
): Promise<void> => {
  if (outcomes.length === 0) return
  await runD1(
    complexDetailOutcomeStatements(outcomes, attemptedAt),
    location,
    {
      input: COMPLEX_DETAIL_WRITE_INPUT,
      operation: 'write',
      observer,
    },
  )
}
