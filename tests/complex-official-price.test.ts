import { describe, expect, it, vi } from 'vitest'

import type { ComplexStagingRecord } from '../shared/complex'
import { handleComplexOfficialPrice } from '../worker/complex/official-price'
import { resolveStoredComplexPnu } from '../worker/complex/pnu'
import type { OfficialPriceService } from '../worker/realty-price'

const ABBREVIATED_COMPLEX: ComplexStagingRecord = {
  complexId: 'A13583507',
  name: '은마아파트',
  legalAddress: '서울 강남구 대치동 316',
  roadAddress: '서울 강남구 삼성로 212',
  legalDongCode: '1168010600',
  approvalDate: '1979-08-30',
  buildingCount: 28,
  householdCount: 4_424,
  lat: 37.4974,
  lng: 127.0653,
  lookupStatus: 'matched',
  backfillReason: null,
}

const fakeDatabase = (complex: ComplexStagingRecord): D1Database => ({
  prepare: () => ({
    bind: () => ({
      first: async () => ({
        complex_id: complex.complexId,
        name: complex.name,
        legal_address: complex.legalAddress,
        road_address: complex.roadAddress,
        legal_dong_code: complex.legalDongCode,
        approval_date: complex.approvalDate,
        building_count: complex.buildingCount,
        household_count: complex.householdCount,
        lat: complex.lat,
        lng: complex.lng,
        lookup_status: complex.lookupStatus,
        backfill_reason: complex.backfillReason,
      }),
    }),
  }),
}) as unknown as D1Database

const request = (complexId = ABBREVIATED_COMPLEX.complexId): Request =>
  new Request(`https://example.test/api/complexes/${complexId}/official-price`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      key: `${complexId}:1:101`,
      dong: '1',
      room: '101',
    }),
  })

describe('stored complex PNU resolution', () => {
  it('uses the stored legal-dong code with a real abbreviated address', () => {
    expect(resolveStoredComplexPnu(ABBREVIATED_COMPLEX))
      .toBe('1168010600103160000')
  })

  it('does not depend on the stored province label', () => {
    expect(resolveStoredComplexPnu({
      legalAddress: '전남광주통합특별시 목포시 용당동 1214',
      legalDongCode: '1211010100',
    })).toBe('1211010100112140000')
  })

  it('passes the stored-code PNU to the complex price service', async () => {
    const lookup = vi.fn(async () => ({
      key: 'A13583507:1:101',
      status: 'noData' as const,
      reason: 'priceNotFound' as const,
    }))
    const service = { lookup } as unknown as OfficialPriceService

    const response = await handleComplexOfficialPrice(
      request(),
      fakeDatabase(ABBREVIATED_COMPLEX),
      ABBREVIATED_COMPLEX.complexId,
      service,
      {} as never,
      {} as ExecutionContext,
    )

    expect(response.status).toBe(200)
    expect(lookup).toHaveBeenCalledWith(
      expect.objectContaining({
        address: '서울 강남구 대치동 316',
        pnu: '1168010600103160000',
      }),
      expect.anything(),
      expect.anything(),
    )
    await expect(response.json()).resolves.toEqual({
      key: 'A13583507:1:101',
      status: 'noData',
      reason: 'priceNotFound',
    })
  })

  it('does not fall back to address matching when a lot number is absent', async () => {
    const lookup = vi.fn()
    const complex = {
      ...ABBREVIATED_COMPLEX,
      legalAddress: '경기도 화성동탄구 영천동',
      legalDongCode: '4159710600',
    }

    const response = await handleComplexOfficialPrice(
      request(),
      fakeDatabase(complex),
      complex.complexId,
      { lookup } as unknown as OfficialPriceService,
      {} as never,
      {} as ExecutionContext,
    )

    expect(lookup).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({
      key: 'A13583507:1:101',
      status: 'noData',
      reason: 'addressNotFound',
    })
  })
})
