import type { RawTrade, TradeSource } from '../../shared/trade.ts'
import { fetchParsedText } from '../../scripts/lib/http.ts'
import { TRADE_SOURCE_URLS } from '../config/external-apis.ts'

export const TRADE_PAGE_SIZE = 1_000
export const MAXIMUM_TRADE_PAGES = 10
const SUCCESS_RESULT_CODES = new Set(['000', '00'])
const NO_DATA_RESULT_CODES = new Set(['03'])

const xmlDecode = (value: string): string =>
  value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .trim()

const xmlTag = (xml: string, tag: string): string => {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`).exec(xml)
  return match ? xmlDecode(match[1]) : ''
}

const parseXmlItems = (xml: string): readonly Record<string, string>[] => {
  const items: Record<string, string>[] = []
  const itemPattern = /<item>([\s\S]*?)<\/item>/g
  let itemMatch: RegExpExecArray | null

  while ((itemMatch = itemPattern.exec(xml))) {
    const item: Record<string, string> = {}
    const tagPattern = /<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g
    let tagMatch: RegExpExecArray | null
    while ((tagMatch = tagPattern.exec(itemMatch[1]))) {
      item[tagMatch[1]] = xmlDecode(tagMatch[2])
    }
    items.push(item)
  }
  return items
}

const first = (
  item: Readonly<Record<string, string>>,
  keys: readonly string[],
): string => {
  for (const key of keys) {
    const value = item[key]?.trim()
    if (value) return value
  }
  return ''
}

const requirePositiveNumber = (value: string, field: string): number => {
  const parsed = Number(value.replaceAll(',', '').trim())
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new TypeError(`Invalid ${field}: ${value}`)
  }
  return parsed
}

const requirePositiveInteger = (value: string, field: string): number => {
  const parsed = requirePositiveNumber(value, field)
  if (!Number.isInteger(parsed)) throw new TypeError(`Invalid ${field}: ${value}`)
  return parsed
}

const normalizeDealDate = (
  item: Readonly<Record<string, string>>,
): string => {
  const year = first(item, ['dealYear'])
  const month = first(item, ['dealMonth']).padStart(2, '0')
  const day = first(item, ['dealDay']).padStart(2, '0')
  const value = `${year}-${month}-${day}`
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError(`Invalid deal date: ${value}`)
  }
  if (new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value) {
    throw new TypeError(`Invalid deal date: ${value}`)
  }
  return value
}

const normalizeFloor = (value: string): number | null => {
  if (!value) return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) throw new TypeError(`Invalid floor: ${value}`)
  return parsed
}

const normalizeTrade = (
  source: TradeSource,
  item: Readonly<Record<string, string>>,
): RawTrade => ({
  source,
  legalDongName: first(item, ['umdNm']),
  jibun: first(item, ['jibun']),
  buildingName: first(item, ['aptNm', 'mhouseNm', 'offiNm']),
  houseType: first(item, ['houseType']),
  floor: normalizeFloor(first(item, ['floor'])),
  exclusiveArea: requirePositiveNumber(
    first(item, ['excluUseAr']),
    'exclusive area',
  ),
  landArea: first(item, ['landAr', 'plottageAr']),
  totalFloorArea: first(item, ['totalFloorAr']),
  dealDate: normalizeDealDate(item),
  dealAmount:
    requirePositiveInteger(first(item, ['dealAmount']), 'deal amount') * 10_000,
  cancellationType: first(item, ['cdealType']),
  cancellationDate: first(item, ['cdealDay']),
})

export const parseTradePage = (
  xml: string,
  source: TradeSource,
): { readonly items: readonly RawTrade[]; readonly totalCount: number } => {
  const resultCode = xmlTag(xml, 'resultCode')
  const resultMessage =
    xmlTag(xml, 'resultMsg') || xmlTag(xml, 'returnAuthMsg')
  if (resultCode && !SUCCESS_RESULT_CODES.has(resultCode)) {
    if (
      NO_DATA_RESULT_CODES.has(resultCode) ||
      /NO_DATA|NODATA|데이터.*없/i.test(resultMessage)
    ) {
      return { items: [], totalCount: 0 }
    }
    throw new Error(
      `Trade API error ${resultCode}${resultMessage ? `: ${resultMessage}` : ''}`,
    )
  }

  const totalCount = Number(xmlTag(xml, 'totalCount')) || 0
  return {
    items: parseXmlItems(xml).map((item) => normalizeTrade(source, item)),
    totalCount,
  }
}

const encodedServiceKey = (serviceKey: string): string =>
  serviceKey.includes('%') ? serviceKey : encodeURIComponent(serviceKey)

export const buildTradeApiUrl = (
  source: TradeSource,
  serviceKey: string,
  legalDistrictCode: string,
  dealYearMonth: string,
  pageNumber: number,
): URL => {
  const url = new URL(TRADE_SOURCE_URLS[source])
  url.search = [
    `serviceKey=${encodedServiceKey(serviceKey)}`,
    `LAWD_CD=${encodeURIComponent(legalDistrictCode)}`,
    `DEAL_YMD=${encodeURIComponent(dealYearMonth)}`,
    `pageNo=${pageNumber}`,
    `numOfRows=${TRADE_PAGE_SIZE}`,
  ].join('&')
  return url
}

export const fetchTradeDataset = async (
  source: TradeSource,
  serviceKey: string,
  legalDistrictCode: string,
  dealYearMonth: string,
  readXml?: (url: URL) => Promise<string>,
): Promise<readonly RawTrade[]> => {
  const readPage = async (pageNumber: number) => {
    const url = buildTradeApiUrl(
      source,
      serviceKey,
      legalDistrictCode,
      dealYearMonth,
      pageNumber,
    )
    return readXml
      ? parseTradePage(await readXml(url), source)
      : fetchParsedText(url, (xml) => parseTradePage(xml, source))
  }
  const firstPage = await readPage(1)
  const pageCount = Math.max(
    1,
    Math.ceil(firstPage.totalCount / TRADE_PAGE_SIZE),
  )
  if (pageCount > MAXIMUM_TRADE_PAGES) {
    throw new Error(
      `Trade API page count ${pageCount} exceeds limit ${MAXIMUM_TRADE_PAGES}`,
    )
  }

  const items = [...firstPage.items]
  for (let pageNumber = 2; pageNumber <= pageCount; pageNumber += 1) {
    const page = await readPage(pageNumber)
    items.push(...page.items)
  }
  return items
}
