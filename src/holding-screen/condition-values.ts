import type { StoredPortfolioItem } from '../../shared/portfolio'
import { TAX_RULES_BY_YEAR } from '../rules'
import {
  completedCalendarYears,
  HOLDING_TAX_COMPARISON_YEARS,
  HOLDING_TAX_FIRST_ASSESSMENT_DATE,
} from './assessment-calendar'

const ZERO_YEARS = 0
/*
 * 버전 2 까지는 공시가격 상승률 기본값이 0% 였다. 기본값만 15% 로 바꾸면
 * 이미 저장된 0% 가 계속 이겨서 바뀐 값이 아무에게도 닿지 않는다 —
 * 그래서 버전을 올려 그 시절 값을 새 기본값으로 갈아 끼운다.
 * 사용자가 직접 고른 상승률은 버전 3 부터 그대로 지킨다.
 */
const OFFICIAL_PRICE_GROWTH_DEFAULT_STORAGE_VERSIONS = [1, 2] as const
const STORAGE_VERSION = 3
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
 * 미래 공시가격 연 상승률 기본값은 15%다 — 시안 shell-v2.html 의 `buildSeries`
 * (`Math.pow(1.15, y - 2027)`) 와 같은 가정이다.
 *
 * 0% 는 "공시가격이 그대로다"라는 것도 하나의 예측이면서, 세부담상한이 한 번도
 * 걸리지 않아 추이 막대가 평평해진다 — 이 화면이 보여주려는 움직임이 안 보인다.
 * 상승률은 조건에서 바꿀 수 있고, 화면은 추정 구간을 빗금으로 구분해
 * 이 값이 고시가 아니라 가정임을 밝힌다.
 */
export const DEFAULT_ANNUAL_OFFICIAL_PRICE_GROWTH_RATE = 0.15
const MINIMUM_ANNUAL_OFFICIAL_PRICE_GROWTH_RATE = -1
const PERCENT_RATE_FACTOR = 100
const OFFICIAL_PRICE_GROWTH_PERCENT_STEP = 0.1

export const annualOfficialPriceGrowthPercent = {
  minimum: MINIMUM_ANNUAL_OFFICIAL_PRICE_GROWTH_RATE * PERCENT_RATE_FACTOR,
  step: OFFICIAL_PRICE_GROWTH_PERCENT_STEP,
  fromRate: (rate: number): number => rate * PERCENT_RATE_FACTOR,
} as const

export const annualOfficialPriceGrowthRateFromPercent = (
  value: string,
): number => {
  const percent = Number(value)
  if (!Number.isFinite(percent)) {
    return DEFAULT_ANNUAL_OFFICIAL_PRICE_GROWTH_RATE
  }
  return Math.max(
    percent / PERCENT_RATE_FACTOR,
    MINIMUM_ANNUAL_OFFICIAL_PRICE_GROWTH_RATE,
  )
}

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

export const hasExactOwnerAge = (
  year: number,
  ownerAge: number,
): boolean => getOwnerAgeKnowledge(year, ownerAge).kind === 'exact'

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
  const migratesGrowthRate =
    OFFICIAL_PRICE_GROWTH_DEFAULT_STORAGE_VERSIONS.some(
      (legacy) => legacy === version,
    )
  if (!migratesGrowthRate && version !== STORAGE_VERSION) return null
  const annualOfficialPriceGrowthRate = migratesGrowthRate
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
