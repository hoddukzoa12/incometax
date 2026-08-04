import type {
  ComplexMatchCandidate,
  PreparedComplexMatchCandidate,
  TradeDataset,
  RawTrade,
  TradeRefreshPlan,
  TradeRefreshRepository,
  TradeRefreshRunResult,
  TradeRefreshState,
  TradeRefreshValidation,
} from '../../shared/trade.ts'
import {
  prepareComplexCandidate,
  prepareTradeDataset,
} from './matching.ts'
import { fetchTradeDataset } from './source.ts'
import {
  createTradeDatasets,
  recentDealYearMonths,
  tradeDatasetKey,
  tradeWindowDates,
} from './window.ts'

const DATASET_FETCH_CONCURRENCY = 4
const MAXIMUM_DATASET_FAILURES_PER_RUN = 3
const MINIMUM_STAGED_TRADE_COUNT = 1

const newRefreshPlan = (
  complexes: readonly ComplexMatchCandidate[],
  now: Date,
): TradeRefreshPlan => {
  const legalDistrictCodes = [
    ...new Set(
      complexes
        .map((complex) => complex.legalDongCode.slice(0, 5))
        .filter((code) => /^\d{5}$/.test(code)),
    ),
  ].sort()
  if (legalDistrictCodes.length === 0) {
    throw new Error('Complex master is empty; trade refresh was not started')
  }
  const dealYearMonths = recentDealYearMonths(now)
  const window = tradeWindowDates(now)
  return {
    refreshId: `${window.windowEndDate}-${crypto.randomUUID()}`,
    ...window,
    legalDistrictCodes,
    dealYearMonths,
    datasetCount: createTradeDatasets(
      legalDistrictCodes,
      dealYearMonths,
    ).length,
  }
}

const candidatesByLegalDistrict = (
  complexes: readonly ComplexMatchCandidate[],
): ReadonlyMap<string, readonly PreparedComplexMatchCandidate[]> => {
  const grouped = new Map<string, PreparedComplexMatchCandidate[]>()
  for (const complex of complexes) {
    const code = complex.legalDongCode.slice(0, 5)
    const candidates = grouped.get(code) ?? []
    candidates.push(prepareComplexCandidate(complex))
    grouped.set(code, candidates)
  }
  return grouped
}

const requireValidRefresh = (
  state: TradeRefreshState,
  datasets: readonly TradeDataset[],
): void => {
  if (datasets.length !== state.datasetCount) {
    throw new Error(
      `Trade refresh plan mismatch: ${datasets.length}/${state.datasetCount}`,
    )
  }
}

const validateSnapshot = (
  state: TradeRefreshState,
  validation: TradeRefreshValidation,
): void => {
  if (validation.completedDatasetCount !== state.datasetCount) {
    throw new Error(
      `Trade dataset validation failed: ${validation.completedDatasetCount}/${state.datasetCount}`,
    )
  }
  if (
    validation.rawCount !==
    validation.canceledCount +
      validation.duplicateCount +
      validation.outsideWindowCount +
      validation.activeCount
  ) {
    throw new Error('Trade row-count validation failed')
  }
  if (
    validation.activeCount !==
    validation.matchedCount +
      validation.ambiguousCount +
      validation.unmatchedCount
  ) {
    throw new Error('Trade matching-count validation failed')
  }
  if (
    validation.matchedCount !==
      validation.lotCount + validation.candidateCount ||
    validation.matchedCount !== validation.stagedTradeCount
  ) {
    throw new Error('Trade staged-count validation failed')
  }
  if (validation.orphanTradeCount !== 0) {
    throw new Error(`Trade refresh has ${validation.orphanTradeCount} orphans`)
  }
  if (validation.stagedTradeCount < MINIMUM_STAGED_TRADE_COUNT) {
    throw new Error('Trade refresh has no matched trades; existing data was kept')
  }
}

const matchingRate = (validation: TradeRefreshValidation): string =>
  validation.activeCount === 0
    ? '0.00'
    : ((validation.matchedCount / validation.activeCount) * 100).toFixed(2)

