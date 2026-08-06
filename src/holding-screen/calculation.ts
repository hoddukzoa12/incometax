import type {
  HoldingTaxInput,
  HoldingTaxResult,
  PortfolioItem,
  PriorYearHoldingTax,
} from '../../shared/holding-tax'
import type { StoredPortfolioItem } from '../../shared/portfolio'
import { calculateHoldingTax } from '../holding/calc'
import type {
  ComprehensiveResidenceRecognitionInput,
} from '../../shared/comprehensive-residence-recognition'
import {
  HOLDING_TAX_COMPARISON_YEARS,
  HOLDING_TAX_PRIOR_PRICE_YEAR,
  holdingTaxAssessmentDate,
  type HoldingTaxComparisonYear,
} from './assessment-calendar'
import type {
  HoldingTaxConditionValues,
  HoldingTaxItemConditionValues,
} from './condition-values'

export {
  completedCalendarYears,
  HOLDING_TAX_COMPARISON_YEARS,
  HOLDING_TAX_FIRST_ASSESSMENT_DATE,
  HOLDING_TAX_PRIOR_PRICE_YEAR,
  holdingTaxAssessmentDate,
} from './assessment-calendar'

const ZERO_SHARE = 0
const ZERO_AMOUNT = 0
const FULL_OWNERSHIP_SHARE = 1

type HoldingTaxCalculator = typeof calculateHoldingTax

export type HoldingTaxYearCalculation = {
  readonly year: HoldingTaxComparisonYear
  readonly input: HoldingTaxInput
  readonly result: HoldingTaxResult
}

export type HoldingTaxMissingCondition = {
  readonly kind:
    | 'continuesResidence'
    | 'qualifyingRelocation'
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

export const getHoldingTaxMissingConditions = (
  items: readonly StoredPortfolioItem[],
  conditions: HoldingTaxConditionValues,
): readonly HoldingTaxMissingCondition[] => {
  const missing: HoldingTaxMissingCondition[] = []
  if (items.length === 0) return missing

  for (const item of items) {
    if (item.residency === null) missing.push({ kind: 'residency', item })
    const itemConditions = conditions.items[item.id]
    const continuesResidence = itemConditions?.continuesResidence ?? null
    const qualifyingRelocation = itemConditions?.qualifyingRelocation ?? null
    if (
      item.residency === 'residing' &&
      continuesResidence === null
    ) missing.push({ kind: 'continuesResidence', item })
    const residenceWillNotContinue =
      item.residency === 'nonResiding' ||
      continuesResidence === false
    if (
      residenceWillNotContinue &&
      qualifyingRelocation === null
    ) missing.push({ kind: 'qualifyingRelocation', item })
  }
  return missing
}

const toEngineItem = (
  item: StoredPortfolioItem,
  conditions: HoldingTaxItemConditionValues,
  elapsedComparisonYears: number,
): PortfolioItem => {
  if (
    item.officialPrice === null ||
    item.residency === null
  ) throw new TypeError('Portfolio item has incomplete tax conditions')

  return {
    assetKind: item.assetKind,
    officialPrice: item.officialPrice,
    ownershipShare: item.ownershipShare,
    isSoleHouseholdOwner:
      item.ownershipShare === FULL_OWNERSHIP_SHARE,
    residency: item.residency,
    areaKind: item.areaKind,
    holdingYears: conditions.holdingYears + elapsedComparisonYears,
    residenceYears: conditions.residenceYears +
      (conditions.continuesResidence === true
        ? elapsedComparisonYears
        : ZERO_AMOUNT),
  }
}

const createRecognitionInput = (
  item: StoredPortfolioItem,
  conditions: HoldingTaxItemConditionValues,
  year: HoldingTaxComparisonYear,
): ComprehensiveResidenceRecognitionInput | undefined => {
  if (
    item.residency === 'residing' &&
    conditions.continuesResidence !== false
  ) return undefined
  if (conditions.qualifyingRelocation !== true) return undefined

  const firstComparisonYear = HOLDING_TAX_COMPARISON_YEARS[0]
  const yearsSinceRelocation = Math.max(
    conditions.holdingYears - conditions.residenceYears,
    ZERO_AMOUNT,
  )
  const relocationYear = item.residency === 'residing'
    ? firstComparisonYear
    : firstComparisonYear - yearsSinceRelocation
  const continuousResidenceStartYear =
    relocationYear - conditions.residenceYears
  return {
    kind: 'unavoidableRelocation',
    continuousResidenceStartDate: holdingTaxAssessmentDate(
      continuousResidenceStartYear as HoldingTaxComparisonYear,
    ),
    relocationDate: holdingTaxAssessmentDate(
      relocationYear as HoldingTaxComparisonYear,
    ),
    recognitionEndDate: holdingTaxAssessmentDate(year),
    reason: { kind: 'similarUnavoidableReason' },
    destination: 'otherCityOrCounty',
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
  conditions: HoldingTaxConditionValues,
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
    conditions,
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
    const elapsedComparisonYears =
      year - HOLDING_TAX_COMPARISON_YEARS[0]
    const ownerAge = conditions.ownerAge + elapsedComparisonYears
    const items = taxedItems.map((item) => toEngineItem(
      item,
      conditions.items[item.id],
      elapsedComparisonYears,
    ))
    const priorYearTax = year === HOLDING_TAX_COMPARISON_YEARS[0]
      ? undefined
      : toPriorYearTax(calculations.at(-1)!.result)
    const input: HoldingTaxInput = {
      year,
      householdHomeCount,
      items,
      ownerAge,
      priorYearTax,
      comprehensiveResidenceRecognition:
        taxedItems.length === 1
          ? createRecognitionInput(
              taxedItems[0],
              conditions.items[taxedItems[0].id],
              year,
            )
          : undefined,
    }
    const result = year === HOLDING_TAX_COMPARISON_YEARS[0]
      ? (() => {
          const withoutCap = calculator(input)
          return calculator({
            ...input,
            priorYearTax: toPriorYearTax(withoutCap),
          })
        })()
      : calculator(input)
    calculations.push({ year, input, result })
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
