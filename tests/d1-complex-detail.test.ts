import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

import { describe, expect, it } from 'vitest'

import type { ComplexDetailOutcome } from '../scripts/lib/complex-detail-backfill.ts'
import {
  COMPLEX_DETAIL_WRITE_INPUT,
  complexDetailOutcomeStatements,
  complexDetailTargetsSql,
} from '../scripts/lib/d1-complex-detail.ts'

const checkpointMigration = readFileSync(
  new URL('../migrations/0008_complex_detail_checkpoint.sql', import.meta.url),
  'utf8',
)

const createDatabase = (): DatabaseSync => {
  const database = new DatabaseSync(':memory:')
  database.exec('PRAGMA foreign_keys = ON')
  database.exec(`CREATE TABLE complex (
    complex_id TEXT PRIMARY KEY,
    legal_dong_code TEXT NOT NULL,
    approval_date TEXT,
    building_count INTEGER,
    household_count INTEGER,
    lat REAL,
    lng REAL,
    updated_at TEXT NOT NULL
  ) STRICT;`)
  database.exec(checkpointMigration)
  return database
}

const outcome = (
  overrides: Partial<ComplexDetailOutcome> = {},
): ComplexDetailOutcome => ({
  complexId: 'A13583507',
  status: 'filled',
  approvalDate: '1979-08-29',
  buildingCount: 28,
  householdCount: 4_424,
  apiAttempts: 1,
  reason: null,
  ...overrides,
})

describe('complex detail D1 checkpoint', () => {
  it('uses the rollback-safe D1 file import path', () => {
    expect(COMPLEX_DETAIL_WRITE_INPUT).toBe('file')
  })

  it('upserts progress and facts idempotently across a failed then successful retry', () => {
    const database = createDatabase()
    database.exec(`INSERT INTO complex VALUES (
      'A13583507', '1168010600', NULL, NULL, NULL,
      37.5182, 127.0591, '2026-08-10T00:00:00.000Z'
    );`)
    database.exec(
      complexDetailOutcomeStatements(
        [outcome({
          status: 'responseError',
          approvalDate: null,
          buildingCount: null,
          householdCount: null,
          apiAttempts: 2,
          reason: 'temporary error',
        })],
        '2026-08-10T00:01:00.000Z',
      ),
    )
    database.exec(
      complexDetailOutcomeStatements(
        [outcome()],
        '2026-08-10T00:02:00.000Z',
      ),
    )

    expect(
      database.prepare(`SELECT approval_date, building_count, household_count
                          FROM complex`).get(),
    ).toEqual({
      approval_date: '1979-08-29',
      building_count: 28,
      household_count: 4_424,
    })
    expect(
      database.prepare(`SELECT status, attempt_count, api_attempt_count, reason
                          FROM complex_detail_checkpoint`).get(),
    ).toEqual({
      status: 'filled',
      attempt_count: 2,
      api_attempt_count: 3,
      reason: null,
    })
    database.close()
  })

  it('selects only unknown uncheckpointed targets nearest the initial viewport', () => {
    const database = createDatabase()
    database.exec(`INSERT INTO complex VALUES
      ('near', '1168010600', NULL, NULL, NULL, 37.5172, 127.0473, 'now'),
      ('far', '1111010100', NULL, NULL, NULL, 38.0, 128.0, 'now'),
      ('known', '1168010600', NULL, 1, 100, 37.5172, 127.0473, 'now'),
      ('failed', '1168010600', NULL, NULL, NULL, 37.5172, 127.0473, 'now');
      INSERT INTO complex_detail_checkpoint VALUES
      ('failed', 'responseError', 1, 1, 'error', 'now');`)

    expect(database.prepare(complexDetailTargetsSql(10, false)).all()).toEqual([
      { complex_id: 'near', legal_dong_code: '1168010600' },
      { complex_id: 'far', legal_dong_code: '1111010100' },
    ])
    expect(database.prepare(complexDetailTargetsSql(10, true)).all()).toEqual([
      { complex_id: 'failed', legal_dong_code: '1168010600' },
    ])
    database.close()
  })
})
