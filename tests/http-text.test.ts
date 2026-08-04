import { describe, expect, it, vi } from 'vitest'

import { fetchParsedText, fetchText } from '../scripts/lib/http.ts'

const timeoutSignal = (): AbortSignal => new AbortController().signal

describe('fetchText shared retry policy', () => {
  it('retries a transient XML response failure through the shared core', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response('<response />', { status: 200 }))

    await expect(
      fetchText(
        new URL('https://example.test/data.xml'),
        {},
        {
          fetch: fetchMock,
          delay: async () => undefined,
          random: () => 0.5,
          timeoutSignal,
        },
      ),
    ).resolves.toBe('<response />')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retries transient XML parser failures through the same policy', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('<broken />', { status: 200 }))
      .mockResolvedValueOnce(new Response('<response />', { status: 200 }))

    await expect(
      fetchParsedText(
        new URL('https://example.test/data.xml'),
        (xml) => {
          if (!xml.includes('response')) throw new TypeError('invalid XML')
          return xml
        },
        {},
        {
          fetch: fetchMock,
          delay: async () => undefined,
          random: () => 0.5,
          timeoutSignal,
        },
      ),
    ).resolves.toBe('<response />')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
