import {
  KAPT_SUCCESS_RESULT_CODE,
  requireKaptResponse,
  requireRecord,
  requireString,
} from './complex-source.ts'

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

const optionalString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null

const nonNegativeInteger = (value: unknown, path: string): number => {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new TypeError(`Expected non-negative integer at ${path}`)
  }
  return parsed
}

const legalDongCode = (value: unknown): string => {
  const code = requireString(value, 'response.body.item.bjdCode').trim()
  if (!/^\d{10}$/.test(code)) {
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

export const normalizeKaptBasisResponse = (payload: unknown): ComplexDraft => {
  const response = requireKaptResponse(payload)
  const header = requireRecord(response.header, 'response.header')
  if (header.resultCode !== KAPT_SUCCESS_RESULT_CODE) {
    throw new Error(
      `K-apt basis API failed: ${String(header.resultCode)} ${String(header.resultMsg)}`,
    )
  }

  const body = requireRecord(response.body, 'response.body')
  const item = requireRecord(body.item, 'response.body.item')

  return {
    complexId: requireString(item.kaptCode, 'response.body.item.kaptCode').trim(),
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
