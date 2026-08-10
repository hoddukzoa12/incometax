import { afterEach, describe, expect, it, vi } from 'vitest'

import { readComplexBasisDetail } from '../scripts/lib/complex-basis.ts'
import {
  KaptBasisNotFoundError,
  UnusableKaptBasisError,
} from '../scripts/lib/complex-normalizer.ts'

const response = (item: unknown): Response =>
  new Response(JSON.stringify({
    response: {
      header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
      body: { item },
    },
  }), { status: 200 })

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('readComplexBasisDetail', () => {
  it('uses the bounded unusable-detail retry policy', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () =>
      response({
        kaptCode: 'A13583507',
        kaptName: '은마',
        kaptAddr: '주소',
        bjdCode: '1168010600',
        kaptDongCnt: null,
        kaptdaCnt: null,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const request = readComplexBasisDetail('service-key', 'A13583507')
    const rejection = expect(request).rejects.toBeInstanceOf(
      UnusableKaptBasisError,
    )
    await vi.runAllTimersAsync()
    await rejection
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('does not retry an explicit no-detail response', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({
        response: {
          header: { resultCode: '03', resultMsg: 'NO_DATA' },
        },
      }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      readComplexBasisDetail('service-key', 'A13583507'),
    ).rejects.toBeInstanceOf(KaptBasisNotFoundError)
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
