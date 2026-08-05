import type {
  OfficialPriceHistoryItem,
  OfficialPriceLookupResult,
  OfficialPriceNoDataReason,
} from '../../shared/official-price'
import {
  RealtySourceError,
  type RealtyRow,
} from './client'

const NORMALIZATION_PUNCTUATION_PATTERN = /[()（）[\]{}'".,·ㆍ]/g
const SOFT_HYPHEN_PATTERN = /\u00ad/g
const COMPLEX_LOT_PREFIX_PATTERN = /^\s*\(\s*\d+(?:-\d+)?\s*\)\s*/

export function text(value: unknown): string {
  return value == null
    ? ''
    : String(value).replace(SOFT_HYPHEN_PATTERN, '-').trim()
}

function number(value: unknown): number | null {
  const normalized = text(value).replace(/,/g, '').replace(/\s+/g, '')
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function won(value: unknown): number | null {
  const parsed = number(value)
  return parsed !== null && Number.isSafeInteger(parsed) ? parsed : null
}

function normalizeName(value: string): string {
  return value
    .replace(/\s+/g, '')
    .replace(NORMALIZATION_PUNCTUATION_PATTERN, '')
    .replace(/제/g, '')
    .toUpperCase()
}

function normalizeComplexName(value: string): string {
  return normalizeName(value.replace(COMPLEX_LOT_PREFIX_PATTERN, ''))
}

function normalizeUnit(value: string, suffix: '동' | '호'): string {
  return normalizeName(value.replace(new RegExp(`${suffix}$`), ''))
}

export type ComplexResolution =
  | { readonly status: 'found'; readonly row: RealtyRow }
  | { readonly status: 'notFound' }
  | { readonly status: 'ambiguous'; readonly candidates: readonly RealtyRow[] }

export function resolveComplex(
  rows: readonly RealtyRow[],
  complexName: string,
): ComplexResolution {
  if (rows.length === 0) return { status: 'notFound' }
  if (rows.length === 1) return { status: 'found', row: rows[0] }

  const target = normalizeComplexName(complexName)
  const matches = target ? rows.filter((row) => {
    const candidate = normalizeComplexName(text(row.name))
    return candidate.includes(target) || target.includes(candidate)
  }) : []
  return matches.length === 1
    ? { status: 'found', row: matches[0] }
    : { status: 'ambiguous', candidates: rows }
}

export function findUnit(
  rows: readonly RealtyRow[],
  unitName: string,
  suffix: '동' | '호',
): RealtyRow | null {
  const target = normalizeUnit(unitName, suffix)
  return rows.find((row) => normalizeUnit(text(row.name), suffix) === target) ?? null
}

export function requiredText(
  row: RealtyRow,
  field: string,
  label: string,
): string {
  const value = text(row[field])
  if (value) return value
  throw new RealtySourceError(
    'invalidResponse',
    `부동산공시가격알리미 ${label} 필드가 없습니다.`,
    false,
  )
}

export function validateOptionRows(
  rows: readonly RealtyRow[],
  label: string,
): void {
  for (const row of rows) {
    requiredText(row, 'code', `${label} code`)
    requiredText(row, 'name', `${label} name`)
  }
}

export function normalizeHistory(
  rows: readonly RealtyRow[],
  fields: {
    readonly date: string
    readonly price: string
    readonly area?: string
  },
): OfficialPriceHistoryItem[] {
  return rows
    .map((row) => {
      const baseDate = requiredText(row, fields.date, fields.date)
      const price = won(row[fields.price])
      if (price === null) {
        throw new RealtySourceError(
          'invalidResponse',
          `부동산공시가격알리미 ${fields.price} 필드가 올바르지 않습니다.`,
          false,
        )
      }
      return {
        baseDate,
        price,
        exclusiveArea: fields.area ? number(row[fields.area]) : null,
      }
    })
    .sort((left, right) => right.baseDate.localeCompare(left.baseDate))
}

export function noData(
  key: string,
  reason: OfficialPriceNoDataReason,
): OfficialPriceLookupResult {
  return { key, status: 'noData', reason }
}
