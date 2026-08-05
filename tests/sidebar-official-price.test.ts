import { describe, expect, it, vi } from 'vitest'

import type { OfficialPriceRequest } from '../shared/official-price'
import { SIDEBAR_MESSAGES } from '../src/messages/sidebar'
import {
  officialPriceFailureMessage,
  officialPriceNoDataMessage,
} from '../src/sidebar/official-price-feedback'
import { lookupOfficialPriceByAddress } from '../src/sidebar/official-price-lookup'

const TEST_PNU = '1168010600103160000'
const TEST_REQUEST: OfficialPriceRequest = {
  key: 'A13583507:1:101',
  assetKind: 'apartment',
  address: '서울특별시 강남구 대치동 316',
  complexName: '은마아파트',
  dong: '1',
  room: '101',
}

const signal = () => new AbortController().signal

describe('sidebar official-price lookup', () => {
  it('resolves address to PNU before requesting the unit price history', async () => {
    const requests: { readonly url: string; readonly body: unknown }[] = []
    const fetcher = vi.fn(async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) => {
      const url = String(input)
      requests.push({ url, body: JSON.parse(String(init?.body)) })
      if (url === '/api/pnu') {
        return Response.json({
          results: [{ address: TEST_REQUEST.address, pnu: TEST_PNU }],
        })
      }
      return Response.json({
        results: [{
          key: TEST_REQUEST.key,
          status: 'found',
          value: {
            assetKind: 'apartment',
            pnu: TEST_PNU,
            detailAddress: '서울특별시 강남구 대치동 316 은마아파트 1동 101호',
            items: [
              { baseDate: '2026.1.1', price: 2_237_000_000, exclusiveArea: 76.79 },
              { baseDate: '2025.1.1', price: 1_708_000_000, exclusiveArea: 76.79 },
              { baseDate: '2006.1.1', price: 542_000_000, exclusiveArea: 76.79 },
            ],
          },
        }],
      })
    })

    const result = await lookupOfficialPriceByAddress(
      TEST_REQUEST,
      signal(),
      fetcher as typeof fetch,
    )

    expect(result).toMatchObject({
      status: 'found',
      lookupStage: 'officialPrice',
      value: {
        pnu: TEST_PNU,
        items: [
          { baseDate: '2026.1.1', price: 2_237_000_000 },
          { baseDate: '2025.1.1', price: 1_708_000_000 },
          { baseDate: '2006.1.1', price: 542_000_000 },
        ],
      },
    })
    expect(requests).toHaveLength(2)
    expect(requests[0]).toEqual({
      url: '/api/pnu',
      body: { addresses: [TEST_REQUEST.address] },
    })
    expect(requests[1]).toMatchObject({
      url: '/api/realty-prices',
      body: { items: [{ pnu: TEST_PNU }] },
    })
  })

  it('stops with an explicit address-not-found result when PNU is absent', async () => {
    const fetcher = vi.fn(async () => Response.json({
      results: [{ address: TEST_REQUEST.address, pnu: null }],
    }))

    const result = await lookupOfficialPriceByAddress(
      TEST_REQUEST,
      signal(),
      fetcher as typeof fetch,
    )

    expect(result).toEqual({
      key: TEST_REQUEST.key,
      status: 'noData',
      lookupStage: 'addressToPnu',
      reason: 'addressNotFound',
    })
    expect(officialPriceNoDataMessage(result)).toBe(
      SIDEBAR_MESSAGES.addressNotFound,
    )
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('preserves an upstream source failure and identifies the failed lookup', async () => {
    const responses = [
      Response.json({
        results: [{ address: TEST_REQUEST.address, pnu: TEST_PNU }],
      }),
      Response.json({
        results: [{
          key: TEST_REQUEST.key,
          status: 'failed',
          failure: {
            kind: 'sourceUnavailable',
            message: '원천 HTTP 503',
            retryable: true,
          },
        }],
      }),
    ]
    const fetcher = vi.fn(async () => responses.shift()!)

    const result = await lookupOfficialPriceByAddress(
      TEST_REQUEST,
      signal(),
      fetcher as typeof fetch,
    )

    expect(result).toEqual({
      key: TEST_REQUEST.key,
      status: 'failed',
      lookupStage: 'officialPrice',
      failure: {
        kind: 'sourceUnavailable',
        message: '원천 HTTP 503',
        retryable: true,
      },
    })
    expect(officialPriceFailureMessage(result)).toBe(
      SIDEBAR_MESSAGES.priceSourceUnavailable,
    )
  })

  it('returns a failure state without substituting zero after an HTTP error', async () => {
    const responses = [
      Response.json({
        results: [{ address: TEST_REQUEST.address, pnu: TEST_PNU }],
      }),
      new Response(null, { status: 503 }),
    ]
    const fetcher = vi.fn(async () => responses.shift()!)

    const result = await lookupOfficialPriceByAddress(
      TEST_REQUEST,
      signal(),
      fetcher as typeof fetch,
    )

    expect(result).toMatchObject({
      status: 'failed',
      lookupStage: 'officialPrice',
      failure: { kind: 'sourceUnavailable', retryable: true },
    })
    expect('value' in result).toBe(false)
    expect(JSON.stringify(result)).not.toContain('"price":0')
  })
})
