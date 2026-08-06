import type { StoredPortfolioItem } from '../../shared/portfolio'
import { TAX_RULES_BY_YEAR } from '../rules'
import {
  completedCalendarYears,
  HOLDING_TAX_COMPARISON_YEARS,
  HOLDING_TAX_FIRST_ASSESSMENT_DATE,
} from './assessment-calendar'

const ZERO_YEARS = 0
const LEGACY_STORAGE_VERSION = 1
const STORAGE_VERSION = 2
const ISO_YEAR_END_INDEX = 4
const HOLDING_TAX_CONDITIONS_STORAGE_KEY =
  'incometax.holdingTax.conditions'
const LEGACY_OWNER_BIRTH_DATE_STORAGE_KEY =
  'incometax.holdingTax.ownerBirthDate'
const FIRST_ASSESSMENT_YEAR = Number(
  HOLDING_TAX_FIRST_ASSESSMENT_DATE.slice(0, ISO_YEAR_END_INDEX),
)
const MAXIMUM_IMPLICIT_PERIOD_YEARS =
  HOLDING_TAX_COMPARISON_YEARS[HOLDING_TAX_COMPARISON_YEARS.length - 1] -
  FIRST_ASSESSMENT_YEAR

/**
 * 미래 공시가격 연 상승률 기본값은 0%다.
 * (a) 이 비교의 질문인 세법 개편 효과에 공시가격 변동 효과를 섞지 않고,
 * (b) 근거 없는 공시가격 예측값을 서비스가 제시하지 않기 위해서다
 * (docs/ux-writing-guide.md §0의 근거 없는 평균 환급액 사례 참조).
 */
export const DEFAULT_ANNUAL_OFFICIAL_PRICE_GROWTH_RATE = 0
const MINIMUM_ANNUAL_OFFICIAL_PRICE_GROWTH_RATE = -1

const currentCreditRules =
  TAX_RULES_BY_YEAR[2026].comprehensiveTax.taxCredit
const reformCreditRules =
  TAX_RULES_BY_YEAR[2027].comprehensiveTax.taxCredit

export const MINIMUM_AGE_CREDIT_YEARS =
  currentCreditRules.ageRates[0].minimum
export const MINIMUM_HOLDING_CREDIT_YEARS =
  currentCreditRules.holdingPeriodRates[0].minimum
export const MINIMUM_RESIDENCE_CREDIT_YEARS =
  reformCreditRules.residencePeriodRates[0].minimum

export const getOwnerAgeKnowledge = (
  year: number,
  ownerAge: number,
) => {
  const elapsedYears = year - FIRST_ASSESSMENT_YEAR
  const initialOwnerAge = ownerAge - elapsedYears
  const thresholdForYear = MINIMUM_AGE_CREDIT_YEARS + elapsedYears

  if (initialOwnerAge === ZERO_YEARS) {
    return { kind: 'youngerThan', years: thresholdForYear } as const
  }
  if (initialOwnerAge === MINIMUM_AGE_CREDIT_YEARS) {
    return { kind: 'atLeast', years: thresholdForYear } as const
  }
  return { kind: 'exact', years: ownerAge } as const
}

export const getKnownPeriodMinimumYears = (years: number): number | null =>
  years <= MAXIMUM_IMPLICIT_PERIOD_YEARS ? null : years

export interface HoldingTaxItemConditionValues {
  readonly holdingYears: number
  readonly residenceYears: number
  readonly continuesResidence: boolean | null
  readonly qualifyingRelocation: boolean | null
}

export interface HoldingTaxConditionValues {
  readonly ownerAge: number
  readonly annualOfficialPriceGrowthRate: number
  readonly items: Readonly<Record<string, HoldingTaxItemConditionValues>>
}

interface PersistedHoldingTaxConditionValues
  extends HoldingTaxConditionValues {
  readonly version: typeof STORAGE_VERSION
}

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isSafeInteger(value) &&
  value >= ZERO_YEARS

const isNullableBoolean = (value: unknown): value is boolean | null =>
  value === null || typeof value === 'boolean'

const isAnnualOfficialPriceGrowthRate = (
  value: unknown,
): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= MINIMUM_ANNUAL_OFFICIAL_PRICE_GROWTH_RATE