export const runTradeRefresh = async (
  repository: TradeRefreshRepository,
  serviceKey: string,
  now: Date,
  datasetLimit: number,
  log: (message: string) => void = console.log,
  readDataset: (
    dataset: TradeDataset,
    serviceKey: string,
  ) => Promise<readonly RawTrade[]> = (dataset, key) =>
    fetchTradeDataset(
      dataset.source,
      key,
      dataset.legalDistrictCode,
      dataset.dealYearMonth,
    ),
): Promise<TradeRefreshRunResult> => {
  if (!serviceKey) throw new Error('Missing DATA_GO_KR_SERVICE_KEY')
  if (!Number.isInteger(datasetLimit) || datasetLimit <= 0) {
    throw new TypeError('datasetLimit must be a positive integer')
  }

  const complexes = await repository.loadComplexes()
  let state = await repository.readRefreshState()
  if (!state || state.status === 'completed') {
    const plan = newRefreshPlan(complexes, now)
    await repository.startRefresh(plan, now.toISOString())
    state = { ...plan, status: 'inProgress' }
  }

  const datasets = createTradeDatasets(
    state.legalDistrictCodes,
    state.dealYearMonths,
  )
  requireValidRefresh(state, datasets)
  const completedKeys = new Set(
    await repository.readCompletedDatasetKeys(state.refreshId),
  )
  const pending = datasets
    .filter((dataset) => !completedKeys.has(tradeDatasetKey(dataset)))
    .slice(0, datasetLimit)
  const groupedCandidates = candidatesByLegalDistrict(complexes)
  const failures: string[] = []
  let processedDatasetCount = 0

  for (
    let offset = 0;
    offset < pending.length &&
    failures.length < MAXIMUM_DATASET_FAILURES_PER_RUN;
    offset += DATASET_FETCH_CONCURRENCY
  ) {
    const batch = pending.slice(offset, offset + DATASET_FETCH_CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map(async (dataset) => {
        const rawTrades = await readDataset(
          dataset,
          serviceKey,
        )
        return prepareTradeDataset(
          dataset,
          rawTrades,
          groupedCandidates.get(dataset.legalDistrictCode) ?? [],
          state.cutoffDate,
          state.windowEndDate,
        )
      }),
    )

    for (const [index, result] of results.entries()) {
      const dataset = batch[index]
      const key = tradeDatasetKey(dataset)
      if (result.status === 'rejected') {
        const reason =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason)
        failures.push(`${key}: ${reason}`)
        log(`Trade dataset failed: ${key}: ${reason}`)
        continue
      }
      try {
        await repository.saveDataset(
          state.refreshId,
          result.value,
          now.toISOString(),
        )
        completedKeys.add(key)
        processedDatasetCount += 1
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        failures.push(`${key}: ${reason}`)
        log(`Trade dataset checkpoint failed: ${key}: ${reason}`)
      }
    }
  }

  const validation = await repository.readValidation(state.refreshId)
  const remainingDatasetCount = state.datasetCount - validation.completedDatasetCount
  log(
    `Trade matching: matched=${validation.matchedCount}/${validation.activeCount} ` +
      `(${matchingRate(validation)}%), lot=${validation.lotCount}, ` +
      `candidate=${validation.candidateCount}, ambiguous=${validation.ambiguousCount}, ` +
      `unmatched=${validation.unmatchedCount}`,
  )

  let activated = false
  if (remainingDatasetCount === 0) {
    validateSnapshot(state, validation)
    await repository.activate(state.refreshId, now.toISOString())
    const activatedState = await repository.readRefreshState()
    if (
      activatedState?.refreshId !== state.refreshId ||
      activatedState.status !== 'completed'
    ) {
      throw new Error('Trade refresh lost ownership before activation')
    }
    activated = true
  }

  return {
    refreshId: state.refreshId,
    activated,
    processedDatasetCount,
    remainingDatasetCount,
    failures,
    validation,
  }
}
