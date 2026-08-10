import type {
  CompleteComplexListRecord,
  ComplexStagingRecord,
} from '../../shared/complex.ts'
import { isLegalDongCode } from '../../shared/legal-dong.ts'
import { EXTERNAL_API_URLS } from '../../worker/config/external-apis.ts'
import {
  fetchParsedJson,
  type HttpMetricsObserver,
  HttpResponseError,
} from './http.ts'
import { isKakaoComplexPlaceCandidate } from './kakao-place-match.ts'

const KAKAO_AUTH_SCHEME = 'KakaoAK'
const PARENTHETICAL_NAME_SUFFIX_PATTERN = /\s*\([^()]*\)\s*$/u
const APT_NAME_SUFFIX_PATTERN = /\s*A\.?P\.?T\.?\s*$/iu
const LEGAL_DONG_REGION_TYPE = 'B'
const KAKAO_BAD_COORDINATE_STATUS = 400
const KAKAO_QUOTA_EXCEEDED_CODE = -10
const KAKAO_BAD_COORDINATE_REASON =
  'Kakao coordinate lookup rejected the coordinates with HTTP 400'
const KAKAO_KEYWORD_MAX_PAGE_SIZE = 15

type JsonRecord = Record<string, unknown>

export interface KakaoKeywordDocument {
  readonly placeId: string
  readonly placeName: string
  readonly categoryName: string
  readonly placeUrl: string
  readonly legalAddress: string
  readonly roadAddress: string | null
  readonly lat: number
  readonly lng: number
}

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isKakaoQuotaExceeded = (error: HttpResponseError): boolean => {
  try {
    const payload = JSON.parse(error.responseBody) as unknown
    return isRecord(payload) && payload.code === KAKAO_QUOTA_EXCEEDED_CODE
  } catch {
    return false
  }
}

const requiredString = (value: unknown, path: string): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`Expected non-empty string at ${path}`)
  }
  return value.trim()
}

const requiredRawString = (value: unknown, path: string): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`Expected non-empty string at ${path}`)
  }
  return value
}

const optionalString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null

const coordinate = (
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
): number => {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new TypeError(`Invalid ${label} coordinate`)
  }
  return parsed
}

export const normalizeKakaoQueryName = (name: string): string =>
  name
    .normalize('NFKC')
    .replace(PARENTHETICAL_NAME_SUFFIX_PATTERN, '')
    .replace(APT_NAME_SUFFIX_PATTERN, '')
    .trim()

export const buildKakaoComplexQuery = (
  input: CompleteComplexListRecord,
): string =>
  [
    input.district,
    input.legalDong,
    input.ri,
    normalizeKakaoQueryName(input.name),
  ]
    .filter((part): part is string => part !== null)
    .filter((part) => part !== '')
    .join(' ')

const fallbackLegalAddress = (input: CompleteComplexListRecord): string =>
  [input.province, input.district, input.legalDong, input.ri]
    .filter((part): part is string => part !== null)
    .join(' ')

const pendingBackfillRecord = (
  input: CompleteComplexListRecord,
  status: 'notFound' | 'rejected',
  reason: string,
): ComplexStagingRecord => ({
  complexId: input.complexId,
  name: input.name,
  legalAddress: fallbackLegalAddress(input),
  roadAddress: null,
  legalDongCode: input.legalDongCode,
  approvalDate: null,
  buildingCount: null,
  householdCount: null,
  lat: null,
  lng: null,
  lookupStatus: status,
  backfillReason: reason,
  placeUrl: null,
})

const parseDocument = (
  value: unknown,
  index: number,
): KakaoKeywordDocument => {
  if (!isRecord(value)) {
    throw new TypeError(`Expected object at documents[${index}]`)
  }
  return {
    placeId: requiredString(value.id, `documents[${index}].id`),
    placeName: requiredString(
      value.place_name,
      `documents[${index}].place_name`,
    ),
    categoryName: requiredString(
      value.category_name,
      `documents[${index}].category_name`,
    ),
    placeUrl: requiredRawString(
      value.place_url,
      `documents[${index}].place_url`,
    ),
    legalAddress: requiredString(
      value.address_name,
      `documents[${index}].address_name`,
    ),
    roadAddress: optionalString(value.road_address_name),
    lat: coordinate(value.y, 'latitude', -90, 90),
    lng: coordinate(value.x, 'longitude', -180, 180),
  }
}

export const parseKakaoKeywordSearchDocuments = (
  payload: unknown,
): readonly KakaoKeywordDocument[] => {
  if (!isRecord(payload) || !Array.isArray(payload.documents)) {
    throw new TypeError('Kakao keyword response is missing documents')
  }
  return payload.documents.map(parseDocument)
}

