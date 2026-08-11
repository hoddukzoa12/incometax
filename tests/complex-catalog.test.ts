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
  place_url: 'http://place.map.kakao.com/11335658',
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
    expect(fake.sql[0]).toContain('legal_address')
    expect(fake.sql[0]).toContain('road_address')
  })

  it('uses the same catalog search for lot and road addresses', async () => {
    const lotAddress = fakeDatabase([EUNMA_ROW])
    const roadAddress = fakeDatabase([EUNMA_ROW])

    await expect(searchComplexes(lotAddress.database, '대치동 316')).resolves
      .toHaveLength(1)
    await expect(searchComplexes(roadAddress.database, '삼성로 212')).resolves
      .toHaveLength(1)
    expect(lotAddress.binds[0][0]).toBe('%대치동316%')
    expect(roadAddress.binds[0][0]).toBe('%삼성로212%')
  })

  /*
   * 주소는 `서울 강남구 대치동 316` 으로 저장되는데 사람은 `대치동316` 으로도 친다.
   * 검색어와 컬럼 양쪽에서 띄어쓰기를 지우므로 두 표기가 같은 것을 찾고,
   * 순위를 정하는 식도 같은 값을 본다.
   */
  it('finds the same rows whether or not the query has spaces', async () => {
    const spaced = fakeDatabase([EUNMA_ROW])
    const squashed = fakeDatabase([EUNMA_ROW])

    await expect(searchComplexes(spaced.database, '대치동 316')).resolves
      .toHaveLength(1)
    await expect(searchComplexes(squashed.database, '대치동316')).resolves
      .toHaveLength(1)

    expect(spaced.binds[0]).toEqual(squashed.binds[0])
    expect(spaced.sql[0]).toBe(squashed.sql[0])
    expect(spaced.sql[0]).toContain("REPLACE(legal_address, ' ', '')")
  })

  it('keeps LIKE wildcards escaped after squashing whitespace', async () => {
    const fake = fakeDatabase([EUNMA_ROW])
    await searchComplexes(fake.database, '대치동 3_1%6')
    expect(fake.binds[0][0]).toBe('%대치동3\\_1\\%6%')
  })

  it('returns complex basics by id', async () => {
    const fake = fakeDatabase([EUNMA_ROW])
    await expect(findComplex(fake.database, 'A13583507')).resolves.toMatchObject({
      approvalDate: '1979-08-30',
      buildingCount: 28,
      householdCount: 4_424,
      placeUrl: 'http://place.map.kakao.com/11335658',
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
