import { describe, expect, it, vi } from 'vitest'

import type { ComplexOfficialPriceRequest } from '../shared/official-price'
import { SIDEBAR_MESSAGES } from '../src/messages/sidebar'
import {
  officialPriceFailureMessage,
  officialPriceNoDataMessage,
} from '../src/sidebar/official-price-feedback'
import { lookupOfficialPriceForComplex } from '../src/sidebar/official-price-lookup'

const TEST_PNU = '1168010600103160000'
const TEST_COMPLEX_ID = 'A13583507'
const TEST_REQUEST: ComplexOfficialPriceRequest = {
  key: 'A13583507:1:101',
  dong: '1',
  room: '101',
}

const signal = () => new AbortController().signal

describe('sidebar official-price lookup', () => {
  it('requests price history by complex id without sending its address', async () => {
    const requests: { readonly url: string; readonly body: unknown }[] = []
    const fetcher = vi.fn(async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) => {
      const url = String(input)
      requests.push({ url, body: JSON.parse(String(init?.body)) })
      return Response.json({
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
      })
    })

    const result = await lookupOfficialPriceForComplex(
      TEST_COMPLEX_ID,
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
    expect(requests).toHaveLength(1)
    expect(requests[0]).toEqual({
      url: `/api/complexes/${TEST_COMPLEX_ID}/official-price`,
      body: TEST_REQUEST,
    })
    expect(JSON.stringify(requests[0].body)).not.toContain('address')
    expect(JSON.stringify(requests[0].body)).not.toContain('pnu')
  })

  it('preserves an address-not-found result from the complex route', async () => {
    const fetcher = vi.fn(async () => Response.json({
      key: TEST_REQUEST.key,
      status: 'noData',
      reason: 'addressNotFound',
    }))

    const result = await lookupOfficialPriceForComplex(
      TEST_COMPLEX_ID,
      TEST_REQUEST,
      signal(),
      fetcher as typeof fetch,
    )

    expect(result).toEqual({
      key: TEST_REQUEST.key,
      status: 'noData',
      lookupStage: 'officialPrice',
      reason: 'addressNotFound',
    })
    expect(officialPriceNoDataMessage(result)).toBe(
      SIDEBAR_MESSAGES.addressNotFound,
    )
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('preserves an upstream source failure and identifies the failed lookup', async () => {
    const fetcher = vi.fn(async () => Response.json({
      key: TEST_REQUEST.key,
      status: 'failed',
      failure: {
        kind: 'sourceUnavailable',
        message: '원천 HTTP 503',
        retryable: true,
      },
    }))

    const result = await lookupOfficialPriceForComplex(
      TEST_COMPLEX_ID,
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
    const fetcher = vi.fn(async () => new Response(null, { status: 503 }))

    const result = await lookupOfficialPriceForComplex(
      TEST_COMPLEX_ID,
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
