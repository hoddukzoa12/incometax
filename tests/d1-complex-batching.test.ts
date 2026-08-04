import { Buffer } from 'node:buffer'
import { DatabaseSync } from 'node:sqlite'

import { describe, expect, it } from 'vitest'

import type {
  ComplexListRecord,
  ComplexStagingRecord,
} from '../shared/complex.ts'
import {
  complexListCheckpointStatements,
  complexDraftUpsertStatements,
  D1_SQL_STATEMENT_MAX_BYTES,
} from '../scripts/lib/d1-complex-statements.ts'

const draft = (index: number): ComplexStagingRecord => ({
  complexId: `A${String(index).padStart(8, '0')}`,
  name: `O'Brien 단지 ${index}`,
  legalAddress: `서울특별시 강남구 테스트동 ${index}`,
  roadAddress: `서울특별시 강남구 테스트로 ${index}`,
  legalDongCode: '1168010600',
  approvalDate: '2026-08-04',
  buildingCount: 10,
  householdCount: 700,
  lat: 37.5,
  lng: 127,
  lookupStatus: 'matched',
  backfillReason: null,
})

const listRecord = (index: number): ComplexListRecord => ({
  complexId: `A${String(index).padStart(8, '0')}`,
  name: `래미안 디에이치 센트럴파크 ${index}단지`,
  legalDongCode: `11${String(index).padStart(8, '0')}`,
  province: '서울특별시',
  district: '강남구',
  legalDong: '대치동',
  ri: index % 2 === 0 ? null : '테스트리',
})

describe('complex D1 write batching', () => {
  it('checkpoints a realistic full-size 1,000-record K-apt page as rows', () => {
    const records = Array.from({ length: 1_000 }, (_, index) =>
      listRecord(index),
    )
    const statements = complexListCheckpointStatements(1, records)
    const database = new DatabaseSync(':memory:')
    database.exec(`CREATE TABLE complex_list_checkpoint (
      page INTEGER NOT NULL,
      complex_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      legal_dong_code TEXT NOT NULL,
      province TEXT,
      district TEXT,
      legal_dong TEXT,
      ri TEXT,
      PRIMARY KEY (page, complex_id)
    ) STRICT;`)

    expect(statements.length).toBeGreaterThan(1)
    expect(
      statements.every(
        (statement) =>
          Buffer.byteLength(statement, 'utf8') <= D1_SQL_STATEMENT_MAX_BYTES,
      ),
    ).toBe(true)
    database.exec(statements.join('\n'))
    expect(
      database
        .prepare(
          'SELECT page, COUNT(*) AS record_count FROM complex_list_checkpoint GROUP BY page',
        )
        .get(),
    ).toEqual({ page: 1, record_count: 1_000 })
    database.close()
  })

  it('chunks thousands of rows into valid sub-100KB INSERT statements', () => {
    const records = Array.from({ length: 5_000 }, (_, index) => draft(index))
    const statements = complexDraftUpsertStatements(
      records,
      '2026-08-04T00:00:00.000Z',
    )

    expect(statements.length).toBeGreaterThan(1)
    expect(statements.length).toBeLessThan(20)
    expect(
      statements.every(
        (statement) =>
          Buffer.byteLength(statement, 'utf8') <= D1_SQL_STATEMENT_MAX_BYTES,
      ),
    ).toBe(true)
  })

  it('preserves SQL escaping and upsert semantics across statements', () => {
    const database = new DatabaseSync(':memory:')
    database.exec(`CREATE TABLE complex_staging (
      complex_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      legal_address TEXT NOT NULL,
      road_address TEXT,
      legal_dong_code TEXT NOT NULL,
      approval_date TEXT,
      building_count INTEGER NOT NULL,
      household_count INTEGER NOT NULL,
      lat REAL,
      lng REAL,
      lookup_status TEXT NOT NULL,
      backfill_reason TEXT,
      updated_at TEXT NOT NULL
    ) STRICT;`)
    const record = draft(1)
    const statements = complexDraftUpsertStatements(
      [record],
      '2026-08-04T00:00:00.000Z',
    )
    database.exec(statements.join('\n'))
    database.exec(
      complexDraftUpsertStatements(
        [{ ...record, name: 'updated' }],
        '2026-08-04T01:00:00.000Z',
      ).join('\n'),
    )

    expect(
      database
        .prepare('SELECT name, updated_at FROM complex_staging')
        .get(),
    ).toEqual({
      name: 'updated',
      updated_at: '2026-08-04T01:00:00.000Z',
    })
    database.close()
  })
})
