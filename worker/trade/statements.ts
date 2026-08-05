import type {
  TradeDatasetResult,
  TradeRefreshPlan,
} from '../../shared/trade.ts'
import { sqlNullableNumber, sqlString } from '../d1/sql.ts'

const TRADE_INSERT_BATCH_SIZE = 125

export const startTradeRefreshStatements = (
  plan: TradeRefreshPlan,
  startedAt: string,
): readonly string[] => [
  'DELETE FROM trade_staging',
  'DELETE FROM trade_dataset_checkpoint',
  `INSERT INTO trade_refresh_state (
     singleton, refresh_id, status, cutoff_date, window_end_date,
     legal_district_codes_json, deal_year_months_json, dataset_count,
     started_at, completed_at
   ) VALUES (
     1, ${sqlString(plan.refreshId)}, 'inProgress',
     ${sqlString(plan.cutoffDate)}, ${sqlString(plan.windowEndDate)},
     ${sqlString(JSON.stringify(plan.legalDistrictCodes))},
     ${sqlString(JSON.stringify(plan.dealYearMonths))},
     ${plan.datasetCount}, ${sqlString(startedAt)}, NULL
   ) ON CONFLICT(singleton) DO UPDATE SET
     refresh_id = excluded.refresh_id,
     status = excluded.status,
     cutoff_date = excluded.cutoff_date,
     window_end_date = excluded.window_end_date,
     legal_district_codes_json = excluded.legal_district_codes_json,
     deal_year_months_json = excluded.deal_year_months_json,
     dataset_count = excluded.dataset_count,
     started_at = excluded.started_at,
     completed_at = excluded.completed_at`,
]

export const clearTradeDatasetStatements = (
  refreshId: string,
  result: TradeDatasetResult,
): readonly string[] => {
  const dataset = result.dataset
  const predicate = `refresh_id = ${sqlString(refreshId)}
      AND source = ${sqlString(dataset.source)}
      AND legal_district_code = ${sqlString(dataset.legalDistrictCode)}
      AND deal_year_month = ${sqlString(dataset.dealYearMonth)}`
  return [
    `DELETE FROM trade_staging WHERE ${predicate}`,
    `DELETE FROM trade_dataset_checkpoint WHERE ${predicate}`,
  ]
}

export const insertTradeDatasetStatements = (
  refreshId: string,
  result: TradeDatasetResult,
  updatedAt: string,
): readonly string[] => {
  const statements: string[] = []
  for (
    let offset = 0;
    offset < result.trades.length;
    offset += TRADE_INSERT_BATCH_SIZE
  ) {
    const values = result.trades
      .slice(offset, offset + TRADE_INSERT_BATCH_SIZE)
      .map(
        (trade) =>
          `(${[
            sqlString(refreshId),
            sqlString(trade.tradeId),
            sqlString(trade.complexId),
            sqlString(trade.source),
            sqlString(result.dataset.legalDistrictCode),
            sqlString(result.dataset.dealYearMonth),
            sqlString(trade.matchLevel),
            sqlString(trade.dealDate),
            trade.dealAmount,
            trade.exclusiveArea,
            sqlNullableNumber(trade.floor),
            sqlString(updatedAt),
          ].join(', ')})`,
      )
      .join(',\n')
    statements.push(
      `INSERT INTO trade_staging (
         refresh_id, trade_id, complex_id, source, legal_district_code,
         deal_year_month, match_level, deal_date, deal_amount,
         exclusive_area, floor, updated_at
       ) VALUES ${values}
       ON CONFLICT(refresh_id, trade_id) DO UPDATE SET
         complex_id = excluded.complex_id,
         match_level = excluded.match_level,
         deal_date = excluded.deal_date,
         deal_amount = excluded.deal_amount,
         exclusive_area = excluded.exclusive_area,
         floor = excluded.floor,
         updated_at = excluded.updated_at`,
    )
  }
  return statements
}

