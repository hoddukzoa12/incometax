import { describe, expect, it } from 'vitest'

import {
  findComplex,
  handleComplexDetail,
  handleComplexSearch,
  searchComplexes,
} from '../worker/complex/catalog'

const EUNMA_ROW = {
  complex_id: 'A13583507',
  name: '은마',
  legal_address: '서울 강남구 대치동 316',
  road_address: '서울 강남구 삼성로 212',
  legal_dong_code: '1168010600',
  approval_date: '1979-08-30',
  building_count: 28,
  household_count: 4_424,
  lat: 37.4974,
  lng: 127.0653,
  lookup_status: 'matched',
  backfill_reason: null,
}

function fakeDatabase(rows: readonly Record<string, unknown>[]) {
  const binds: unknown[][] = []
  const sql: string[] = []
  const database = {
    prepare: (statement: string) => ({
      bind: (...values: unknown[]) => {
        sql.push(statement)
        binds.push(values)
        return {
          all: async () => ({ results: rows }),
          first: async () => rows[0] ?? null,
        }
      },
    }),
  } as unknown as D1Database
  return { database, binds, sql }
}

describe('complex catalog API', () => {
  it('searches our D1 catalog and escapes LIKE wildcards', async () => {
    const fake = fakeDatabase([EUNMA_ROW])

    await expect(searchComplexes(fake.database, '은마%_')).resolves.toEqual([
      expect.objectContaining({
        complexId: 'A13583507',
        name: '은마',
        legalAddress: '서울 강남구 대치동 316',
      }),
    ])
    expect(fake.binds[0]).toEqual(['%은마\\%\\_%', '은마%_', '은마\\%\\_%', 20])
    expect(fake.sql[0]).toContain('legal_address LIKE')
    expect(fake.sql[0]).toContain("COALESCE(road_address, '') LIKE")
  })

  it('uses the same catalog search for lot and road addresses', async () => {
    const lotAddress = fakeDatabase([EUNMA_ROW])
    const roadAddress = fakeDatabase([EUNMA_ROW])

    await expect(searchComplexes(lotAddress.database, '대치동 316')).resolves
      .toHaveLength(1)
    await expect(searchComplexes(roadAddress.database, '삼성로 212')).resolves
      .toHaveLength(1)
    expect(lotAddress.binds[0][0]).toBe('%대치동 316%')
    expect(roadAddress.binds[0][0]).toBe('%삼성로 212%')
  })

  it('returns complex basics by id', async () => {
    const fake = fakeDatabase([EUNMA_ROW])
    await expect(findComplex(fake.database, 'A13583507')).resolves.toMatchObject({
      approvalDate: '1979-08-30',
      buildingCount: 28,
      householdCount: 4_424,
    })

    const response = await handleComplexDetail(fake.database, 'A13583507')
    expect(response.status).toBe(200)
  })

  it('treats no search matches as normal and missing ids as 404', async () => {
    const fake = fakeDatabase([])
    const search = await handleComplexSearch(
      new URL('https://example.test/api/complexes/search?q=없는단지'),
      fake.database,
    )
    expect(search.status).toBe(200)
    await expect(search.json()).resolves.toEqual([])

    const detail = await handleComplexDetail(fake.database, 'missing')
    expect(detail.status).toBe(404)
  })

  it('rejects blank search terms', async () => {
    const fake = fakeDatabase([])
    const response = await handleComplexSearch(
      new URL('https://example.test/api/complexes/search?q=%20'),
      fake.database,
    )
    expect(response.status).toBe(400)
  })
})
