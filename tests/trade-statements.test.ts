import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

import { describe, expect, it } from 'vitest'

import type { TradeDatasetResult, TradeRefreshPlan } from '../shared/trade'
import {
  activateTradeRefreshStatements,
  checkpointTradeDatasetStatement,
  clearTradeDatasetStatements,
  insertTradeDatasetStatements,
  startTradeRefreshStatements,
  tradeValidationSql,
} from '../worker/trade/statements'

const migration = (name: string): string =>
  readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8')

const executeBatch = (
  database: DatabaseSync,
  statements: readonly string[],
): void => {
  database.exec(`BEGIN; ${statements.join(';\n')}; COMMIT;`)
}

describe('trade refresh D1 statements', () => {
  it('checkpoints staging and atomically activates a validated snapshot', () => {
    const database = new DatabaseSync(':memory:')
    database.exec('PRAGMA foreign_keys = ON')
    database.exec(migration('0001_complex.sql'))
    database.exec(migration('0003_trade.sql'))
    database.exec(
      `INSERT INTO complex (
         complex_id, name, legal_address, legal_dong_code,
         building_count, household_count, updated_at
       ) VALUES (
         'A1', '은마아파트', '서울특별시 강남구 대치동 316',
         '1168010600', 1, 1, '2026-08-04'
       )`,
    )
    const plan: TradeRefreshPlan = {
      refreshId: 'refresh-1',
      cutoffDate: '2025-08-04',
      windowEndDate: '2026-08-04',
      legalDistrictCodes: ['11680'],
      dealYearMonths: ['202608'],
      datasetCount: 1,
    }
    const result: TradeDatasetResult = {
      dataset: {
        source: 'apt',
        legalDistrictCode: '11680',
        dealYearMonth: '202608',
      },
      trades: [
        {
          tradeId: 'trade-1',
          complexId: 'A1',
          source: 'apt',
          matchLevel: 'lot',
          dealDate: '2026-08-01',
          dealAmount: 2_700_000_000,
          exclusiveArea: 84.43,
          floor: 10,
        },
      ],
      stats: {
        rawCount: 1,
        canceledCount: 0,
        duplicateCount: 0,
        outsideWindowCount: 0,
        activeCount: 1,
        matchedCount: 1,
        lotCount: 1,
        candidateCount: 0,
        ambiguousCount: 0,
        unmatchedCount: 0,
      },
    }

    executeBatch(
      database,
      startTradeRefreshStatements(plan, '2026-08-04T00:00:00.000Z'),
    )
    const datasetStatements = [
      ...clearTradeDatasetStatements(plan.refreshId, result),
      ...insertTradeDatasetStatements(
        plan.refreshId,
        result,
        '2026-08-04T00:00:00.000Z',
      ),
      checkpointTradeDatasetStatement(
        plan.refreshId,
        result,
        '2026-08-04T00:00:00.000Z',
      ),
    ]
    executeBatch(database, datasetStatements)
    executeBatch(database, datasetStatements)

    expect(database.prepare(tradeValidationSql(plan.refreshId)).get()).toMatchObject({
      completed_dataset_count: 1,
      matched_count: 1,
      staged_trade_count: 1,
      orphan_trade_count: 0,
    })
    executeBatch(
      database,
      activateTradeRefreshStatements(
        plan.refreshId,
        '2026-08-04T00:01:00.000Z',
      ),
    )
    executeBatch(
      database,
      activateTradeRefreshStatements(
        plan.refreshId,
        '2026-08-04T00:01:00.000Z',
      ),
    )
    expect(database.prepare('SELECT trade_id FROM trade').all()).toEqual([
      { trade_id: 'trade-1' },
    ])
    expect(
      database
        .prepare('SELECT status FROM trade_refresh_state WHERE singleton = 1')
        .get(),
    ).toEqual({ status: 'completed' })
    database.close()
  })
})
