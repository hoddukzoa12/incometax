import { describe, expect, it, vi } from 'vitest'

import {
  fetchJson,
  fetchParsedJson,
  type HttpAttemptMeasurement,
  HttpRequestError,
  type HttpRetryMeasurement,
  NonRetryableRequestError,
} from '../scripts/lib/http.ts'

const timeoutSignal = (): AbortSignal => new AbortController().signal

describe('fetchJson retries', () => {
  it('checks an asynchronous attempt gate before every transport attempt', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{}', { status: 200 }),
    )
    const beforeAttempt = vi.fn(async () => undefined)

    await fetchJson(new URL('https://example.test/data'), {}, {
      fetch: fetchMock,
      timeoutSignal,
      observer: {
        beforeAttempt,
        recordAttempt: () => undefined,
        recordRetry: () => undefined,
      },
    })

    expect(beforeAttempt).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('retries a transient timeout and returns the later successful response', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new DOMException('timed out', 'TimeoutError'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'recovered' }), { status: 200 }),
      )
    const delays: number[] = []

    await expect(
      fetchJson(new URL('https://example.test/data'), {}, {
        fetch: fetchMock,
        delay: async (milliseconds) => {
          delays.push(milliseconds)
        },
        random: () => 0.5,
        timeoutSignal,
      }),
    ).resolves.toEqual({ status: 'recovered' })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(delays).toEqual([1_000])
  })

  it('retries a transient malformed payload before returning parsed data', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ value: 'recovered' }), { status: 200 }),
      )

    await expect(
      fetchParsedJson(
        new URL('https://example.test/data'),
        (payload) => {
          if (
            typeof payload !== 'object' ||
            payload === null ||
            !('value' in payload) ||
            typeof payload.value !== 'string'
          ) {
            throw new TypeError('missing value')
          }
          return payload.value
        },
        {},
        {
          fetch: fetchMock,
          delay: async () => undefined,
          random: () => 0.5,
          timeoutSignal,
        },
      ),
    ).resolves.toBe('recovered')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not spend the transport retry budget on a terminal payload error', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))
    const terminalError = new NonRetryableRequestError('unusable payload')

    await expect(
      fetchParsedJson(
        new URL('https://example.test/data'),
        () => {
          throw terminalError
        },
        {},
        {
          fetch: fetchMock,
          delay: async () => undefined,
          random: () => 0.5,
          timeoutSignal,
        },
      ),
    ).rejects.toBe(terminalError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('wraps an exhausted timeout and uses capped exponential backoff', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new DOMException('timed out', 'TimeoutError'))
    const delays: number[] = []

    const request = fetchJson(new URL('https://example.test/data'), {}, {
      fetch: fetchMock,
      delay: async (milliseconds) => {
        delays.push(milliseconds)
      },
      random: () => 0.5,
      timeoutSignal,
    })

    await expect(request).rejects.toMatchObject({
      name: 'HttpRequestError',
      attempts: 11,
    } satisfies Partial<HttpRequestError>)
    expect(fetchMock).toHaveBeenCalledTimes(11)
    expect(delays).toEqual([
      1_000,
      2_000,
      4_000,
      8_000,
      16_000,
      30_000,
      30_000,
      30_000,
      30_000,
      30_000,
    ])
  })

  it('reports response latency, status, retry reason, and actual backoff time', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('busy', { status: 429 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'recovered' }), { status: 200 }),
      )
    const attempts: HttpAttemptMeasurement[] = []
    const retries: HttpRetryMeasurement[] = []
    const clock = [0, 75, 75, 1_075, 1_075, 1_155]

    await expect(
      fetchJson(new URL('https://example.test/data'), {}, {
        fetch: fetchMock,
        delay: async () => undefined,
        random: () => 0.5,
        timeoutSignal,
        now: () => clock.shift() ?? 1_155,
        wallClockNow: () => 0,
        observer: {
          recordAttempt: (measurement) => attempts.push(measurement),
          recordRetry: (measurement) => retries.push(measurement),
        },
      }),
    ).resolves.toEqual({ status: 'recovered' })

    expect(attempts).toEqual([
      {
        durationMs: 75,
        status: 429,
        outcome: 'response',
        retryAfter: null,
      },
      {
        durationMs: 80,
        status: 200,
        outcome: 'response',
        retryAfter: null,
      },
    ])
    expect(retries).toEqual([
      {
        reason: 'http:429',
        scheduledDelayMs: 1_000,
        actualDelayMs: 1_000,
        delaySource: 'policy',
      },
    ])
  })

  it('honors Retry-After for throttled responses', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response('busy', {
          status: 429,
          headers: { 'retry-after': '7' },
        }),
      )
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
    const delays: number[] = []
    const retries: HttpRetryMeasurement[] = []

    await fetchJson(new URL('https://example.test/data'), {}, {
      fetch: fetchMock,
      delay: async (milliseconds) => {
        delays.push(milliseconds)
      },
      random: () => 0.5,
      timeoutSignal,
      observer: {
        recordAttempt: () => undefined,
        recordRetry: (measurement) => retries.push(measurement),
      },
    })

    expect(delays).toEqual([7_000])
    expect(retries[0]).toMatchObject({
      reason: 'http:429',
      scheduledDelayMs: 7_000,
      delaySource: 'retryAfter',
    })
  })

  it('uses the short capped budget when throttling never clears', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response('busy', { status: 429 }))
    const delays: number[] = []

    const request = fetchJson(new URL('https://example.test/data'), {}, {
      fetch: fetchMock,
      delay: async (milliseconds) => {
        delays.push(milliseconds)
      },
      random: () => 0.5,
      timeoutSignal,
    })

    await expect(request).rejects.toMatchObject({
      name: 'HttpRequestError',
      attempts: 21,
    } satisfies Partial<HttpRequestError>)
    expect(fetchMock).toHaveBeenCalledTimes(21)
    expect(delays).toEqual([1_000, ...Array<number>(19).fill(2_000)])
  })
})
