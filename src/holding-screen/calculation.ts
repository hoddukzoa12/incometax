import type {
  HoldingTaxInput,
  HoldingTaxResult,
  PortfolioItem,
  PriorYearHoldingTax,
} from '../../shared/holding-tax'
import type { StoredPortfolioItem } from '../../shared/portfolio'
import type { TaxYear } from '../../shared/tax-rules'
import { calculateHoldingTax } from '../holding/calc'

export const HOLDING_TAX_COMPARISON_YEARS = [
  2026,
  2027,
  2028,
] as const satisfies readonly TaxYear[]

export const HOLDING_TAX_PRIOR_PRICE_YEAR = 2025
// Both holding taxes use June 1 as the annual assessment date.
const HOLDING_TAX_ASSESSMENT_MONTH = 6
const HOLDING_TAX_ASSESSMENT_DAY = 1

export const holdingTaxAssessmentDate = (
  year: HoldingTaxComparisonYear,
): string => `${year}-${String(HOLDING_TAX_ASSESSMENT_MONTH).padStart(2, '0')}-${String(HOLDING_TAX_ASSESSMENT_DAY).padStart(2, '0')}`

export const HOLDING_TAX_FIRST_ASSESSMENT_DATE = holdingTaxAssessmentDate(
  HOLDING_TAX_COMPARISON_YEARS[0],
)

type HoldingTaxComparisonYear =
  (typeof HOLDING_TAX_COMPARISON_YEARS)[number]

const ZERO_SHARE = 0
const ZERO_AMOUNT = 0
const FULL_OWNERSHIP_SHARE = 1

type HoldingTaxCalculator = typeof calculateHoldingTax

export type HoldingTaxYearCalculation = {
  readonly year: HoldingTaxComparisonYear
  readonly input: HoldingTaxInput
  readonly result: HoldingTaxResult
}

export type HoldingTaxMissingCondition =
  | { readonly kind: 'birthDate' }
  | {
      readonly kind:
        | 'acquisitionDate'
        | 'coOwnerHousehold'
        | 'residenceYears'
        | 'residency'
      readonly item: StoredPortfolioItem
    }

export type HoldingTaxComparison =
  | {
      readonly status: 'empty' | 'noTaxedItems'
    }
  | {
      readonly status: 'missingOfficialPrices'
      readonly missingItems: readonly StoredPortfolioItem[]
    }
  | {
      readonly status: 'missingConditions'
      readonly missingConditions: readonly HoldingTaxMissingCondition[]
    }
  | {
      readonly status: 'calculated'
      readonly householdHomeCount: number
      readonly taxedItems: readonly StoredPortfolioItem[]
      readonly ownerAgeByYear: Readonly<Record<HoldingTaxComparisonYear, number>>
      readonly holdingYearsByItemAndYear: Readonly<
        Record<
          HoldingTaxComparisonYear,
          Readonly<Record<string, number>>
        >
      >
      readonly calculations: readonly HoldingTaxYearCalculation[]
      readonly missingPriorPriceItems: readonly StoredPortfolioItem[]
    }

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
  return years >= ZERO_AMOUNT ? years : null
}

export const getHoldingTaxMissingConditions = (
  items: readonly StoredPortfolioItem[],
  birthDate: string | null,
): readonly HoldingTaxMissingCondition[] => {
  const missing: HoldingTaxMissingCondition[] = []
  if (items.length === 0) return missing
  if (
    birthDate === null ||
    completedCalendarYears(
      birthDate,
      HOLDING_TAX_FIRST_ASSESSMENT_DATE,
    ) === null
  ) missing.push({ kind: 'birthDate' })

  for (const item of items) {
    if (
      item.acquisitionDate === null ||
      completedCalendarYears(
        item.acquisitionDate,
        HOLDING_TAX_FIRST_ASSESSMENT_DATE,
      ) === null
    ) missing.push({ kind: 'acquisitionDate', item })
    if (item.residenceYears === null) {
      missing.push({ kind: 'residenceYears', item })
    }
    if (item.residency === null) missing.push({ kind: 'residency', item })
    if (
      item.ownershipShare < FULL_OWNERSHIP_SHARE &&
      item.isSoleHouseholdOwner === null
    ) missing.push({ kind: 'coOwnerHousehold', item })
  }
  return missing
}

