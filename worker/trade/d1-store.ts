import type { RecentTrade, StagedTrade } from '../../shared/trade'
import type {
  ComplexTradeStore,
  ComplexTradeTarget,
} from './on-demand'

const INSERT_COLUMN_COUNT = 9
const MAXIMUM_D1_BOUND_PARAMETERS = 100
const TRADE_INSERT_BATCH_SIZE = Math.floor(
  MAXIMUM_D1_BOUND_PARAMETERS / INSERT_COLUMN_COUNT,
)

interface ComplexTradeTargetRow {
  readonly complex_id: string
  readonly name: string
  readonly legal_address: string
  readonly legal_dong_code: string
  readonly trade_cached_at: string | null
}

interface RecentTradeRow {
  readonly trade_id: string
  readonly source: RecentTrade['source']
  readonly match_level: RecentTrade['matchLevel']
  readonly deal_date: string
  readonly deal_amount: number
  readonly exclusive_area: number
  readonly floor: number | null
}

const toRecentTrade = (row: RecentTradeRow): RecentTrade => ({
  tradeId: row.trade_id,
  source: row.source,
  matchLevel: row.match_level,
  dealDate: row.deal_date,
  dealAmount: row.deal_amount,
  exclusiveArea: row.exclusive_area,
  floor: row.floor,
})

const insertStatement = (
  database: D1Database,
  trades: readonly StagedTrade[],
  cachedAt: string,
): D1PreparedStatement => {
  const values = trades
    .map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .join(', ')
  return database.prepare(
    `INSERT INTO trade (
       trade_id, complex_id, source, match_level, deal_date, deal_amount,
       exclusive_area, floor, updated_at
     ) SELECT column1, column2, column3, column4, column5,
              CAST(column6 AS INTEGER), column7,
              CASE WHEN column8 IS NULL THEN NULL ELSE CAST(column8 AS INTEGER) END,
              column9
         FROM (VALUES ${values})`,
  ).bind(
    ...trades.flatMap((trade) => [
      trade.tradeId,
      trade.complexId,
      trade.source,
      trade.matchLevel,
      trade.dealDate,
      trade.dealAmount,
      trade.exclusiveArea,
      trade.floor,
      cachedAt,
    ]),
  )
}

export class D1ComplexTradeStore implements ComplexTradeStore {
  constructor(private readonly database: D1Database) {}

  async findTarget(complexId: string): Promise<ComplexTradeTarget | null> {
    const row = await this.database.prepare(
      `SELECT complex_id, name, legal_address, legal_dong_code,
              trade_cached_at
         FROM complex
        WHERE complex_id = ?1`,
    ).bind(complexId).first<ComplexTradeTargetRow>()
    if (!row) return null
    return {
      complexId: row.complex_id,
      name: row.name,
      legalAddress: row.legal_address,
      legalDongCode: row.legal_dong_code,
      tradeCachedAt: row.trade_cached_at,
    }
  }

  async readTrades(complexId: string): Promise<readonly RecentTrade[]> {
    const result = await this.database.prepare(
      `SELECT trade_id, source, match_level, deal_date, deal_amount,
              exclusive_area, floor
         FROM trade
        WHERE complex_id = ?1
        ORDER BY deal_date DESC, trade_id ASC`,
    ).bind(complexId).all<RecentTradeRow>()
    return result.results.map(toRecentTrade)
  }

  async replaceTrades(
    complexId: string,
    trades: readonly StagedTrade[],
    cachedAt: string,
  ): Promise<void> {
    const statements: D1PreparedStatement[] = [
      this.database.prepare('DELETE FROM trade WHERE complex_id = ?1')
        .bind(complexId),
    ]
    for (
      let offset = 0;
      offset < trades.length;
      offset += TRADE_INSERT_BATCH_SIZE
    ) {
      statements.push(insertStatement(
        this.database,
        trades.slice(offset, offset + TRADE_INSERT_BATCH_SIZE),
        cachedAt,
      ))
    }
    statements.push(
      this.database.prepare(
        'UPDATE complex SET trade_cached_at = ?1 WHERE complex_id = ?2',
      ).bind(cachedAt, complexId),
    )
    await this.database.batch(statements)
  }
}
