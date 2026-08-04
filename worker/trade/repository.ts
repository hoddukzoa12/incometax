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
  toTradeRefreshState,
  toTradeRefreshValidation,
  toComplexMatchCandidate,
  tradeCheckpointKey,
} from './repository-data.ts'
import {
  activateTradeRefreshStatements,
  checkpointTradeDatasetStatement,
  clearTradeDatasetStatements,
  insertTradeDatasetStatements,
  startTradeRefreshStatements,
  tradeValidationSql,
} from './statements.ts'

export class D1TradeRefreshRepository implements TradeRefreshRepository {
  readonly #database: D1Database

  constructor(database: D1Database) {
    this.#database = database
  }

  async #batch(statements: readonly string[]): Promise<void> {
    if (statements.length === 0) return
    // D1 batch either commits every prepared statement or rolls the batch back.
    await this.#database.batch(
      statements.map((statement) => this.#database.prepare(statement)),
    )
  }

  async loadComplexes(): Promise<readonly ComplexMatchCandidate[]> {
    const result = await this.#database
      .prepare(
        `SELECT complex_id, name, legal_address, legal_dong_code
           FROM complex
          ORDER BY complex_id`,
      )
      .all<ComplexMatchCandidateRow>()
    return result.results.map(toComplexMatchCandidate)
  }

  async readRefreshState(): Promise<TradeRefreshState | null> {
    const row = await this.#database
      .prepare(
        `SELECT refresh_id, status, cutoff_date, window_end_date,
                legal_district_codes_json, deal_year_months_json, dataset_count
           FROM trade_refresh_state
          WHERE singleton = 1`,
      )
      .first<TradeRefreshStateRow>()
    return row ? toTradeRefreshState(row) : null
  }

  async startRefresh(
    plan: TradeRefreshPlan,
    startedAt: string,
  ): Promise<void> {
    await this.#batch(startTradeRefreshStatements(plan, startedAt))
  }

  async readCompletedDatasetKeys(
    refreshId: string,
  ): Promise<ReadonlySet<string>> {
    const result = await this.#database
      .prepare(
        `SELECT source, legal_district_code, deal_year_month
           FROM trade_dataset_checkpoint
          WHERE refresh_id = ?1`,
      )
      .bind(refreshId)
      .all<TradeDatasetCheckpointRow>()
    return new Set(result.results.map(tradeCheckpointKey))
  }

  async saveDataset(
    refreshId: string,
    result: TradeDatasetResult,
    updatedAt: string,
  ): Promise<void> {
    await this.#batch([
      ...clearTradeDatasetStatements(refreshId, result),
      ...insertTradeDatasetStatements(refreshId, result, updatedAt),
      checkpointTradeDatasetStatement(refreshId, result, updatedAt),
    ])
  }

  async readValidation(refreshId: string): Promise<TradeRefreshValidation> {
    const row = await this.#database
      .prepare(tradeValidationSql(refreshId))
      .first<TradeRefreshValidationRow>()
    if (!row) throw new Error('Trade refresh validation returned no row')
    return toTradeRefreshValidation(row)
  }

  async activate(refreshId: string, completedAt: string): Promise<void> {
    await this.#batch(activateTradeRefreshStatements(refreshId, completedAt))
  }
}
