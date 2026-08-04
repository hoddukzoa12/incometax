import { MOIS_REGION_CODE_URL } from '../config/external-apis'
import { DEFAULT_FETCHER } from '../http/fetch'

export const LDONG_SNAPSHOT_KEY = 'ldong:snapshot:v1'

const SOURCE_NAME = 'MOIS StanReginCd realtime'
const REGION_CODES_PER_PAGE = 1_000
const PAGE_REQUEST_INTERVAL_MS = 150
const REGION_CODE_TIMEOUT_MS = 10_000
const REGION_CODE_RETRY_DELAYS_MS = [500, 1_500] as const
export const MINIMUM_REGION_CODE_COUNT = 15_000
const ACTIVE_REGION_FLAG = 'Y'
const JSON_RESPONSE_TYPE = 'json'
const SUCCESS_RESULT_CODE = 'INFO-0'

export const REQUIRED_REGION_CODES = {
  '서울특별시 종로구 청운동': '1111010100',
} as const

export interface LdongSnapshot {
  readonly builtAt: number
  readonly count: number
  readonly source: string
  readonly codes: Readonly<Record<string, string>>
}

interface RegionCodeRow {
  readonly region_cd?: string | number
  readonly locatadd_nm?: string
}

interface RegionCodePage {
  readonly total: number
  readonly rows: readonly RegionCodeRow[]
}

export interface LdongRefreshEnv {
  readonly LDONG: KVNamespace
  readonly DATA_GO_KR_SERVICE_KEY: string
}

export interface LdongRefreshDependencies {
  readonly fetcher?: typeof fetch
  readonly now?: () => number
  readonly sleep?: (milliseconds: number) => Promise<void>
}

const defaultSleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds))

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function findSection(
  sections: readonly unknown[],
  key: 'head' | 'row',
): readonly unknown[] {
  for (const section of sections) {
    if (!isRecord(section) || !Array.isArray(section[key])) continue
    return section[key]
  }
  return []
}

export function parseRegionCodePage(
  payload: unknown,
  pageNumber: number,
): RegionCodePage {
  if (!isRecord(payload) || !Array.isArray(payload.StanReginCd)) {
    throw new Error(`행정표준코드 응답 형식 오류 (page ${pageNumber})`)
  }

  const headEntries = findSection(payload.StanReginCd, 'head')
  const head = isRecord(headEntries[0]) ? headEntries[0] : {}
  const resultValue = head.RESULT ?? head.result
  const result = isRecord(resultValue) ? resultValue : {}
  const resultCode = String(result.resultCode ?? '').trim()

  if (resultCode && resultCode !== SUCCESS_RESULT_CODE) {
    throw new Error(
      `행정표준코드 ${resultCode}: ${String(result.resultMsg ?? '조회 실패')}`,
    )
  }

  const rows = findSection(payload.StanReginCd, 'row').filter(
    isRecord,
  ) as RegionCodeRow[]

  return {
    total: Number(head.totalCount ?? 0),
    rows,
  }
}

