import type { TradeRefreshRunResult } from '../../shared/trade.ts'
import { runTradeRefresh } from './ingest.ts'
import { D1TradeRefreshRepository } from './repository.ts'

const CRON_DATASET_LIMIT = 32

export const refreshTradesFromCron = async (
  database: D1Database,
  serviceKey: string,
  scheduledTime: number,
): Promise<TradeRefreshRunResult> => {
  const result = await runTradeRefresh(
    new D1TradeRefreshRepository(database),
    serviceKey,
    new Date(scheduledTime),
    CRON_DATASET_LIMIT,
  )
  if (result.failures.length > 0) {
    throw new Error(
      `Trade refresh slice failed for ${result.failures.length} datasets`,
    )
  }
  return result
}
