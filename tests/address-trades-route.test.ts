import { describe, expect, it, vi } from 'vitest'

import type { RecentTrade } from '../shared/trade'
import { handleAddressTrades } from '../worker/address/trades'

const context = {} as ExecutionContext
const target = {
  legalDongCode: '1168010100',
  jibunAddress: '서울 강남구 역삼동 795-10',
  complexName: '현대빌라',
}
const rowhouseTrade: RecentTrade = {
  tradeId: 'rowhouse-trade-1',
  source: 'rowhouse',
  matchLevel: 'lot',
  dealDate: '2026-07-14',
  dealAmount: 720_000_000,
  exclusiveArea: 53.21,
  floor: 3,
}

const request = (body: unknown): Request => new Request(
  'https://example.com/api/address/trades',
  {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  },
)

describe('address trade HTTP API', () => {
  it('passes the normalized address target to the address trade lookup', async () => {
    const lookup = vi.fn(async () => [rowhouseTrade])

    const response = await handleAddressTrades(
      request({
        legalDongCode: ` ${target.legalDongCode} `,
        jibunAddress: ` ${target.jibunAddress} `,
        complexName: ` ${target.complexName} `,
      }),
      'service-key',
      context,
      lookup,
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({ items: [rowhouseTrade] })
    expect(lookup).toHaveBeenCalledWith(target, 'service-key', context)
  })

  it.each([
    null,
    { ...target, legalDongCode: '11680' },
    { ...target, jibunAddress: ' ' },
    { ...target, complexName: 123 },
  ])('rejects an invalid request body', async (body) => {
    const lookup = vi.fn(async () => [] as readonly RecentTrade[])

    const response = await handleAddressTrades(
      request(body),
      'service-key',
      context,
      lookup,
    )

    expect(response.status).toBe(400)
    expect(lookup).not.toHaveBeenCalled()
  })

  it('distinguishes source failures from an empty successful result', async () => {
    const empty = await handleAddressTrades(
      request(target),
      'service-key',
      context,
      vi.fn(async () => []),
    )
    expect(empty.status).toBe(200)
    await expect(empty.json()).resolves.toEqual({ items: [] })

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const failed = await handleAddressTrades(
      request(target),
      'service-key',
      context,
      vi.fn(async () => {
        throw new Error('source unavailable')
      }),
    )
    consoleError.mockRestore()
    expect(failed.status).toBe(502)
    await expect(failed.json()).resolves.toMatchObject({ retryable: true })
  })
})
