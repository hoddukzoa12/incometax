import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

import { describe, expect, it } from 'vitest'

import {
  COMPLEX_ACTIVATION_INPUT,
  COMPLEX_ACTIVATION_SQL,
  COMPLEX_RETRY_STAGING_SQL,
} from '../scripts/lib/d1-complex.ts'

const migration = (name: string): string =>
  readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8')

const complexValues = (id: string, name: string): string =>
  `('${id}', '${name}', '서울특별시 강남구 대치동 316', NULL,
    '1168010600', NULL, 1, 1, 37.5, 127.0, '2026-08-04')`

describe('complex activation with trade foreign keys', () => {
  it('uses the rollback-safe D1 file import path in production', () => {
    expect(COMPLEX_ACTIVATION_INPUT).toBe('file')
  })

  it('preserves retained-complex trades and cascades only vanished complexes', () => {
    const database = new DatabaseSync(':memory:')
    database.exec('PRAGMA foreign_keys = ON')
    database.exec(migration('0001_complex.sql'))
    database.exec(migration('0003_trade.sql'))
    database.exec(migration('0005_complex_lookup.sql'))
    database.exec(
      `INSERT INTO complex (
         complex_id, name, legal_address, road_address, legal_dong_code,
         approval_date, building_count, household_count, lat, lng, updated_at
       ) VALUES ${complexValues('retained', '기존 이름')},
                ${complexValues('vanished', '사라질 단지')};
       INSERT INTO complex_staging (
         complex_id, name, legal_address, road_address, legal_dong_code,
         approval_date, building_count, household_count, lat, lng, updated_at
       ) VALUES ${complexValues('retained', '갱신 이름')},
                ${complexValues('added', '새 단지')};
       INSERT INTO trade (
         trade_id, complex_id, source, match_level, deal_date, deal_amount,
         exclusive_area, floor, updated_at
       ) VALUES
         ('retained-trade', 'retained', 'apt', 'lot', '2026-08-01',
          2700000000, 84.43, 10, '2026-08-04'),
         ('vanished-trade', 'vanished', 'apt', 'lot', '2026-08-01',
          1000000000, 59.9, 5, '2026-08-04');
       INSERT INTO trade_staging (
         refresh_id, trade_id, complex_id, source, legal_district_code,
         deal_year_month, match_level, deal_date, deal_amount,
         exclusive_area, floor, updated_at
       ) VALUES (
         'refresh-1', 'staged-vanished', 'vanished', 'apt', '11680',
         '202608', 'lot', '2026-08-01', 1000000000, 59.9, 5,
         '2026-08-04'
       );
       INSERT INTO trade_dataset_checkpoint (
         refresh_id, source, legal_district_code, deal_year_month,
         raw_count, canceled_count, duplicate_count, outside_window_count,
         active_count, matched_count, lot_count, candidate_count,
         ambiguous_count, unmatched_count, completed_at
       ) VALUES (
         'refresh-1', 'apt', '11680', '202608', 1, 0, 0, 0,
         1, 1, 1, 0, 0, 0, '2026-08-04'
       );`,
    )
    const retainedRowId = database
      .prepare("SELECT rowid FROM complex WHERE complex_id = 'retained'")
      .get()?.rowid

    database.exec(COMPLEX_ACTIVATION_SQL)

    expect(
      database
        .prepare('SELECT complex_id, name FROM complex ORDER BY complex_id')
        .all(),
    ).toEqual([
      { complex_id: 'added', name: '새 단지' },
      { complex_id: 'retained', name: '갱신 이름' },
    ])
    expect(
      database.prepare('SELECT trade_id FROM trade ORDER BY trade_id').all(),
    ).toEqual([{ trade_id: 'retained-trade' }])
    expect(
      database.prepare('SELECT COUNT(*) AS count FROM trade_dataset_checkpoint').get(),
    ).toEqual({ count: 0 })
    expect(
      database
        .prepare("SELECT rowid FROM complex WHERE complex_id = 'retained'")
        .get()?.rowid,
    ).toBe(retainedRowId)
    database.close()
  })
})

describe('complex failed-lookup retry staging', () => {
  it('replaces partial staging with the complete active baseline', () => {
    const database = new DatabaseSync(':memory:')
    database.exec(migration('0001_complex.sql'))
    database.exec(migration('0005_complex_lookup.sql'))
    database.exec(
      `INSERT INTO complex (
         complex_id, name, legal_address, road_address, legal_dong_code,
         approval_date, building_count, household_count, lat, lng, updated_at
       ) VALUES ${complexValues('matched', '매칭 단지')},
                ${complexValues('rejected', '재시도 단지')};
       UPDATE complex SET lookup_status = 'matched'
        WHERE complex_id = 'matched';
       UPDATE complex
          SET lookup_status = 'rejected', lat = NULL, lng = NULL,
              backfill_reason = 'old rejection'
        WHERE complex_id = 'rejected';
       INSERT INTO complex_staging (
         complex_id, name, legal_address, road_address, legal_dong_code,
         approval_date, building_count, household_count, lat, lng, updated_at
       ) VALUES ${complexValues('partial', '부분 데이터')};`,
    )

    database.exec(`BEGIN; ${COMPLEX_RETRY_STAGING_SQL} COMMIT;`)

    expect(
      database
        .prepare(
          `SELECT complex_id, lookup_status, backfill_reason
             FROM complex_staging
            ORDER BY complex_id`,
        )
        .all(),
    ).toEqual([
      {
        complex_id: 'matched',
        lookup_status: 'matched',
        backfill_reason: null,
      },
      {
        complex_id: 'rejected',
        lookup_status: 'rejected',
        backfill_reason: 'old rejection',
      },
    ])
    database.close()
  })
})