function decodeServiceKey(serviceKey: string): string {
  try {
    return decodeURIComponent(serviceKey)
  } catch {
    return serviceKey
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500
}

async function fetchPage(
  serviceKey: string,
  pageNumber: number,
  dependencies: Required<LdongRefreshDependencies>,
): Promise<RegionCodePage> {
  const url = new URL(MOIS_REGION_CODE_URL)
  url.searchParams.set('ServiceKey', decodeServiceKey(serviceKey))
  url.searchParams.set('pageNo', String(pageNumber))
  url.searchParams.set('numOfRows', String(REGION_CODES_PER_PAGE))
  url.searchParams.set('type', JSON_RESPONSE_TYPE)
  url.searchParams.set('flag', ACTIVE_REGION_FLAG)

  for (
    let attempt = 0;
    attempt <= REGION_CODE_RETRY_DELAYS_MS.length;
    attempt += 1
  ) {
    const controller = new AbortController()
    const timeout = setTimeout(
      () => controller.abort(),
      REGION_CODE_TIMEOUT_MS,
    )

    let response: Response
    try {
      // Sending Accept: application/json makes this API return HTTP 500 even
      // when type=json, so intentionally do not add that header.
      response = await dependencies.fetcher(url, {
        signal: controller.signal,
      })
    } catch (error) {
      if (attempt === REGION_CODE_RETRY_DELAYS_MS.length) {
        throw new Error(
          `행정표준코드 연결 실패 (page ${pageNumber})`,
          { cause: error },
        )
      }
      await dependencies.sleep(REGION_CODE_RETRY_DELAYS_MS[attempt])
      continue
    } finally {
      clearTimeout(timeout)
    }

    const text = await response.text()
    if (response.ok) {
      try {
        return parseRegionCodePage(JSON.parse(text), pageNumber)
      } catch (error) {
        if (error instanceof SyntaxError) {
          throw new Error(
            `행정표준코드 JSON 파싱 실패 (page ${pageNumber})`,
            { cause: error },
          )
        }
        throw error
      }
    }

    if (
      !isRetryableStatus(response.status) ||
      attempt === REGION_CODE_RETRY_DELAYS_MS.length
    ) {
      const detail = text.replace(/\s+/g, ' ').trim().slice(0, 240)
      throw new Error(
        `행정표준코드 HTTP ${response.status} (page ${pageNumber})${detail ? `: ${detail}` : ''}`,
      )
    }
    await dependencies.sleep(REGION_CODE_RETRY_DELAYS_MS[attempt])
  }

  throw new Error(`행정표준코드 요청 실패 (page ${pageNumber})`)
}

function ingestRows(
  target: Record<string, string>,
  rows: readonly RegionCodeRow[],
): void {
  for (const row of rows) {
    const name = String(row.locatadd_nm ?? '').replace(/\s+/g, ' ').trim()
    const code = String(row.region_cd ?? '').padStart(10, '0')
    if (name && /^\d{10}$/.test(code)) target[name] = code
  }
}

export function validateRegionCodes(
  codes: Readonly<Record<string, string>>,
): void {
  const count = Object.keys(codes).length
  if (count < MINIMUM_REGION_CODE_COUNT) {
    throw new Error(`행정표준코드 건수 검증 실패: ${count}건`)
  }

  for (const [name, expectedCode] of Object.entries(REQUIRED_REGION_CODES)) {
    if (codes[name] !== expectedCode) {
      throw new Error(`행정표준코드 필수값 검증 실패: ${name}`)
    }
  }
}

export async function refreshLdong(
  env: LdongRefreshEnv,
  dependencyOverrides: LdongRefreshDependencies = {},
): Promise<LdongSnapshot> {
  if (!env.DATA_GO_KR_SERVICE_KEY) {
    throw new Error('DATA_GO_KR_SERVICE_KEY 없음')
  }

  const dependencies: Required<LdongRefreshDependencies> = {
    fetcher: dependencyOverrides.fetcher ?? DEFAULT_FETCHER,
    now: dependencyOverrides.now ?? Date.now,
    sleep: dependencyOverrides.sleep ?? defaultSleep,
  }
  const firstPage = await fetchPage(
    env.DATA_GO_KR_SERVICE_KEY,
    1,
    dependencies,
  )
  const pageCount = Math.ceil(firstPage.total / REGION_CODES_PER_PAGE)

  if (!firstPage.total || !pageCount) {
    throw new Error('행정표준코드 전체 건수가 0건입니다.')
  }

  const codes: Record<string, string> = {}
  ingestRows(codes, firstPage.rows)

  for (let pageNumber = 2; pageNumber <= pageCount; pageNumber += 1) {
    await dependencies.sleep(PAGE_REQUEST_INTERVAL_MS)
    const page = await fetchPage(
      env.DATA_GO_KR_SERVICE_KEY,
      pageNumber,
      dependencies,
    )
    ingestRows(codes, page.rows)
  }

  validateRegionCodes(codes)

  const snapshot: LdongSnapshot = {
    builtAt: dependencies.now(),
    count: Object.keys(codes).length,
    source: SOURCE_NAME,
    codes,
  }

  // One validated snapshot and one KV put prevent readers from observing a
  // partially replaced map. If validation or collection fails, this is never run.
  await env.LDONG.put(LDONG_SNAPSHOT_KEY, JSON.stringify(snapshot))
  return snapshot
}
