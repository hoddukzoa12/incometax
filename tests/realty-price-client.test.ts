import { describe, expect, it, vi } from 'vitest'

import {
  RealtyPriceClient,
  RealtySourceError,
  responseList,
} from '../worker/realty-price/client'

function jsonResponse(payload: unknown, status = 200): Response {
  return Response.json(payload, { status })
}

describe('RealtyPriceClient', () => {
  it('accepts model and modelMap response shapes', async () => {
    const responses = [
      jsonResponse({ model: { list: [{ code: 'model' }] } }),
      jsonResponse({ modelMap: { list: [{ code: 'modelMap' }] } }),
    ]
    let now = 0
    const client = new RealtyPriceClient({
      fetcher: vi.fn(async () => responses.shift()!),
      now: () => now,
      sleep: async (milliseconds) => { now += milliseconds },
    })

    expect(responseList(await client.request('/one', {}))).toEqual([{ code: 'model' }])
    expect(responseList(await client.request('/two', {}))).toEqual([{ code: 'modelMap' }])
  })

  it.each([
    ['null', { model: { list: null } }],
    ['a missing key', { model: {} }],
  ])('treats %s list as zero rows', async (_description, payload) => {
    const client = new RealtyPriceClient({
      fetcher: vi.fn(async () => jsonResponse(payload)),
    })

    await expect(client.request('/no-data', {}).then(responseList))
      .resolves.toEqual([])
  })

  it('rejects a non-array list as a schema failure', async () => {
    const client = new RealtyPriceClient({
      fetcher: vi.fn(async () => jsonResponse({ model: { list: 'invalid' } })),
    })
    const response = await client.request('/invalid-list', {})

    expect(() => responseList(response))
      .toThrow(expect.objectContaining({ kind: 'invalidResponse' }))
  })

  it('serializes calls, keeps 260ms spacing, and retries 400/429/5xx', async () => {
    const statuses = [400, 429, 503, 200, 200, 200]
    const starts: number[] = []
    const sleeps: number[] = []
    let now = 0
    const client = new RealtyPriceClient({
      fetcher: vi.fn(async () => {
        starts.push(now)
        const status = statuses.shift()!
        return status === 200
          ? jsonResponse({ model: { list: [] } })
          : new Response('busy', { status })
      }),
      now: () => now,
      sleep: async (milliseconds) => {
        sleeps.push(milliseconds)
        now += milliseconds
      },
    })

    await client.request('/retry', {})
    await Promise.all([
      client.request('/serial-a', {}),
      client.request('/serial-b', {}),
    ])

    expect(starts.slice(0, 4)).toEqual([0, 450, 1_450, 3_250])
    expect(starts[4] - starts[3]).toBeGreaterThanOrEqual(260)
    expect(starts[5] - starts[4]).toBeGreaterThanOrEqual(260)
    expect(sleeps).toEqual(expect.arrayContaining([450, 1_000, 1_800, 260]))
  })

  it('surfaces CAPTCHA as a source-side failure without retrying', async () => {
    const fetcher = vi.fn(async () => new Response(
      '<html><div class="g-recaptcha">verify</div></html>',
      { headers: { 'content-type': 'text/html' } },
    ))
    const client = new RealtyPriceClient({ fetcher: fetcher as typeof fetch })

    await expect(client.request('/captcha', {})).rejects.toMatchObject({
      kind: 'captcha',
      retryable: false,
    } satisfies Partial<RealtySourceError>)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
