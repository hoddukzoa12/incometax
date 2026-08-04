import { resolve } from 'node:path'
import { parseArgs } from 'node:util'

import { CliTradeRefreshRepository } from './lib/d1-trade.ts'
import type { D1Location } from './lib/d1.ts'
import { writeJsonReport } from './lib/json-report.ts'
import { runTradeRefresh } from '../worker/trade/ingest.ts'

const SERVICE_KEY_ENV_NAME = 'DATA_GO_KR_SERVICE_KEY'
const UNBOUNDED_DATASET_LIMIT = Number.MAX_SAFE_INTEGER

const main = async (): Promise<void> => {
  const { values } = parseArgs({
    options: {
      output: { type: 'string' },
      remote: { type: 'boolean', default: false },
    },
    strict: true,
  })
  if (!values.output) {
    throw new Error(
      'Usage: npm run ingest:trades -- --output <report.json> [--remote]',
    )
  }

  const serviceKey = process.env[SERVICE_KEY_ENV_NAME]
  if (!serviceKey) throw new Error(`Missing ${SERVICE_KEY_ENV_NAME}`)
  const location: D1Location = values.remote ? 'remote' : 'local'
  const result = await runTradeRefresh(
    new CliTradeRefreshRepository(location),
    serviceKey,
    new Date(),
    UNBOUNDED_DATASET_LIMIT,
  )
  await writeJsonReport(resolve(values.output), result)
  console.log(JSON.stringify(result, null, 2))

  if (result.failures.length > 0 || !result.activated) {
    throw new Error(
      `Trade ingestion incomplete; ${result.remainingDatasetCount} datasets remain`,
    )
  }
}

await main().catch((error: unknown) => {
  const reason = error instanceof Error ? error.message : String(error)
  console.error(`Trade ingestion stopped cleanly: ${reason}`)
  process.exitCode = 1
})
