import { describe, expect, it } from 'vitest'

import type {
  ComplexMatchCandidate,
  RawTrade,
  TradeSource,
} from '../shared/trade'
import {
  matchTrade,
  matchesDong,
  normalizeComplexName,
  normalizeJibun,
  prepareComplexCandidate,
  prepareTradeDataset,
  removeCanceled,
} from '../worker/trade/matching'

const rawTrade = (
  overrides: Partial<RawTrade> = {},
  source: TradeSource = 'apt',
): RawTrade => ({
  source,
  legalDongName: '대치동',
  jibun: '316',
  buildingName: '은마',
  houseType: '',
  floor: 10,
  exclusiveArea: 84.43,
  landArea: '',
  totalFloorArea: '',
  dealDate: '2026-08-01',
  dealAmount: 2_700_000_000,
  cancellationType: '',
  cancellationDate: '',
  ...overrides,
})

const complex = (
  overrides: Partial<ComplexMatchCandidate> = {},
): ComplexMatchCandidate => ({
  complexId: 'A10000001',
  name: '은마아파트',
  legalAddress: '서울특별시 강남구 대치동 316번지',
  legalDongCode: '1168010600',
  ...overrides,
})

describe('trade complex matching', () => {
  it('normalizes unicode hyphens, 번지, leading zeroes, and name noise', () => {
    expect(normalizeJibun(' 0015–03번지 ')).toBe('15-3')
    expect(normalizeJibun('산 0015‑03')).toBe('산15-3')
    expect(normalizeComplexName('래미안 아파트')).toBe('래미안')
    expect(normalizeComplexName('RAEMIAN APT.')).toBe('raemian')
    expect(normalizeComplexName('상계주공16단지(고층)')).toBe('상계주공16')
  })

  it('requires legal-dong agreement when both sides provide one', () => {
    const target = prepareComplexCandidate(complex())
    expect(matchesDong(rawTrade(), target)).toBe(true)
    expect(
      matchesDong(rawTrade({ legalDongName: '역삼동' }), target),
    ).toBe(false)
  })

  it('grades exact normalized lot matches as lot', () => {
    const target = prepareComplexCandidate(complex())
    expect(matchTrade(rawTrade({ buildingName: '전혀 다른 이름' }), [target])).toEqual({
      status: 'matched',
      matchLevel: 'lot',
      complex: target,
    })
  })

  it('uses normalized names to disambiguate complexes that share one lot', () => {
    const candidates = [
      prepareComplexCandidate(
        complex({
          complexId: 'A1',
          name: '월계주공1단지',
          legalAddress: '서울특별시 노원구 월계동 556',
        }),
      ),
      prepareComplexCandidate(
        complex({
          complexId: 'A2',
          name: '월계주공2단지',
          legalAddress: '서울특별시 노원구 월계동 556',
        }),
      ),
    ]
    expect(
      matchTrade(
        rawTrade({
          legalDongName: '월계동',
          jibun: '556',
          buildingName: '주공2',
        }),
        candidates,
      ),
    ).toMatchObject({
      status: 'matched',
      matchLevel: 'lot',
      complex: { complexId: 'A2' },
    })
  })

  it('allows phase suffixes only while disambiguating an exact shared lot', () => {
    const candidates = [
      prepareComplexCandidate(
        complex({
          complexId: 'A1',
          name: '하계한신',
          legalAddress: '서울특별시 노원구 하계동 284',
        }),
      ),
      prepareComplexCandidate(
        complex({
          complexId: 'A2',
          name: '하계청구',
          legalAddress: '서울특별시 노원구 하계동 284',
        }),
      ),
    ]
    expect(
      matchTrade(
        rawTrade({
          legalDongName: '하계동',
          jibun: '284',
          buildingName: '한신1',
        }),
        candidates,
      ),
    ).toMatchObject({ status: 'matched', complex: { complexId: 'A1' } })
  })

  it('grades a unique normalized-name fallback in the same dong as candidate', () => {
    const target = prepareComplexCandidate(
      complex({
        name: '래미안아파트',
        legalAddress: '서울특별시 강남구 대치동 999',
      }),
    )
    expect(
      matchTrade(rawTrade({ buildingName: '래미안', jibun: '998' }), [target]),
    ).toMatchObject({ status: 'matched', matchLevel: 'candidate' })
  })

  it('does not guess when a name-only candidate is ambiguous', () => {
    const candidates = [
      prepareComplexCandidate(
        complex({ complexId: 'A1', name: '현대아파트', legalAddress: '서울 강남구 대치동 1' }),
      ),
      prepareComplexCandidate(
        complex({ complexId: 'A2', name: '현대', legalAddress: '서울 강남구 대치동 2' }),
      ),
    ]
    expect(
      matchTrade(rawTrade({ buildingName: '현대', jibun: '3' }), candidates),
    ).toEqual({ status: 'ambiguous' })
  })
})

describe('cancelled trade removal', () => {
  it.each([
    ['cdealType', { cancellationType: 'O' }],
    ['cdealDay', { cancellationDate: '2026-08-03' }],
  ])('removes both %s rows and matching originals by full identity', (_field, marker) => {
    const original = rawTrade()
    const cancellation = rawTrade(marker)
    const differentFloor = rawTrade({ floor: 11 })

    expect(removeCanceled([original, cancellation, differentFloor])).toEqual({
      items: [differentFloor],
      removedCount: 2,
    })
  })

  it('deduplicates active identities and reports auditable matching counts', async () => {
    const trade = rawTrade()
    const result = await prepareTradeDataset(
      { source: 'apt', legalDistrictCode: '11680', dealYearMonth: '202608' },
      [trade, trade],
      [prepareComplexCandidate(complex())],
      '2025-08-04',
      '2026-08-04',
    )

    expect(result.trades).toHaveLength(1)
    expect(result.trades[0].tradeId).toMatch(/^[0-9a-f]{64}$/)
    expect(result.stats).toMatchObject({
      rawCount: 2,
      duplicateCount: 1,
      activeCount: 1,
      matchedCount: 1,
      lotCount: 1,
    })
  })
})