export const checkpointTradeDatasetStatement = (
  refreshId: string,
  result: TradeDatasetResult,
  completedAt: string,
): string => {
  const { dataset, stats } = result
  return `INSERT INTO trade_dataset_checkpoint (
      refresh_id, source, legal_district_code, deal_year_month,
      raw_count, canceled_count, duplicate_count, outside_window_count,
      active_count, matched_count, lot_count, candidate_count,
      ambiguous_count, unmatched_count, completed_at
    ) SELECT
      ${sqlString(refreshId)}, ${sqlString(dataset.source)},
      ${sqlString(dataset.legalDistrictCode)},
      ${sqlString(dataset.dealYearMonth)}, ${stats.rawCount},
      ${stats.canceledCount}, ${stats.duplicateCount},
      ${stats.outsideWindowCount}, ${stats.activeCount},
      ${stats.matchedCount}, ${stats.lotCount}, ${stats.candidateCount},
      ${stats.ambiguousCount}, ${stats.unmatchedCount},
      ${sqlString(completedAt)}
    WHERE EXISTS (
      SELECT 1 FROM trade_refresh_state
       WHERE singleton = 1
         AND refresh_id = ${sqlString(refreshId)}
         AND status = 'inProgress'
    )`
}

export const tradeValidationSql = (refreshId: string): string => `
  WITH checkpoint AS (
    SELECT COUNT(*) AS completed_dataset_count,
           COALESCE(SUM(raw_count), 0) AS raw_count,
           COALESCE(SUM(canceled_count), 0) AS canceled_count,
           COALESCE(SUM(duplicate_count), 0) AS duplicate_count,
           COALESCE(SUM(outside_window_count), 0) AS outside_window_count,
           COALESCE(SUM(active_count), 0) AS active_count,
           COALESCE(SUM(matched_count), 0) AS matched_count,
           COALESCE(SUM(lot_count), 0) AS lot_count,
           COALESCE(SUM(candidate_count), 0) AS candidate_count,
           COALESCE(SUM(ambiguous_count), 0) AS ambiguous_count,
           COALESCE(SUM(unmatched_count), 0) AS unmatched_count
      FROM trade_dataset_checkpoint
     WHERE refresh_id = ${sqlString(refreshId)}
  ), staged AS (
    SELECT COUNT(*) AS staged_trade_count
      FROM trade_staging
     WHERE refresh_id = ${sqlString(refreshId)}
  ), orphaned AS (
    SELECT COUNT(*) AS orphan_trade_count
      FROM trade_staging AS staged_trade
      LEFT JOIN complex ON complex.complex_id = staged_trade.complex_id
     WHERE staged_trade.refresh_id = ${sqlString(refreshId)}
       AND complex.complex_id IS NULL
  )
  SELECT * FROM checkpoint, staged, orphaned`

export const activateTradeRefreshStatements = (
  refreshId: string,
  completedAt: string,
): readonly string[] => [
  `DELETE FROM trade
    WHERE EXISTS (
      SELECT 1 FROM trade_refresh_state
       WHERE singleton = 1
         AND refresh_id = ${sqlString(refreshId)}
         AND status = 'inProgress'
    )`,
  `INSERT INTO trade (
     trade_id, complex_id, source, match_level, deal_date, deal_amount,
     exclusive_area, floor, updated_at
   ) SELECT
     trade_id, complex_id, source, match_level, deal_date, deal_amount,
     exclusive_area, floor, updated_at
   FROM trade_staging
   WHERE refresh_id = ${sqlString(refreshId)}
     AND EXISTS (
       SELECT 1 FROM trade_refresh_state
        WHERE singleton = 1
          AND refresh_id = ${sqlString(refreshId)}
          AND status = 'inProgress'
     )`,
  `UPDATE trade_refresh_state
      SET status = 'completed', completed_at = ${sqlString(completedAt)}
    WHERE singleton = 1 AND refresh_id = ${sqlString(refreshId)}`,
]
