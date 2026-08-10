import { describe, expect, it, vi } from 'vitest'

import {
  DetailApiAttemptLimitError,
  DetailRequestController,
  lookupComplexDetail,
} from '../scripts/lib/complex-detail-backfill.ts'
import {
  KaptBasisNotFoundError,
  UnusableKaptBasisError,
} from '../scripts/lib/complex-normalizer.ts'
import type { HttpMetricsObserver } from '../scripts/lib/http.ts'

const target = {
  complexId: 'A13583507',
  legalDongCode: '1168010600',
} as const

const noOp = () => undefined

const controller = (maxAttempts = 10): DetailRequestController =>
  new DetailRequestController({ maxAttempts, minimumIntervalMs: 0 })

const readerThatThrows = (
  error: Error,
): (
  serviceKey: string,
  complexId: string,
  observer?: HttpMetricsObserver,
) => Promise<never> =>
  async (_serviceKey, _complexId, observer) => {
    await observer?.beforeAttempt?.()
    observer?.recordAttempt({
      durationMs: 1,
      status: 200,
      outcome: 'response',
      retryAfter: null,
    })
    throw error
  }

describe('DetailRequestController', () => {
  it('paces concurrent callers and refuses attempts beyond the hard cap', async () => {
    let now = 0
    const delays: number[] = []
    const requestController = new DetailRequestController({
      maxAttempts: 3,
      minimumIntervalMs: 100,
      now: () => now,
      delay: async (milliseconds) => {
        delays.push(milliseconds)
        now += milliseconds
      },
    })

    await Promise.all([
      requestController.beforeAttempt(),
      requestController.beforeAttempt(),
      requestController.beforeAttempt(),
    ])

    expect(requestController.attempts).toBe(3)
    expect(delays).toEqual([100, 100])
    await expect(requestController.beforeAttempt()).rejects.toBeInstanceOf(
      DetailApiAttemptLimitError,
    )
    expect(requestController.attempts).toBe(3)
  })
})

describe('lookupComplexDetail', () => {
  const baseOptions = {
    serviceKey: 'service-key',
    target,
    recordHttpAttempt: noOp,
    recordHttpRetry: noOp,
    recordUnusableBackoff: noOp,
  } as const

  it('returns all three detail facts after validating source identifiers', async () => {
    const readDetail = vi.fn(async (
      _serviceKey: string,
      _complexId: string,
      observer?: HttpMetricsObserver,
    ) => {
      await observer?.beforeAttempt?.()
      observer?.recordAttempt({
        durationMs: 1,
        status: 200,
        outcome: 'response',
        retryAfter: null,
      })
      return {
        complexId: target.complexId,
        name: '은마',
        legalAddress: '서울특별시 강남구 대치동 316',
        roadAddress: null,
        legalDongCode: target.legalDongCode,
        approvalDate: '1979-08-29',
        buildingCount: 28,
        householdCount: 4_424,
      }
    })

    await expect(
      lookupComplexDetail({
        ...baseOptions,
        requestController: controller(),
        readDetail,
      }),
    ).resolves.toEqual({
      kind: 'outcome',
      outcome: {
        complexId: target.complexId,
        status: 'filled',
        approvalDate: '1979-08-29',
        buildingCount: 28,
        householdCount: 4_424,
        apiAttempts: 1,
        reason: null,
      },
    })
  })

  it.each([
    [new KaptBasisNotFoundError('no item'), 'noDetail'],
    [new UnusableKaptBasisError(['kaptdaCnt']), 'missingFields'],
    [new Error('invalid response'), 'responseError'],
  ] as const)('classifies %s as %s and keeps facts unknown', async (error, status) => {
    const result = await lookupComplexDetail({
      ...baseOptions,
      requestController: controller(),
      readDetail: readerThatThrows(error),
    })

    expect(result).toMatchObject({
      kind: 'outcome',
      outcome: {
        status,
        approvalDate: null,
        buildingCount: null,
        householdCount: null,
        apiAttempts: 1,
      },
    })
  })

  it('leaves a target uncheckpointed when the request budget is already exhausted', async () => {
    const requestController = controller(1)
    await requestController.beforeAttempt()

    await expect(
      lookupComplexDetail({
        ...baseOptions,
        requestController,
        readDetail: readerThatThrows(new Error('not reached')),
      }),
    ).resolves.toEqual({
      kind: 'budgetExhausted',
      complexId: target.complexId,
      apiAttempts: 0,
    })
  })
})
