import type {
  HoldingTaxInput,
  HoldingTaxResult,
  PortfolioItem,
  PriorYearHoldingTax,
} from '../../shared/holding-tax'
import type { StoredPortfolioItem } from '../../shared/portfolio'
import { calculateHoldingTax } from '../holding/calc'
import { roundTaxAmount } from '../rules'
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
const ONE_YEAR = 1

type HoldingTaxCalculator = typeof calculateHoldingTax

export type HoldingTaxYearCalculation = {
  readonly year: HoldingTaxComparisonYear
  readonly input: HoldingTaxInput
  readonly result: HoldingTaxResult
}

/** 고시 공시가격으로 계산한 직전 연도. 추정 연도와 구분해서 다룬다. */
export type HoldingTaxPriorYearCalculation = {
  readonly year: typeof HOLDING_TAX_PRIOR_PRICE_YEAR
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
      /** 고시 공시가격이 없으면 계산할 수 없다. 추이 막대에서 빠진다. */
      readonly priorYearCalculation: HoldingTaxPriorYearCalculation | undefined
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
  officialPrice: number,
  priorOfficialPrice?: number,
): PortfolioItem => {
  if (
    item.officialPrice === null ||
    item.residency === null
  ) throw new TypeError('Portfolio item has incomplete tax conditions')

  return {
    assetKind: item.assetKind,
    officialPrice,
    priorOfficialPrice,
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

const projectedOfficialPrice = (
  currentOfficialPrice: number,
  elapsedComparisonYears: number,
  annualGrowthRate: number,
): number => roundTaxAmount(
  currentOfficialPrice *
    (ONE_YEAR + annualGrowthRate) ** elapsedComparisonYears,
)

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
    comprehensiveTax: result.comprehensiveTax.payableTax ?? undefined,
  }
}

const priorOfficialPrice = (
  item: StoredPortfolioItem,
): number | null => item.priorOfficialPrices.find(({ baseDate }) =>
  Number(baseDate.slice(0, 4)) === HOLDING_TAX_PRIOR_PRICE_YEAR)?.price ?? null

/**
 * 직전 연도는 추정이 아니라 고시된 공시가격으로 실제 계산한다.
 * 세부담상한의 기준액이면서, 추이 막대의 맨 왼쪽 칸이기도 하다 —
 * 그래서 요약값만 내보내지 않고 계산 결과를 통째로 돌려준다.
 */
const calculateObservedPriorYear = (
  taxedItems: readonly StoredPortfolioItem[],
  conditions: HoldingTaxConditionValues,
  householdHomeCount: number,
  calculator: HoldingTaxCalculator,
): HoldingTaxPriorYearCalculation | undefined => {
  const prices = taxedItems.map(priorOfficialPrice)
  if (prices.some((price) => price === null)) return undefined

  const input: HoldingTaxInput = {
    year: HOLDING_TAX_PRIOR_PRICE_YEAR,
    householdHomeCount,
    items: taxedItems.map((item, itemIndex) => toEngineItem(
      item,
      conditions.items[item.id],
      ZERO_AMOUNT,
      prices[itemIndex]!,
    )),
    ownerAge: Math.max(ZERO_AMOUNT, conditions.ownerAge - ONE_YEAR),
  }
  return {
    year: HOLDING_TAX_PRIOR_PRICE_YEAR,
    input,
    result: calculator(input),
  }
}

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
  const missingPriorPriceItems = taxedItems.filter(
    (item) => priorOfficialPrice(item) === null,
  )
  const priorYearCalculation = calculateObservedPriorYear(
    taxedItems,
    conditions,
    householdHomeCount,
    calculator,
  )
  const observedPriorYearTax = priorYearCalculation === undefined
    ? undefined
    : toPriorYearTax(priorYearCalculation.result)
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
    const items = taxedItems.map((item) => {
      const officialPrice = projectedOfficialPrice(
        item.officialPrice!,
        elapsedComparisonYears,
        conditions.annualOfficialPriceGrowthRate,
      )
      const previousOfficialPrice = elapsedComparisonYears === ZERO_AMOUNT
        ? priorOfficialPrice(item) ?? undefined
        : projectedOfficialPrice(
            item.officialPrice!,
            elapsedComparisonYears - ONE_YEAR,
            conditions.annualOfficialPriceGrowthRate,
          )
      return toEngineItem(
        item,
        conditions.items[item.id],
        elapsedComparisonYears,
        officialPrice,
        previousOfficialPrice,
      )
    })
    const priorYearTax = year === HOLDING_TAX_COMPARISON_YEARS[0]
      ? observedPriorYearTax
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
    const result = calculator(input)
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
    priorYearCalculation,
    missingPriorPriceItems,
  }
}