const readItemCondition = (
  value: unknown,
): HoldingTaxItemConditionValues | null => {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  if (
    !isNonNegativeInteger(record.holdingYears) ||
    !isNonNegativeInteger(record.residenceYears) ||
    !isNullableBoolean(record.continuesResidence) ||
    !isNullableBoolean(record.qualifyingRelocation)
  ) return null
  return {
    holdingYears: record.holdingYears,
    residenceYears: record.residenceYears,
    continuesResidence: record.continuesResidence,
    qualifyingRelocation: record.qualifyingRelocation,
  }
}

const readStoredConditions = (
  serialized: string | null,
): HoldingTaxConditionValues | null => {
  if (serialized === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const record = parsed as Record<string, unknown>
  const version = record.version
  if (
    version !== LEGACY_STORAGE_VERSION &&
    version !== STORAGE_VERSION
  ) return null
  const annualOfficialPriceGrowthRate =
    version === LEGACY_STORAGE_VERSION
      ? DEFAULT_ANNUAL_OFFICIAL_PRICE_GROWTH_RATE
      : record.annualOfficialPriceGrowthRate
  if (
    !isNonNegativeInteger(record.ownerAge) ||
    !isAnnualOfficialPriceGrowthRate(annualOfficialPriceGrowthRate) ||
    typeof record.items !== 'object' ||
    record.items === null
  ) return null

  const entries = Object.entries(record.items).map(([itemId, value]) => {
    const item = readItemCondition(value)
    return item === null ? null : [itemId, item] as const
  })
  if (entries.some((entry) => entry === null)) return null
  return {
    ownerAge: record.ownerAge,
    annualOfficialPriceGrowthRate,
    items: Object.fromEntries(entries as readonly (readonly [
      string,
      HoldingTaxItemConditionValues,
    ])[]),
  }
}

const legacyOwnerAge = (storage: Storage): number => {
  let birthDate: string | null
  try {
    birthDate = storage.getItem(LEGACY_OWNER_BIRTH_DATE_STORAGE_KEY)
  } catch {
    return ZERO_YEARS
  }
  if (birthDate === null) return ZERO_YEARS
  return completedCalendarYears(
    birthDate,
    HOLDING_TAX_FIRST_ASSESSMENT_DATE,
  ) ?? ZERO_YEARS
}

const initialItemCondition = (
  item: StoredPortfolioItem,
): HoldingTaxItemConditionValues => ({
  holdingYears: item.acquisitionDate === null
    ? ZERO_YEARS
    : completedCalendarYears(
        item.acquisitionDate,
        HOLDING_TAX_FIRST_ASSESSMENT_DATE,
      ) ?? ZERO_YEARS,
  residenceYears: item.residenceYears ?? ZERO_YEARS,
  continuesResidence: null,
  qualifyingRelocation: null,
})

export const mergeHoldingTaxConditionItems = (
  conditions: HoldingTaxConditionValues,
  items: readonly StoredPortfolioItem[],
): HoldingTaxConditionValues => ({
  ...conditions,
  items: Object.fromEntries(items.map((item) => [
    item.id,
    conditions.items[item.id] ?? initialItemCondition(item),
  ])),
})

export const restoreHoldingTaxConditionValues = (
  items: readonly StoredPortfolioItem[],
  storage: Storage = window.localStorage,
): HoldingTaxConditionValues => {
  let restored: HoldingTaxConditionValues | null = null
  try {
    restored = readStoredConditions(
      storage.getItem(HOLDING_TAX_CONDITIONS_STORAGE_KEY),
    )
  } catch {
    // The defaults below keep this session usable without localStorage.
  }
  return mergeHoldingTaxConditionItems(
    restored ?? {
      ownerAge: legacyOwnerAge(storage),
      annualOfficialPriceGrowthRate:
        DEFAULT_ANNUAL_OFFICIAL_PRICE_GROWTH_RATE,
      items: {},
    },
    items,
  )
}

export const persistHoldingTaxConditionValues = (
  conditions: HoldingTaxConditionValues,
  storage: Storage = window.localStorage,
): void => {
  const persisted: PersistedHoldingTaxConditionValues = {
    version: STORAGE_VERSION,
    ...conditions,
  }
  storage.setItem(
    HOLDING_TAX_CONDITIONS_STORAGE_KEY,
    JSON.stringify(persisted),
  )
}
