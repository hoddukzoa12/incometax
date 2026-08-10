import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

import { describe, expect, it } from 'vitest'

import type { ComplexPlaceUrlOutcome } from '../scripts/lib/complex-place-url-backfill.ts'
import {
  COMPLEX_PLACE_URL_WRITE_INPUT,
  complexPlaceUrlOutcomeStatements,
  complexPlaceUrlTargetsSql,
} from '../scripts/lib/d1-complex-place-url.ts'

const migration = readFileSync(
  new URL('../migrations/0009_complex_place_url.sql', import.meta.url),
  'utf8',
)

const createDatabase = (): DatabaseSync => {
  const database = new DatabaseSync(':memory:')
  database.exec('PRAGMA foreign_keys = ON')
  database.exec(`CREATE TABLE complex (
    complex_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    legal_address TEXT NOT NULL,
    lat REAL,
    lng REAL,
    household_count INTEGER,
    updated_at TEXT NOT NULL
  ) STRICT;
  CREATE TABLE complex_staging (
    complex_id TEXT PRIMARY KEY
  ) STRICT;`)
  database.exec(migration)
  return database
}

const outcome = (
  overrides: Partial<ComplexPlaceUrlOutcome> = {},
): ComplexPlaceUrlOutcome => ({
  complexId: 'A13583507',
  status: 'filled',
  placeUrl: 'http://place.map.kakao.com/11335658',
  apiAttempts: 1,
  reason: null,
  ...overrides,
})

describe('complex place URL D1 checkpoint', () => {
  it('uses the rollback-safe D1 file import path', () => {
    expect(COMPLEX_PLACE_URL_WRITE_INPUT).toBe('file')
  })

  it('updates only place_url and checkpoints idempotently', () => {
    const database = createDatabase()
    database.exec(`INSERT INTO complex (
      complex_id, name, legal_address, lat, lng, household_count, updated_at
    ) VALUES (
      'A13583507', '은마', '서울 강남구 대치동 316',
      37.49741836284779, 127.06532735974666, 4424, 'before'
    );`)
    database.exec(
      complexPlaceUrlOutcomeStatements(
        [outcome()],
        '2026-08-10T00:00:00.000Z',
      ),
    )
    database.exec(
      complexPlaceUrlOutcomeStatements(
        [outcome()],
        '2026-08-10T00:01:00.000Z',
      ),
    )

    expect(
      database.prepare(`SELECT place_url, household_count, updated_at
                          FROM complex`).get(),
    ).toEqual({
      place_url: 'http://place.map.kakao.com/11335658',
      household_count: 4_424,
      updated_at: 'before',
    })
    expect(
      database.prepare(`SELECT status, attempt_count, api_attempt_count
                          FROM complex_place_url_checkpoint`).get(),
    ).toEqual({
      status: 'filled',
      attempt_count: 2,
      api_attempt_count: 2,
    })
    database.close()
  })

  it('selects unchecked null URLs and excludes checkpointed failures by default', () => {
    const database = createDatabase()
    database.exec(`INSERT INTO complex VALUES
      ('near', '가까운단지', '서울 중구', 37.5172, 127.0473, 100, 'now', NULL),
      ('missing', '좌표없는단지', '서울 중구', NULL, NULL, 100, 'now', NULL),
      ('known', 'URL있는단지', '서울 중구', 37.5172, 127.0473, 100, 'now', 'http://example.test'),
      ('failed', '실패단지', '서울 중구', 37.5172, 127.0473, 100, 'now', NULL),
      ('no-result', '결과없는단지', '서울 중구', 37.5172, 127.0473, 100, 'now', NULL),
      ('too-far', '먼단지', '서울 중구', 37.5172, 127.0473, 100, 'now', NULL),
      ('missing-coordinates', '좌표실패단지', '서울 중구', NULL, NULL, 100, 'now', NULL),
      ('response-error', '응답실패단지', '서울 중구', 37.5172, 127.0473, 100, 'now', NULL);
      INSERT INTO complex_place_url_checkpoint VALUES
      ('failed', 'candidateMismatch', 1, 1, 'mismatch', 'now'),
      ('no-result', 'noResult', 1, 1, 'empty', 'now'),
      ('too-far', 'tooFar', 1, 1, 'far', 'now'),
      ('missing-coordinates', 'missingCoordinates', 1, 0, 'missing', 'now'),
      ('response-error', 'responseError', 1, 1, 'error', 'now');`)

    expect(database.prepare(complexPlaceUrlTargetsSql(10, false)).all())
      .toEqual([
        {
          complex_id: 'near',
          name: '가까운단지',
          legal_address: '서울 중구',
          lat: 37.5172,
          lng: 127.0473,
        },
        {
          complex_id: 'missing',
          name: '좌표없는단지',
          legal_address: '서울 중구',
          lat: null,
          lng: null,
        },
      ])
    expect(database.prepare(complexPlaceUrlTargetsSql(10, true)).all())
      .toEqual([
        {
          complex_id: 'failed',
          name: '실패단지',
          legal_address: '서울 중구',
          lat: 37.5172,
          lng: 127.0473,
        },
        {
          complex_id: 'no-result',
          name: '결과없는단지',
          legal_address: '서울 중구',
          lat: 37.5172,
          lng: 127.0473,
        },
      ])
    database.close()
  })
})
