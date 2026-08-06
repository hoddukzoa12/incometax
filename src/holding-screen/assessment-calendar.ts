import type { TaxYear } from '../../shared/tax-rules'

export const HOLDING_TAX_COMPARISON_YEARS = [
  2026,
  2027,
  2028,
] as const satisfies readonly TaxYear[]

export type HoldingTaxComparisonYear =
  (typeof HOLDING_TAX_COMPARISON_YEARS)[number]

export const HOLDING_TAX_PRIOR_PRICE_YEAR = 2025

// Both holding taxes use June 1 as the annual assessment date.
const HOLDING_TAX_ASSESSMENT_MONTH = 6
const HOLDING_TAX_ASSESSMENT_DAY = 1
const ZERO_YEARS = 0

export const holdingTaxAssessmentDate = (
  year: HoldingTaxComparisonYear,
): string => `${year}-${String(HOLDING_TAX_ASSESSMENT_MONTH).padStart(2, '0')}-${String(HOLDING_TAX_ASSESSMENT_DAY).padStart(2, '0')}`

export const HOLDING_TAX_FIRST_ASSESSMENT_DATE = holdingTaxAssessmentDate(
  HOLDING_TAX_COMPARISON_YEARS[0],
)

const parseDateParts = (
  value: string,
): { readonly year: number; readonly month: number; readonly day: number } | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (match === null) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null
  return { year, month, day }
}

export const completedCalendarYears = (
  startDate: string,
  endDate: string,
): number | null => {
  const start = parseDateParts(startDate)
  const end = parseDateParts(endDate)
  if (start === null || end === null) return null
  const anniversaryReached =
    end.month > start.month ||
    (end.month === start.month && end.day >= start.day)
  const years = end.year - start.year - (anniversaryReached ? 0 : 1)
  return years >= ZERO_YEARS ? years : null
}
