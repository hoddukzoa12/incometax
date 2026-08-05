import type {
  ComplexMatchCandidate,
  ComplexMatchCandidateRow,
  TradeDatasetCheckpointRow,
  TradeDatasetResult,
  TradeRefreshPlan,
  TradeRefreshRepository,
  TradeRefreshState,
  TradeRefreshStateRow,
  TradeRefreshValidation,
  TradeRefreshValidationRow,
} from '../../shared/trade.ts'
import {
  activateTradeRefreshStatements,
  checkpointTradeDatasetStatement,
  clearTradeDatasetStatements,
  insertTradeDatasetStatements,
  startTradeRefreshStatements,
  tradeValidationSql,
} from '../../worker/trade/statements.ts'
import {
  toTradeRefreshState,
  toTradeRefreshValidation,
  toComplexMatchCandidate,
  tradeCheckpointKey,
} from '../../worker/trade/repository-data.ts'
import { sqlString } from '../../worker/d1/sql.ts'
import { queryD1Rows, runD1, type D1Location } from './d1.ts'

export class CliTradeRefreshRepository implements TradeRefreshRepository {
  readonly #location: D1Location

  constructor(location: D1Location) {
    this.#location = location
  }

  async loadComplexes(): Promise<readonly ComplexMatchCandidate[]> {
    const rows = await queryD1Rows<ComplexMatchCandidateRow>(
      `SELECT complex_id, name, legal_address, legal_dong_code
         FROM complex
        WHERE lookup_status = 'matched'
        ORDER BY complex_id`,
      this.#location,
    )
    return rows.map(toComplexMatchCandidate)
  }

  async readRefreshState(): Promise<TradeRefreshState | null> {
    const rows = await queryD1Rows<TradeRefreshStateRow>(
      `SELECT refresh_id, status, cutoff_date, window_end_date,
              legal_district_codes_json, deal_year_months_json, dataset_count
         FROM trade_refresh_state
        WHERE singleton = 1`,
      this.#location,
    )
    return rows[0] ? toTradeRefreshState(rows[0]) : null
  }

  async startRefresh(
    plan: TradeRefreshPlan,
    startedAt: string,
  ): Promise<void> {
    await runD1(
      startTradeRefreshStatements(plan, startedAt).join(';\n'),
      this.#location,
    )
  }

  async readCompletedDatasetKeys(
    refreshId: string,
  ): Promise<ReadonlySet<string>> {
    const rows = await queryD1Rows<TradeDatasetCheckpointRow>(
      `SELECT source, legal_district_code, deal_year_month
         FROM trade_dataset_checkpoint
        WHERE refresh_id = ${sqlString(refreshId)}`,
      this.#location,
    )
    return new Set(rows.map(tradeCheckpointKey))
  }

  async saveDataset(
    refreshId: string,
    result: TradeDatasetResult,
    updatedAt: string,
  ): Promise<void> {
    // Staging writes may span several CLI calls, but the checkpoint is written
    // last. A retry first clears the uncheckpointed slice, while `trade` remains
    // untouched until the final atomic activation.
    await runD1(
      clearTradeDatasetStatements(refreshId, result).join(';\n'),
      this.#location,
    )
    for (const statement of insertTradeDatasetStatements(
      refreshId,
      result,
      updatedAt,
    )) {
      await runD1(statement, this.#location)
    }
    await runD1(
      checkpointTradeDatasetStatement(refreshId, result, updatedAt),
      this.#location,
    )
  }

  async readValidation(refreshId: string): Promise<TradeRefreshValidation> {
    const rows = await queryD1Rows<TradeRefreshValidationRow>(
      tradeValidationSql(refreshId),
      this.#location,
    )
    if (!rows[0]) throw new Error('Trade refresh validation returned no row')
    return toTradeRefreshValidation(rows[0])
  }

  async activate(refreshId: string, completedAt: string): Promise<void> {
    // Wrangler maps these statements to one transactional D1 batch.
    await runD1(
      activateTradeRefreshStatements(refreshId, completedAt).join(';\n'),
      this.#location,
    )
  }
}
