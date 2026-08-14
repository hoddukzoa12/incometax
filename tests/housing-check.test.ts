import { describe, expect, it, vi } from 'vitest'

import type { AddressSearchResult } from '../shared/search'
import { checkHousingStatus } from '../src/search/housing-check'

const TEST_PNU = '1168010100107950010'
const TEST_ADDRESS = '서울 강남구 역삼동 795-10'

const addressResult = (structured = true): AddressSearchResult => ({
  address: TEST_ADDRESS,
  lat: 37.499,
  lng: 127.035,
  ...(structured
    ? {
        bCode: '1168010100',
        isMountain: false,
        mainNumber: '795',
        subNumber: '10',
      }
    : {}),
})

const signal = (): AbortSignal => new AbortController().signal

describe('search result housing check', () => {
  it('recognizes an apartment without calling the detached-house lookup', async () => {
    const fetchComplexes = vi.fn(async () => ({
      status: 'found' as const,
      pnu: TEST_PNU,
      complexes: [{ code: '12345', name: '현대빌라' }],
    }))
    const fetchDetachedHousePrice = vi.fn()

    await expect(checkHousingStatus(addressResult(), signal(), {
      fetchComplexes,
      fetchDetachedHousePrice,
    })).resolves.toBe('housing')
    expect(fetchDetachedHousePrice).not.toHaveBeenCalled()
  })

  it('builds the PNU from a structured Kakao address result', async () => {
    const fetchComplexes = vi.fn(async () => ({ status: 'noData' as const }))
    const fetchDetachedHousePrice = vi.fn(async () => ({
      key: TEST_PNU,
      status: 'noData' as const,
      reason: 'priceNotFound' as const,
    }))
    const requestSignal = signal()

    await expect(checkHousingStatus(addressResult(), requestSignal, {
      fetchComplexes,
      fetchDetachedHousePrice,
    })).resolves.toBe('notHousing')
    expect(fetchComplexes).toHaveBeenCalledWith({
      address: TEST_ADDRESS,
      pnu: TEST_PNU,
    }, requestSignal)
    expect(fetchDetachedHousePrice).toHaveBeenCalledWith({
      assetKind: 'detachedHouse',
      key: TEST_PNU,
      address: TEST_ADDRESS,
      pnu: TEST_PNU,
    }, requestSignal)
  })

  it('recognizes a detached house after apartment data is absent', async () => {
    const fetchComplexes = vi.fn(async () => ({ status: 'noData' as const }))
    const fetchDetachedHousePrice = vi.fn(async () => ({
      key: TEST_ADDRESS,
      status: 'found' as const,
      value: {
        assetKind: 'detachedHouse' as const,
        pnu: TEST_PNU,
        detailAddress: TEST_ADDRESS,
        items: [],
      },
    }))

    await expect(checkHousingStatus(addressResult(false), signal(), {
      fetchComplexes,
      fetchDetachedHousePrice,
    })).resolves.toBe('housing')
    expect(fetchComplexes).toHaveBeenCalledWith({ address: TEST_ADDRESS },
      expect.any(AbortSignal))
  })

  it('keeps results selectable when either source lookup fails', async () => {
    const fetchDetachedHousePrice = vi.fn(async () => ({
      key: TEST_PNU,
      status: 'failed' as const,
      failure: {
        kind: 'captchaRequired' as const,
        message: 'captcha',
        retryable: true,
      },
    }))

    await expect(checkHousingStatus(addressResult(), signal(), {
      fetchComplexes: vi.fn(async () => ({ status: 'failed' as const,
        failure: { kind: 'captcha', message: 'captcha', retryable: true },
      })),
      fetchDetachedHousePrice,
    })).resolves.toBe('error')
    expect(fetchDetachedHousePrice).not.toHaveBeenCalled()

    await expect(checkHousingStatus(addressResult(), signal(), {
      fetchComplexes: vi.fn(async () => ({ status: 'noData' as const })),
      fetchDetachedHousePrice,
    })).resolves.toBe('error')
  })

  it('does not turn an aborted lookup into a completed error status', async () => {
    const controller = new AbortController()
    const abortError = new DOMException('aborted', 'AbortError')

    await expect(checkHousingStatus(addressResult(), controller.signal, {
      fetchComplexes: vi.fn(async () => {
        controller.abort()
        throw abortError
      }),
      fetchDetachedHousePrice: vi.fn(),
    })).rejects.toBe(abortError)
  })
})
