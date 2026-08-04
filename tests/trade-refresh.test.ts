import { describe, expect, it, vi } from 'vitest'

import type {
  ComplexMatchCandidate,
  RawTrade,
  TradeDataset,
  TradeDatasetResult,
  TradeRefreshPlan,
  TradeRefreshRepository,
  TradeRefreshState,
  TradeRefreshValidation,
} from '../shared/trade'
import { runTradeRefresh } from '../worker/trade/ingest'
import { tradeDatasetKey } from '../worker/trade/window'

const complex: ComplexMatchCandidate = {
  complexId: 'A10000001',
  name: '은마아파트',
  legalAddress: '서울특별시 강남구 대치동 316',
  legalDongCode: '1168010600',
}

const trade = (source: RawTrade['source']): RawTrade => ({
  source,
  legalDongName: '대치동',
  jibun: '316',
  buildingName: '은마',
  houseType: '',
  floor: 10,
  exclusiveArea: 84.43,
  landArea: '',
  totalFloorArea: '',
  dealDate: '2026-08-01',
  dealAmount: 2_700_000_000,
  cancellationType: '',
  cancellationDate: '',
})

const emptyValidation = (): TradeRefreshValidation => ({
  completedDatasetCount: 0,
  rawCount: 0,
  canceledCount: 0,
  duplicateCount: 0,
  outsideWindowCount: 0,
  activeCount: 0,
  matchedCount: 0,
  lotCount: 0,
  candidateCount: 0,
  ambiguousCount: 0,
  unmatchedCount: 0,
  stagedTradeCount: 0,
  orphanTradeCount: 0,
})

const fakeRepository = () => {
  let state: TradeRefreshState | null = null
  const datasets = new Map<string, TradeDatasetResult>()
  let activeSnapshot = 'existing'

  const repository: TradeRefreshRepository = {
    loadComplexes: async () => [complex],
    readRefreshState: async () => state,
    startRefresh: async (plan: TradeRefreshPlan) => {
      state = { ...plan, status: 'inProgress' }
      datasets.clear()
    },
    readCompletedDatasetKeys: async () => new Set(datasets.keys()),
    saveDataset: async (_refreshId, result) => {
      datasets.set(tradeDatasetKey(result.dataset), result)
    },
    readValidation: async () => {
      const validation = { ...emptyValidation() }
      const tradeIds = new Set<string>()
      for (const result of datasets.values()) {
        validation.completedDatasetCount += 1
        validation.rawCount += result.stats.rawCount
        validation.canceledCount += result.stats.canceledCount
        validation.duplicateCount += result.stats.duplicateCount
        validation.outsideWindowCount += result.stats.outsideWindowCount
        validation.activeCount += result.stats.activeCount
        validation.matchedCount += result.stats.matchedCount
        validation.lotCount += result.stats.lotCount
        validation.candidateCount += result.stats.candidateCount
        validation.ambiguousCount += result.stats.ambiguousCount
        validation.unmatchedCount += result.stats.unmatchedCount
        result.trades.forEach((item) => tradeIds.add(item.tradeId))
      }
      validation.stagedTradeCount = tradeIds.size
      return validation
    },
    activate: async () => {
      activeSnapshot = 'new'
      if (state) state = { ...state, status: 'completed' }
    },
  }

  return {
    repository,
    activeSnapshot: () => activeSnapshot,
    completedCount: () => datasets.size,
  }
}

describe('resumable atomic trade refresh', () => {
  it('activates only after every dataset passes validation', async () => {
    const fake = fakeRepository()
    const result = await runTradeRefresh(
      fake.repository,
      'test-key',
      new Date('2026-08-04T03:00:00.000Z'),
      100,
      () => undefined,
      async (dataset) =>
        dataset.source === 'apt' && dataset.dealYearMonth === '202608'
          ? [trade('apt')]
          : [],
    )

    expect(result.activated).toBe(true)
    expect(result.validation).toMatchObject({
      completedDatasetCount: 39,
      activeCount: 1,
      matchedCount: 1,
      stagedTradeCount: 1,
    })
    expect(fake.activeSnapshot()).toBe('new')
  })

  it('keeps the active snapshot when source datasets fail', async () => {
    const fake = fakeRepository()
    const result = await runTradeRefresh(
      fake.repository,
      'test-key',
      new Date('2026-08-04T03:00:00.000Z'),
      100,
      () => undefined,
      async (dataset) => {
        if (dataset.source === 'apt') throw new Error('source unavailable')
        return []
      },
    )

    expect(result.activated).toBe(false)
    expect(result.failures).toHaveLength(3)
    expect(result.remainingDatasetCount).toBeGreaterThan(0)
    expect(fake.activeSnapshot()).toBe('existing')
  })

  it('resumes from dataset checkpoints instead of refetching them', async () => {
    const fake = fakeRepository()
    const loader = vi.fn(async () => [] as readonly RawTrade[])
    await runTradeRefresh(
      fake.repository,
      'test-key',
      new Date('2026-08-04T03:00:00.000Z'),
      1,
      () => undefined,
      loader,
    )
    expect(fake.completedCount()).toBe(1)

    const secondLoader = vi.fn(async (dataset: TradeDataset) =>
      dataset.source === 'apt' && dataset.dealYearMonth === '202607'
        ? [trade('apt')]
        : [],
    )
    const result = await runTradeRefresh(
      fake.repository,
      'test-key',
      new Date('2026-08-04T03:00:00.000Z'),
      100,
      () => undefined,
      secondLoader,
    )

    expect(secondLoader).toHaveBeenCalledTimes(38)
    expect(result.activated).toBe(true)
  })
})
