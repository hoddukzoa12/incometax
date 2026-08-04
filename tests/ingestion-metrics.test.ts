import { describe, expect, it } from 'vitest'

import { IngestionMetrics } from '../scripts/lib/ingestion-metrics.ts'

describe('IngestionMetrics', () => {
  it('summarizes request percentiles, statuses, retries, sleeps, and D1 time', () => {
    let now = 100
    const metrics = new IngestionMetrics(() => now)

    for (let duration = 1; duration <= 20; duration += 1) {
      metrics.recordHttpAttempt({
        durationMs: duration,
        status: duration === 20 ? 503 : 200,
        outcome: 'response',
        retryAfter: null,
      })
    }
    metrics.recordHttpAttempt({
      durationMs: 25,
      status: null,
      outcome: 'timeout',
      retryAfter: null,
    })
    metrics.recordHttpRetry({
      reason: 'http:503',
      scheduledDelayMs: 1_000,
      actualDelayMs: 1_001,
      delaySource: 'policy',
    })
    metrics.recordD1Execution({ operation: 'read', durationMs: 900 })
    metrics.recordD1Execution({ operation: 'write', durationMs: 1_100 })
    metrics.recordSleep('requestPacing', 100)
    metrics.recordSleep('unusableDetailBackoff', 501)
    now = 5_100

    expect(metrics.summary()).toEqual({
      wallClockMs: 5_000,
      requestLatencyMs: { count: 21, p50: 11, p95: 20, max: 25 },
      httpStatusDistribution: { '200': 19, '503': 1 },
      transportFailureDistribution: { timeout: 1 },
      retries: {
        count: 1,
        reasonDistribution: { 'http:503': 1 },
        scheduledBackoffMs: 1_000,
        actualBackoffSleepMs: 1_001,
        retryAfterHonoredCount: 0,
      },
      throttleRetryAfterHeaders: {
        present: 0,
        absent: 0,
        valueDistribution: {},
      },
      timingMs: {
        apiAttempts: 235,
        d1Reads: 900,
        d1Writes: 1_100,
        requestPacingSleep: 100,
        httpBackoffSleep: 1_001,
        unusableDetailBackoffSleep: 501,
      },
      d1Invocations: { reads: 1, writes: 1 },
    })
  })
})
