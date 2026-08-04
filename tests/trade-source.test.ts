import { describe, expect, it, vi } from 'vitest'

import {
  buildTradeApiUrl,
  fetchTradeDataset,
  MAXIMUM_TRADE_PAGES,
  parseTradePage,
  TRADE_PAGE_SIZE,
} from '../worker/trade/source'

const itemXml = (nameTag = 'aptNm') => `
  <item>
    <umdNm>대치동</umdNm><jibun>316</jibun><${nameTag}>은마</${nameTag}>
    <dealYear>2026</dealYear><dealMonth>8</dealMonth><dealDay>1</dealDay>
    <dealAmount>270,000</dealAmount><excluUseAr>84.43</excluUseAr>
    <floor>10</floor><cdealType>O</cdealType><cdealDay>26.08.03</cdealDay>
  </item>`

const pageXml = (totalCount: number, item = itemXml()): string => `
  <response><header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header>
  <body><items>${item}</items><totalCount>${totalCount}</totalCount></body></response>`

describe('trade XML source', () => {
  it('parses XML and converts API 만원 amounts to integer KRW', () => {
    const result = parseTradePage(pageXml(1), 'apt')
    expect(result.totalCount).toBe(1)
    expect(result.items[0]).toMatchObject({
      source: 'apt',
      buildingName: '은마',
      dealDate: '2026-08-01',
      dealAmount: 2_700_000_000,
      exclusiveArea: 84.43,
      floor: 10,
      cancellationType: 'O',
      cancellationDate: '26.08.03',
    })
  })

  it.each([
    ['rowhouse', 'mhouseNm'],
    ['officetel', 'offiNm'],
  ] as const)('normalizes %s building names', (source, tag) => {
    expect(parseTradePage(pageXml(1, itemXml(tag)), source).items[0].buildingName).toBe('은마')
  })

  it('treats the official no-data code as an empty page', () => {
    expect(
      parseTradePage(
        '<response><resultCode>03</resultCode><resultMsg>NO_DATA</resultMsg></response>',
        'apt',
      ),
    ).toEqual({ items: [], totalCount: 0 })
  })

  it('builds the documented request parameters without double-encoding the key', () => {
    const url = buildTradeApiUrl('apt', 'abc%2B123', '11680', '202608', 2)
    expect(url.searchParams.get('serviceKey')).toBe('abc+123')
    expect(url.searchParams.get('LAWD_CD')).toBe('11680')
    expect(url.searchParams.get('DEAL_YMD')).toBe('202608')
    expect(url.searchParams.get('pageNo')).toBe('2')
    expect(url.searchParams.get('numOfRows')).toBe(String(TRADE_PAGE_SIZE))
  })

  it('collects every XML page and rejects silent truncation beyond the cap', async () => {
    const readXml = vi
      .fn<(url: URL) => Promise<string>>()
      .mockResolvedValueOnce(pageXml(TRADE_PAGE_SIZE + 1))
      .mockResolvedValueOnce(pageXml(TRADE_PAGE_SIZE + 1))
    await expect(
      fetchTradeDataset('apt', 'key', '11680', '202608', readXml),
    ).resolves.toHaveLength(2)
    expect(readXml).toHaveBeenCalledTimes(2)

    await expect(
      fetchTradeDataset(
        'apt',
        'key',
        '11680',
        '202608',
        async () => pageXml(TRADE_PAGE_SIZE * MAXIMUM_TRADE_PAGES + 1),
      ),
    ).rejects.toThrow('exceeds limit')
  })
})
