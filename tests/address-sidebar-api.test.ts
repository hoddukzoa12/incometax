import { describe, expect, it, vi } from 'vitest'

import { addressApartmentIdentity } from '../shared/official-price'
import {
  fetchAddressComplexes,
  fetchAddressOfficialPrice,
  fetchAddressTrades,
  fetchAddressUnitOptions,
  fetchDetachedHouseOfficialPrice,
} from '../src/sidebar/address-api'
import { InvalidSidebarApiResponseError } from '../src/sidebar/api'

const TEST_PNU = '1168010100107950010'
const TEST_APT_CODE = '12345'
const TEST_ADDRESS = '서울 강남구 역삼동 795-10'
const TEST_KEY = `${addressApartmentIdentity(
  TEST_PNU,
  TEST_APT_CODE,
)}:동명없음:201호`

const signal = (): AbortSignal => new AbortController().signal
const jsonFetcher = (body: unknown) => vi.fn(
  async (...args: Parameters<typeof fetch>) => {
    void args
    return Response.json(body)
  },
)

describe('address sidebar api', () => {
  it('loads address complexes and keeps the source PNU', async () => {
    const fetcher = jsonFetcher({
      status: 'found',
      pnu: TEST_PNU,
      complexes: [{ code: TEST_APT_CODE, name: '현대빌라' }],
    })

    const result = await fetchAddressComplexes(
      { address: TEST_ADDRESS },
      signal(),
      fetcher as typeof fetch,
    )

    expect(result).toEqual({
      status: 'found',
      pnu: TEST_PNU,
      complexes: [{ code: TEST_APT_CODE, name: '현대빌라' }],
    })
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      address: TEST_ADDRESS,
    })
  })

  it('posts the PNU and apt code to the address unit-options route', async () => {
    const key = addressApartmentIdentity(TEST_PNU, TEST_APT_CODE)
    const fetcher = jsonFetcher({
      key,
      status: 'found',
      value: {
        pnu: TEST_PNU,
        aptCode: TEST_APT_CODE,
        dongs: [{ code: '1', name: '동명없음' }],
        rooms: [],
      },
    })

    const result = await fetchAddressUnitOptions({
      pnu: TEST_PNU,
      aptCode: TEST_APT_CODE,
    }, signal(), fetcher as typeof fetch)

    expect(result.status).toBe('found')
    expect(fetcher).toHaveBeenCalledWith('/api/address/unit-options',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ pnu: TEST_PNU, aptCode: TEST_APT_CODE }),
      }))
  })

  it('accepts rowhouse trades from the address trade route', async () => {
    const fetcher = jsonFetcher({
      items: [{
        tradeId: 'rowhouse-trade-1',
        source: 'rowhouse',
        matchLevel: 'lot',
        dealDate: '2026-07-14',
        dealAmount: 720_000_000,
        exclusiveArea: 53.21,
        floor: 3,
      }],
    })
    const request = {
      legalDongCode: '1168010100',
      jibunAddress: TEST_ADDRESS,
      complexName: '현대빌라',
    }

    const result = await fetchAddressTrades(
      request,
      signal(),
      fetcher as typeof fetch,
    )

    expect(result.items[0]).toMatchObject({
      source: 'rowhouse',
      dealAmount: 720_000_000,
    })
    expect(fetcher).toHaveBeenCalledWith('/api/address/trades',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(request),
      }))
  })

  it('rejects an unknown trade source', async () => {
    const fetcher = jsonFetcher({
      items: [{
        tradeId: 'unknown-trade-1',
        source: 'unknown',
        matchLevel: 'lot',
        dealDate: '2026-07-14',
        dealAmount: 720_000_000,
        exclusiveArea: 53.21,
        floor: 3,
      }],
    })

    await expect(fetchAddressTrades({
      legalDongCode: '1168010100',
      jibunAddress: TEST_ADDRESS,
      complexName: '현대빌라',
    }, signal(), fetcher as typeof fetch)).rejects.toBeInstanceOf(
      InvalidSidebarApiResponseError,
    )
  })

  it('loads one address official-price result through the batch route', async () => {
    const fetcher = jsonFetcher({
      results: [{
        key: TEST_KEY,
        status: 'found',
        value: {
          assetKind: 'apartment',
          pnu: TEST_PNU,
          detailAddress: `${TEST_ADDRESS} 현대빌라 동명없음 201호`,
          items: [{
            baseDate: '2026.1.1',
            price: 420_000_000,
            exclusiveArea: 53.21,
          }],
        },
      }],
    })
    const request = {
      assetKind: 'apartment' as const,
      key: TEST_KEY,
      address: TEST_ADDRESS,
      complexName: '현대빌라',
      dong: '동명없음',
      room: '201호',
      pnu: TEST_PNU,
      aptCode: TEST_APT_CODE,
    }

    const result = await fetchAddressOfficialPrice(
      request,
      signal(),
      fetcher as typeof fetch,
    )

    expect(result).toMatchObject({
      key: TEST_KEY,
      status: 'found',
      value: { items: [{ price: 420_000_000 }] },
    })
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      items: [request],
    })
  })

  it('rejects a batch response that does not match the requested key', async () => {
    const fetcher = jsonFetcher({
      results: [{ key: 'different', status: 'noData', reason: 'priceNotFound' }],
    })

    await expect(fetchAddressOfficialPrice({
      assetKind: 'apartment',
      key: TEST_KEY,
      address: TEST_ADDRESS,
      complexName: '현대빌라',
      dong: '동명없음',
      room: '201호',
      pnu: TEST_PNU,
      aptCode: TEST_APT_CODE,
    }, signal(), fetcher as typeof fetch)).rejects.toBeInstanceOf(
      InvalidSidebarApiResponseError,
    )
  })

  it('accepts a detached-house result from the shared batch route', async () => {
    const fetcher = jsonFetcher({
      results: [{
        key: TEST_PNU,
        status: 'found',
        value: {
          assetKind: 'detachedHouse',
          pnu: TEST_PNU,
          detailAddress: TEST_ADDRESS,
          items: [{
            baseDate: '2026.1.1',
            price: 830_000_000,
            exclusiveArea: null,
          }],
        },
      }],
    })
    const request = {
      assetKind: 'detachedHouse' as const,
      key: TEST_PNU,
      address: TEST_ADDRESS,
      pnu: TEST_PNU,
    }

    await expect(fetchDetachedHouseOfficialPrice(
      request,
      signal(),
      fetcher as typeof fetch,
    )).resolves.toMatchObject({
      status: 'found',
      value: { assetKind: 'detachedHouse' },
    })
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      items: [request],
    })
  })
})
