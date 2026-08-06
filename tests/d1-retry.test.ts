import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  runD1,
  type D1CommandResult,
  type D1CommandRunner,
} from '../scripts/lib/d1.ts'

const SUCCESS_RESULT: D1CommandResult = {
  code: 0,
  stdout: JSON.stringify([{ results: [{ value: 1 }], success: true }]),
  stderr: '',
}

const failedResult = (stderr: string): D1CommandResult => ({
  code: 1,
  stdout: '',
  stderr,
})

describe('remote D1 retries', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it.each([
    'File could not be uploaded. Please retry.',
    '<Error><Code>InternalError</Code></Error>',
    'Cloudflare API response status 503',
    'read ECONNRESET',
    'request timed out',
  ])('retries a transient failure and returns the successful result: %s', async (message) => {
    const runner: D1CommandRunner = vi
      .fn()
      .mockResolvedValueOnce(failedResult(message))
      .mockResolvedValueOnce(SUCCESS_RESULT)
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const execution = runD1('SELECT 1', 'remote', { runner })
    const assertion = expect(execution).resolves.toEqual([
      { results: [{ value: 1 }], success: true },
    ])
    await vi.runAllTimersAsync()
    await assertion

    expect(runner).toHaveBeenCalledTimes(2)
    expect(warning).toHaveBeenCalledOnce()
    expect(warning).toHaveBeenCalledWith(
      expect.stringContaining('retrying in 1000ms'),
    )
  })

  it.each([
    'near "SELEC": syntax error',
    'UNIQUE constraint failed: complex.complex_id',
    'SQLITE_TOOBIG: string or blob too big',
    'Unknown binding COMPLEX_DB',
    'HTTP status 401 Unauthorized',
  ])('does not retry a deterministic failure: %s', async (message) => {
    const originalError = new Error(message)
    const runner: D1CommandRunner = vi.fn().mockRejectedValue(originalError)
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await expect(runD1('SELECT 1', 'remote', { runner })).rejects.toBe(
      originalError,
    )

    expect(runner).toHaveBeenCalledOnce()
    expect(warning).not.toHaveBeenCalled()
  })

  it('throws the final upstream failure unchanged after exhausting attempts', async () => {
    const upstreamMessage =
      'Cloudflare API response status 503: upstream temporarily unavailable'
    const runner: D1CommandRunner = vi
      .fn()
      .mockResolvedValue(failedResult(upstreamMessage))
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const execution = runD1('SELECT 1', 'remote', { runner })
    const assertion = expect(execution).rejects.toThrow(upstreamMessage)
    await vi.runAllTimersAsync()
    await assertion

    expect(runner).toHaveBeenCalledTimes(3)
    expect(warning).toHaveBeenCalledTimes(2)
    expect(warning.mock.calls[1]?.[0]).toContain('retrying in 2000ms')
  })

  it('keeps the happy path to a single runner invocation', async () => {
    const runner: D1CommandRunner = vi.fn().mockResolvedValue(SUCCESS_RESULT)
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await expect(runD1('SELECT 1', 'remote', { runner })).resolves.toEqual([
      { results: [{ value: 1 }], success: true },
    ])

    expect(runner).toHaveBeenCalledOnce()
    expect(warning).not.toHaveBeenCalled()
  })
})
