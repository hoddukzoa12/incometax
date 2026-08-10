import { INITIAL_MAP_CENTER } from '../../src/map/initial-center.ts'
import {
  sqlNullableString,
  sqlString,
} from '../../worker/d1/sql.ts'
import {
  COMPLEX_PLACE_URL_RETRY_STATUSES,
  type ComplexPlaceUrlOutcome,
  type ComplexPlaceUrlTarget,
} from './complex-place-url-backfill.ts'
import {
  queryD1Rows,
  runD1,
  type D1ExecutionObserver,
  type D1Location,
} from './d1.ts'

export const COMPLEX_PLACE_URL_ORDER =
  'initialMapDistanceThenComplexId' as const

const targetCheckpointPredicate = (retryFailed: boolean): string =>
  retryFailed
    ? `checkpoint.status IN (${COMPLEX_PLACE_URL_RETRY_STATUSES
        .map(sqlString)
        .join(', ')})`
    : 'checkpoint.complex_id IS NULL'

export const complexPlaceUrlTargetsSql = (
  limit: number,
  retryFailed: boolean,
): string => {
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new TypeError('Complex place URL target limit must be a positive integer')
  }
  const { latitude, longitude } = INITIAL_MAP_CENTER
  return `SELECT complex.complex_id, complex.name, complex.legal_address,
              complex.lat, complex.lng
       FROM complex
       LEFT JOIN complex_place_url_checkpoint AS checkpoint
         ON checkpoint.complex_id = complex.complex_id
      WHERE complex.place_url IS NULL
        AND ${targetCheckpointPredicate(retryFailed)}
      ORDER BY (complex.lat IS NULL OR complex.lng IS NULL) ASC,
               ((complex.lat - ${latitude}) * (complex.lat - ${latitude})) +
               ((complex.lng - ${longitude}) * (complex.lng - ${longitude})) ASC,
               complex.complex_id ASC
      LIMIT ${limit}`
}

interface ComplexPlaceUrlTargetRow {
  readonly complex_id: string
  readonly name: string
  readonly legal_address: string
  readonly lat: number | null
  readonly lng: number | null
}

export const readComplexPlaceUrlTargets = async (
  limit: number,
  retryFailed: boolean,
  location: D1Location,
  observer?: D1ExecutionObserver,
): Promise<readonly ComplexPlaceUrlTarget[]> => {
  const rows = await queryD1Rows<ComplexPlaceUrlTargetRow>(
    complexPlaceUrlTargetsSql(limit, retryFailed),
    location,
    observer,
  )
  return rows.map((row) => ({
    complexId: row.complex_id,
    name: row.name,
    legalAddress: row.legal_address,
    lat: row.lat,
    lng: row.lng,
  }))
}

export interface ComplexPlaceUrlProgress {
  readonly total: number
  readonly filled: number
  readonly remaining: number
  readonly checkpoint_filled: number
  readonly no_result: number
  readonly too_far: number
  readonly candidate_mismatch: number
  readonly missing_coordinates: number
  readonly response_error: number
}

export const readComplexPlaceUrlProgress = async (
  location: D1Location,
  observer?: D1ExecutionObserver,
): Promise<ComplexPlaceUrlProgress> => {
  const rows = await queryD1Rows<ComplexPlaceUrlProgress>(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(place_url IS NOT NULL), 0) AS filled,
            COALESCE(SUM(place_url IS NULL), 0) AS remaining,
            (SELECT COUNT(*) FROM complex_place_url_checkpoint WHERE status = 'filled')
              AS checkpoint_filled,
            (SELECT COUNT(*) FROM complex_place_url_checkpoint WHERE status = 'noResult')
              AS no_result,
            (SELECT COUNT(*) FROM complex_place_url_checkpoint WHERE status = 'tooFar')
              AS too_far,
            (SELECT COUNT(*) FROM complex_place_url_checkpoint WHERE status = 'candidateMismatch')
              AS candidate_mismatch,
            (SELECT COUNT(*) FROM complex_place_url_checkpoint WHERE status = 'missingCoordinates')
              AS missing_coordinates,
            (SELECT COUNT(*) FROM complex_place_url_checkpoint WHERE status = 'responseError')
              AS response_error
       FROM complex`,
    location,
    observer,
  )
  const progress = rows[0]
  if (!progress) throw new Error('Complex place URL progress query returned no row')
  return progress
}

const checkpointStatement = (
  outcome: ComplexPlaceUrlOutcome,
  attemptedAt: string,
): string => `INSERT INTO complex_place_url_checkpoint (
       complex_id, status, attempt_count, api_attempt_count, reason, attempted_at
     ) VALUES (
       ${sqlString(outcome.complexId)}, ${sqlString(outcome.status)}, 1,
       ${outcome.apiAttempts}, ${sqlNullableString(outcome.reason)},
       ${sqlString(attemptedAt)}
     ) ON CONFLICT(complex_id) DO UPDATE SET
       status = excluded.status,
       attempt_count = complex_place_url_checkpoint.attempt_count + 1,
       api_attempt_count = complex_place_url_checkpoint.api_attempt_count + excluded.api_attempt_count,
       reason = excluded.reason,
       attempted_at = excluded.attempted_at;`

export const complexPlaceUrlOutcomeStatements = (
  outcomes: readonly ComplexPlaceUrlOutcome[],
  attemptedAt: string,
): string => outcomes.map((outcome) => {
  if (outcome.status === 'filled' && outcome.placeUrl === null) {
    throw new TypeError(`Filled complex place URL is missing URL: ${outcome.complexId}`)
  }
  if (outcome.status !== 'filled' && outcome.placeUrl !== null) {
    throw new TypeError(`Unfilled complex place URL has URL: ${outcome.complexId}`)
  }
  const update = outcome.status === 'filled'
    ? `UPDATE complex
            SET place_url = ${sqlNullableString(outcome.placeUrl)}
          WHERE complex_id = ${sqlString(outcome.complexId)};\n`
    : ''
  return `${update}${checkpointStatement(outcome, attemptedAt)}`
}).join('\n')

export const COMPLEX_PLACE_URL_WRITE_INPUT = 'file' as const

export const saveComplexPlaceUrlOutcomes = async (
  outcomes: readonly ComplexPlaceUrlOutcome[],
  attemptedAt: string,
  location: D1Location,
  observer?: D1ExecutionObserver,
): Promise<void> => {
  if (outcomes.length === 0) return
  await runD1(
    complexPlaceUrlOutcomeStatements(outcomes, attemptedAt),
    location,
    {
      input: COMPLEX_PLACE_URL_WRITE_INPUT,
      operation: 'write',
      observer,
    },
  )
}
