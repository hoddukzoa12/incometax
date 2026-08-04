import { describe, expect, it } from 'vitest'

import {
  handleComplexBbox,
  parseBounds,
  queryComplexes,
} from '../worker/complex/bbox'

type ResultRow = {
  readonly complex_id: string
  readonly name: string
  readonly legal_address: string
  readonly road_address: string | null
  readonly legal_dong_code: string
  readonly approval_date: string | null
  readonly building_count: number | null
  readonly household_count: number | null
  readonly lat: number
  readonly lng: number
  readonly latest_trade_id: string | null
  readonly latest_trade_source: string | null
  readonly latest_trade_match_level: string | null
  readonly latest_trade_date: string | null
  readonly latest_trade_amount: number | null
  readonly latest_trade_area: number | null
  readonly latest_trade_floor: number | null
}

const resultRows = (count: number): ResultRow[] =>
  Array.from({ length: count }, (_, index) => ({
    complex_id: `A${String(index).padStart(8, '0')}`,
    name: `단지 ${index}`,
    legal_address: `주소 ${index}`,
    road_address: null,
    legal_dong_code: '1111010100',
    approval_date: null,
    building_count: 1,
    household_count: count - index,
    lat: 37.5,
    lng: 127,
    latest_trade_id: null,
    latest_trade_source: null,
    latest_trade_match_level: null,
    latest_trade_date: null,
    latest_trade_amount: null,
    latest_trade_area: null,
    latest_trade_floor: null,
  }))

const fakeDatabase = (rows: ReturnType<typeof resultRows>): D1Database =>
  ({
    prepare: () => ({
      bind: () => ({
        all: async () => ({ results: rows }),
      }),
    }),
  }) as unknown as D1Database

describe('parseBounds', () => {
  it('parses a valid WGS84 bounding box', () => {
    expect(
      parseBounds(
        new URLSearchParams({
          south: '37.45',
          west: '126.8',
          north: '37.7',
          east: '127.2',
        }),
      ),
    ).toEqual({ south: 37.45, west: 126.8, north: 37.7, east: 127.2 })
  })

  it.each([
    [{ west: '126.8', north: '37.7', east: '127.2' }, 'Missing south'],
    [
      { south: '37.7', west: '126.8', north: '37.45', east: '127.2' },
      'south must be less than north',
    ],
    [
      { south: '37.45', west: '127.2', north: '37.7', east: '126.8' },
      'west must be less than east',
    ],
    [
      { south: '37.45', west: '126.8', north: '91', east: '127.2' },
      'Invalid north',
    ],
  ])('rejects invalid bounds %#', (values, message) => {
    expect(() => parseBounds(new URLSearchParams(values))).toThrow(message)
  })
})

describe('queryComplexes', () => {
  it('caps marker results and reports truncation', async () => {
    const result = await queryComplexes(fakeDatabase(resultRows(501)), {
      south: 37,
      west: 126,
      north: 38,
      east: 128,
    })

    expect(result.items).toHaveLength(500)
    expect(result.truncated).toBe(true)
  })

  it('includes the latest cached trade for map labels', async () => {
    const [row] = resultRows(1)
    const result = await queryComplexes(
      fakeDatabase([
        {
          ...row,
          latest_trade_id: 'trade-1',
          latest_trade_source: 'apt',
          latest_trade_match_level: 'lot',
          latest_trade_date: '2026-08-01',
          latest_trade_amount: 2_700_000_000,
          latest_trade_area: 84.43,
          latest_trade_floor: 10,
        },
      ]),
      { south: 37, west: 126, north: 38, east: 128 },
    )

    expect(result.items[0].latestTrade).toMatchObject({
      tradeId: 'trade-1',
      dealAmount: 2_700_000_000,
    })
  })

  it('returns a 400 response for invalid bounds', async () => {
    const response = await handleComplexBbox(
      new URL('https://example.test/api/complexes?south=38&west=126&north=37&east=128'),
      fakeDatabase([]),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'south must be less than north',
    })
  })
})
