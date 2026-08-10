import {
  KAPT_SUCCESS_RESULT_CODE,
  requireKaptResponse,
  requireRecord,
  requireString,
} from './complex-source.ts'
import { isLegalDongCode } from '../../shared/legal-dong.ts'
import { NonRetryableRequestError } from './http.ts'

export interface ComplexDraft {
  readonly complexId: string
  readonly name: string
  readonly legalAddress: string
  readonly roadAddress: string | null
  readonly legalDongCode: string
  readonly approvalDate: string | null
  readonly buildingCount: number
  readonly householdCount: number
}

export class UnusableKaptBasisError extends NonRetryableRequestError {
  readonly fields: readonly string[]

  constructor(fields: readonly string[]) {
    super(`K-apt basis required fields are empty: ${fields.join(', ')}`)
    this.name = 'UnusableKaptBasisError'
    this.fields = fields
  }
}

export class KaptBasisNotFoundError extends NonRetryableRequestError {
  constructor(message: string) {
    super(message)
    this.name = 'KaptBasisNotFoundError'
  }
}

const KAPT_NO_DATA_RESULT_CODES = new Set(['03'])

const isNoDataResult = (code: unknown, message: unknown): boolean =>
  KAPT_NO_DATA_RESULT_CODES.has(String(code)) ||
  /NO_DATA|NODATA|데이터.*없/i.test(String(message))

const optionalString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null

const nonNegativeInteger = (value: unknown, path: string): number => {
  if (value === null || value === undefined || value === '') {
    throw new TypeError(`Expected non-negative integer at ${path}`)
  }
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new TypeError(`Expected non-negative integer at ${path}`)
  }
  return parsed
}

const legalDongCode = (value: unknown): string => {
  const code = requireString(value, 'response.body.item.bjdCode').trim()
  if (!isLegalDongCode(code)) {
    throw new TypeError('Expected 10-digit legal dong code')
  }
  return code
}

const approvalDate = (value: unknown): string | null => {
  const raw = optionalString(value)
  if (raw === null) return null

  const digits = raw.replaceAll('-', '')
  if (!/^\d{8}$/.test(digits)) {
    throw new TypeError('Expected approval date in YYYYMMDD format')
  }
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
}

export const normalizeKaptBasisResponse = (
  payload: unknown,
  requestedComplexId?: string,
): ComplexDraft => {
  const response = requireKaptResponse(payload)
  const header = requireRecord(response.header, 'response.header')
  if (header.resultCode !== KAPT_SUCCESS_RESULT_CODE) {
    if (isNoDataResult(header.resultCode, header.resultMsg)) {
      throw new KaptBasisNotFoundError(
        `K-apt basis has no detail: ${String(header.resultCode)} ${String(header.resultMsg)}`,
      )
    }
    throw new Error(
      `K-apt basis API failed: ${String(header.resultCode)} ${String(header.resultMsg)}`,
    )
  }

  const body = requireRecord(response.body, 'response.body')
  if (body.item === null || body.item === undefined) {
    throw new KaptBasisNotFoundError('K-apt basis has no detail item')
  }
  const item = requireRecord(body.item, 'response.body.item')
  const responseCodeMissing =
    item.kaptCode === null ||
    item.kaptCode === undefined ||
    (typeof item.kaptCode === 'string' && item.kaptCode.trim() === '')
  // 2026-08-04 실측에서 정상(00) 상세 응답 일부가 kaptCode만 빈 문자열로
  // 반환했다. 목록에서 검증되어 요청 키로 사용된 코드를 그 경우에만 보완한다.
  const complexIdValue = responseCodeMissing
    ? requestedComplexId
    : item.kaptCode
  const requiredFieldValues = {
    kaptCode: complexIdValue,
    kaptName: item.kaptName,
    kaptAddr: item.kaptAddr,
    bjdCode: item.bjdCode,
    kaptDongCnt: item.kaptDongCnt,
    kaptdaCnt: item.kaptdaCnt,
  }
  const unusableFields = Object.entries(requiredFieldValues)
    .filter(
      ([, value]) =>
        value === null ||
        value === undefined ||
        (typeof value === 'string' && value.trim() === ''),
    )
    .map(([field]) => field)
  if (unusableFields.length > 0) {
    throw new UnusableKaptBasisError(unusableFields)
  }

  return {
    complexId: requireString(
      complexIdValue,
      'response.body.item.kaptCode',
    ).trim(),
    name: requireString(item.kaptName, 'response.body.item.kaptName').trim(),
    legalAddress: requireString(
      item.kaptAddr,
      'response.body.item.kaptAddr',
    ).trim(),
    roadAddress: optionalString(item.doroJuso),
    legalDongCode: legalDongCode(item.bjdCode),
    approvalDate: approvalDate(item.kaptUsedate),
    buildingCount: nonNegativeInteger(
      item.kaptDongCnt,
      'response.body.item.kaptDongCnt',
    ),
    householdCount: nonNegativeInteger(
      item.kaptdaCnt,
      'response.body.item.kaptdaCnt',
    ),
  }
}