const toEngineItem = (
  item: StoredPortfolioItem,
  referenceDate: string,
): PortfolioItem => {
  const holdingYears = item.acquisitionDate === null
    ? null
    : completedCalendarYears(item.acquisitionDate, referenceDate)
  if (
    item.officialPrice === null ||
    item.residency === null ||
    item.residenceYears === null ||
    holdingYears === null
  ) throw new TypeError('Portfolio item has incomplete tax conditions')

  const isSoleHouseholdOwner = item.ownershipShare === FULL_OWNERSHIP_SHARE
    ? true
    : item.isSoleHouseholdOwner
  if (isSoleHouseholdOwner === null) {
    throw new TypeError('Portfolio item has no co-owner household answer')
  }

  return {
    assetKind: item.assetKind,
    officialPrice: item.officialPrice,
    ownershipShare: item.ownershipShare,
    isSoleHouseholdOwner,
    residency: item.residency,
    areaKind: item.areaKind,
    holdingYears,
    residenceYears: item.residenceYears,
  }
}

const toPriorYearTax = (
  result: HoldingTaxResult,
): PriorYearHoldingTax => {
  return {
    propertyBaseTax: result.propertyTaxes.reduce(
      (total, propertyTax) => total + propertyTax.baseTax,
      ZERO_AMOUNT,
    ),
    comprehensiveCalculatedTax: result.comprehensiveTax.netTax,
  }
}

const hasPriorOfficialPrice = (item: StoredPortfolioItem): boolean =>
  item.priorOfficialPrices.some(({ baseDate }) =>
    Number(baseDate.slice(0, 4)) === HOLDING_TAX_PRIOR_PRICE_YEAR)

export const calculatePortfolioHoldingTax = (
  storedItems: readonly StoredPortfolioItem[],
  birthDate: string | null,
  calculator: HoldingTaxCalculator = calculateHoldingTax,
): HoldingTaxComparison => {
  if (storedItems.length === 0) return { status: 'empty' }

  const taxedItems = storedItems.filter(
    ({ ownershipShare }) => ownershipShare > ZERO_SHARE,
  )
  if (taxedItems.length === 0) return { status: 'noTaxedItems' }

  const missingItems = taxedItems.filter(
    ({ officialPrice }) => officialPrice === null,
  )
  if (missingItems.length > 0) {
    return { status: 'missingOfficialPrices', missingItems }
  }

  const missingConditions = getHoldingTaxMissingConditions(
    taxedItems,
    birthDate,
  )
  if (missingConditions.length > 0) {
    return { status: 'missingConditions', missingConditions }
  }

  const householdHomeCount = storedItems.length
  const calculations: HoldingTaxYearCalculation[] = []
  const ownerAgeEntries: [HoldingTaxComparisonYear, number][] = []
  const holdingYearEntries: [
    HoldingTaxComparisonYear,
    Readonly<Record<string, number>>,
  ][] = []
  for (const year of HOLDING_TAX_COMPARISON_YEARS) {
    const referenceDate = holdingTaxAssessmentDate(year)
    const ownerAge = completedCalendarYears(birthDate!, referenceDate)!
    const items = taxedItems.map((item) => toEngineItem(item, referenceDate))
    const priorYearTax = year === HOLDING_TAX_COMPARISON_YEARS[0]
      ? undefined
      : toPriorYearTax(calculations.at(-1)!.result)
    const input: HoldingTaxInput = {
      year,
      householdHomeCount,
      items,
      ownerAge,
      priorYearTax,
    }
    calculations.push({ year, input, result: calculator(input) })
    ownerAgeEntries.push([year, ownerAge])
    holdingYearEntries.push([
      year,
      Object.fromEntries(
        taxedItems.map((item, itemIndex) => [
          item.id,
          items[itemIndex].holdingYears,
        ]),
      ),
    ])
  }

  return {
    status: 'calculated',
    householdHomeCount,
    taxedItems,
    ownerAgeByYear: Object.fromEntries(ownerAgeEntries) as Readonly<
      Record<HoldingTaxComparisonYear, number>
    >,
    holdingYearsByItemAndYear: Object.fromEntries(holdingYearEntries) as Readonly<
      Record<
        HoldingTaxComparisonYear,
        Readonly<Record<string, number>>
      >
    >,
    calculations,
    missingPriorPriceItems: taxedItems.filter(
      (item) => !hasPriorOfficialPrice(item),
    ),
  }
}
