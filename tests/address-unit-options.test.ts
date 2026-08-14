import { describe, expect, it, vi } from 'vitest'

import { handleAddressUnitOptions } from '../worker/address/unit-options'

const TEST_PNU = '1168010600103160000'

describe('address unit options handler', () => {
  it('normalizes and forwards a PNU, apartment code, and dong', async () => {
    const lookupAddressApartmentOptions = vi.fn(async () => ({
      key: `${TEST_PNU}|1381`,
      status: 'found' as const,
      value: {
        pnu: TEST_PNU,
        dongs: [{ code: '1', name: '1' }],
        rooms: [{ code: '10', name: '101' }],
        aptCode: '1381',
      },
    }))

    const response = await handleAddressUnitOptions(new Request(
      'https://example.com/api/address/unit-options',
      {
        method: 'POST',
        body: JSON.stringify({
          pnu: ` ${TEST_PNU} `,
          aptCode: ' 1381 ',
          dong: ' 1동 ',
        }),
      },
    ), { lookupAddressApartmentOptions })

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(lookupAddressApartmentOptions).toHaveBeenCalledWith({
      pnu: TEST_PNU,
      aptCode: '1381',
      dong: '1동',
    })
    await expect(response.json()).resolves.toMatchObject({ status: 'found' })
  })

  it('rejects an invalid request before calling the service', async () => {
    const lookupAddressApartmentOptions = vi.fn()
    const response = await handleAddressUnitOptions(new Request(
      'https://example.com/api/address/unit-options',
      {
        method: 'POST',
        body: JSON.stringify({ pnu: TEST_PNU }),
      },
    ), { lookupAddressApartmentOptions })

    expect(response.status).toBe(400)
    expect(lookupAddressApartmentOptions).not.toHaveBeenCalled()
  })
})