export const parseKakaoKeywordSearchResponse = (
  payload: unknown,
): KakaoKeywordDocument | null => {
  return parseKakaoKeywordSearchDocuments(payload).at(0) ?? null
}

export const isKakaoQuotaExceededError = (error: unknown): boolean => {
  let current = error
  while (current instanceof Error) {
    if (
      current instanceof HttpResponseError &&
      isKakaoQuotaExceeded(current)
    ) {
      return true
    }
    current = current.cause
  }
  return false
}

export const searchKakaoKeywordDocuments = async (
  query: string,
  restApiKey: string,
  observer?: HttpMetricsObserver,
): Promise<readonly KakaoKeywordDocument[]> => {
  const url = new URL(EXTERNAL_API_URLS.kakaoKeywordSearch)
  url.searchParams.set('query', query)
  url.searchParams.set('size', String(KAKAO_KEYWORD_MAX_PAGE_SIZE))
  return fetchParsedJson(
    url,
    parseKakaoKeywordSearchDocuments,
    { headers: { authorization: `${KAKAO_AUTH_SCHEME} ${restApiKey}` } },
    { observer },
  )
}

export const parseKakaoLegalDongCodeResponse = (
  payload: unknown,
): string | null => {
  if (!isRecord(payload) || !Array.isArray(payload.documents)) {
    throw new TypeError('Kakao coordinate-region response is missing documents')
  }
  const legalDong = payload.documents.find(
    (document) =>
      isRecord(document) && document.region_type === LEGAL_DONG_REGION_TYPE,
  )
  if (!isRecord(legalDong)) return null
  const code = requiredString(legalDong.code, 'legal-dong document.code')
  if (!isLegalDongCode(code)) {
    throw new TypeError('Kakao legal-dong code must contain 10 digits')
  }
  return code
}

export const classifyKakaoComplexResult = (
  input: CompleteComplexListRecord,
  document: KakaoKeywordDocument | null,
  actualLegalDongCode: string | null,
): ComplexStagingRecord => {
  if (document === null) {
    return pendingBackfillRecord(
      input,
      'notFound',
      'Kakao keyword search returned no results',
    )
  }
  if (actualLegalDongCode !== input.legalDongCode) {
    return pendingBackfillRecord(
      input,
      'rejected',
      actualLegalDongCode === null
        ? 'Kakao coordinate lookup returned no legal-dong code'
        : `Kakao legal-dong code mismatch: ${input.legalDongCode} -> ${actualLegalDongCode}`,
    )
  }

  return {
    complexId: input.complexId,
    name: input.name,
    legalAddress: document.legalAddress,
    roadAddress: document.roadAddress,
    legalDongCode: input.legalDongCode,
    approvalDate: null,
    buildingCount: null,
    householdCount: null,
    lat: document.lat,
    lng: document.lng,
    placeUrl: isKakaoComplexPlaceCandidate(input.name, document)
      ? document.placeUrl
      : null,
    lookupStatus: 'matched',
    backfillReason: null,
  }
}

export const searchKakaoComplex = async (
  input: CompleteComplexListRecord,
  restApiKey: string,
  observer?: HttpMetricsObserver,
): Promise<ComplexStagingRecord> => {
  const requestOptions = {
    headers: { authorization: `${KAKAO_AUTH_SCHEME} ${restApiKey}` },
  }
  const document = (
    await searchKakaoKeywordDocuments(
      buildKakaoComplexQuery(input),
      restApiKey,
      observer,
    )
  ).at(0) ?? null
  if (document === null) {
    return classifyKakaoComplexResult(input, null, null)
  }

  const regionUrl = new URL(EXTERNAL_API_URLS.kakaoCoordinateRegionCode)
  regionUrl.searchParams.set('x', String(document.lng))
  regionUrl.searchParams.set('y', String(document.lat))
  let actualLegalDongCode: string | null
  try {
    actualLegalDongCode = await fetchParsedJson(
      regionUrl,
      parseKakaoLegalDongCodeResponse,
      requestOptions,
      { observer },
    )
  } catch (error) {
    if (
      error instanceof HttpResponseError &&
      error.status === KAKAO_BAD_COORDINATE_STATUS
    ) {
      if (isKakaoQuotaExceeded(error)) throw error
      return pendingBackfillRecord(
        input,
        'notFound',
        KAKAO_BAD_COORDINATE_REASON,
      )
    }
    throw error
  }
  return classifyKakaoComplexResult(input, document, actualLegalDongCode)
}
