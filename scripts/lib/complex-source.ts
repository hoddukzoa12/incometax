import { EXTERNAL_API_URLS } from '../../worker/config/external-apis.ts'
import {
  fetchJson,
  fetchParsedJson,
  type HttpMetricsObserver,
} from './http.ts'

export const KAPT_LIST_PAGE_SIZE = 1_000
const DEFAULT_PAGE_SIZE = KAPT_LIST_PAGE_SIZE
export const KAPT_SUCCESS_RESULT_CODE = '00'

export type JsonRecord = Record<string, unknown>

export interface KaptListPage {
  readonly items: JsonRecord[]
  readonly pageNo: number
  readonly numOfRows: number
  readonly totalCount: number
  readonly raw: unknown
}

export interface RebPage {
  readonly data: JsonRecord[]
  readonly page: number
  readonly perPage: number
  readonly totalCount: number
  readonly currentCount: number
  readonly raw: unknown
}

export const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const requireRecord = (value: unknown, path: string): JsonRecord => {
  if (!isRecord(value)) {
    throw new TypeError(`Expected object at ${path}`)
  }

  return value
}

export const requireKaptResponse = (value: unknown): JsonRecord => {
  const envelope = requireRecord(value, 'envelope')
  return requireRecord(envelope.response, 'envelope.response')
}

const requireArray = (value: unknown, path: string): unknown[] => {
  if (!Array.isArray(value)) {
    throw new TypeError(`Expected array at ${path}`)
  }

  return value
}

export const requireString = (value: unknown, path: string): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`Expected non-empty string at ${path}`)
  }

  return value
}

export const recordFields = (records: readonly JsonRecord[]): string[] =>
  [...new Set(records.flatMap((record) => Object.keys(record)))].sort()

const requireInteger = (value: unknown, path: string): number => {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new TypeError(`Expected non-negative integer at ${path}`)
  }

  return parsed
}

const decodeServiceKey = (serviceKey: string): string => {
  try {
    return decodeURIComponent(serviceKey)
  } catch {
    return serviceKey
  }
}

const addServiceKey = (url: URL, serviceKey: string): void => {
  url.searchParams.set('serviceKey', decodeServiceKey(serviceKey))
}

export const readKaptPage = async (
  serviceKey: string,
  pageNo: number,
  observer?: HttpMetricsObserver,
): Promise<KaptListPage> => {
  const url = new URL(EXTERNAL_API_URLS.kaptComplexList)
  addServiceKey(url, serviceKey)
  url.searchParams.set('pageNo', String(pageNo))
  url.searchParams.set('numOfRows', String(DEFAULT_PAGE_SIZE))

  return fetchParsedJson(url, (raw) => {
    const response = requireKaptResponse(raw)
    const header = requireRecord(response.header, 'response.header')
    if (header.resultCode !== KAPT_SUCCESS_RESULT_CODE) {
      throw new Error(
        `K-apt list API failed: ${String(header.resultCode)} ${String(header.resultMsg)}`,
      )
    }

    const body = requireRecord(response.body, 'response.body')
    const rawItems = requireArray(body.items, 'response.body.items')

    return {
      items: rawItems.map((item, index) =>
        requireRecord(item, `response.body.items[${index}]`),
      ),
      pageNo: requireInteger(body.pageNo, 'response.body.pageNo'),
      numOfRows: requireInteger(body.numOfRows, 'response.body.numOfRows'),
      totalCount: requireInteger(body.totalCount, 'response.body.totalCount'),
      raw,
    }
  }, {}, { observer })
}

export const readKaptBasis = async <T = unknown>(
  serviceKey: string,
  kaptCode: string,
  parse: (value: unknown) => T = (value) => value as T,
  observer?: HttpMetricsObserver,
): Promise<T> => {
  const url = new URL(EXTERNAL_API_URLS.kaptComplexBasis)
  addServiceKey(url, serviceKey)
  url.searchParams.set('kaptCode', kaptCode)
  return fetchParsedJson(url, parse, {}, { observer })
}

export const readRebPage = async (
  serviceKey: string,
  page: number,
): Promise<RebPage> => {
  const url = new URL(EXTERNAL_API_URLS.rebComplexInfo)
  addServiceKey(url, serviceKey)
  url.searchParams.set('page', String(page))
  url.searchParams.set('perPage', String(DEFAULT_PAGE_SIZE))
  url.searchParams.set('returnType', 'JSON')

  const raw = await fetchJson(url)
  const response = requireRecord(raw, 'response')
  const rawData = requireArray(response.data, 'response.data')

  return {
    data: rawData.map((item, index) =>
      requireRecord(item, `response.data[${index}]`),
    ),
    page: requireInteger(response.page, 'response.page'),
    perPage: requireInteger(response.perPage, 'response.perPage'),
    totalCount: requireInteger(response.totalCount, 'response.totalCount'),
    currentCount: requireInteger(response.currentCount, 'response.currentCount'),
    raw,
  }
}

export const collectPages = async <T>(
  firstPage: readonly T[],
  totalCount: number,
  readPage: (page: number) => Promise<readonly T[]>,
): Promise<T[]> => {
  const collected = [...firstPage]
  const totalPages = Math.ceil(totalCount / DEFAULT_PAGE_SIZE)

  for (let page = 2; page <= totalPages; page += 1) {
    const items = await readPage(page)
    collected.push(...items)
    console.log(`verified page ${page}/${totalPages}: ${collected.length} records`)
  }

  if (collected.length !== totalCount) {
    throw new Error(
      `Pagination count mismatch: expected ${totalCount}, received ${collected.length}`,
    )
  }

  return collected
}
