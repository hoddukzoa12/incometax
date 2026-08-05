import type {
  ComprehensiveTaxCreditRules,
  MinimumRateBand,
} from '../../shared/tax-rules'
import { RATE_DENOMINATOR } from './rate'

/**
 * 종부세 1세대1주택 연령공제 — tax-rules-spec.md §5.2, 개편안 p64.
 * 연령공제는 개편 전후 동일하다.
 */
const COMPREHENSIVE_TAX_AGE_CREDIT_RATES = [
  { minimum: 60, rate: 2_000 / RATE_DENOMINATOR },
  { minimum: 65, rate: 3_000 / RATE_DENOMINATOR },
  { minimum: 70, rate: 4_000 / RATE_DENOMINATOR },
] as const satisfies readonly MinimumRateBand[]

/** 종부세 현행 장기보유공제 — tax-rules-spec.md §5.2, 개편안 p64. */
const COMPREHENSIVE_TAX_HOLDING_CREDIT_RATES_2026 = [
  { minimum: 5, rate: 2_000 / RATE_DENOMINATOR },
  { minimum: 10, rate: 4_000 / RATE_DENOMINATOR },
  { minimum: 15, rate: 5_000 / RATE_DENOMINATOR },
] as const satisfies readonly MinimumRateBand[]

/** 종부세 개정 장기보유공제 — tax-rules-spec.md §5.2, 개편안 p64. */
const COMPREHENSIVE_TAX_HOLDING_CREDIT_RATES_2027 = [
  { minimum: 5, rate: 1_000 / RATE_DENOMINATOR },
  { minimum: 10, rate: 2_000 / RATE_DENOMINATOR },
  { minimum: 15, rate: 2_500 / RATE_DENOMINATOR },
] as const satisfies readonly MinimumRateBand[]

/** 종부세 개정 거주공제 — tax-rules-spec.md §5.2, 개편안 p64. */
const COMPREHENSIVE_TAX_RESIDENCE_CREDIT_RATES_FROM_2027 = [
  { minimum: 5, rate: 2_000 / RATE_DENOMINATOR },
  { minimum: 10, rate: 4_000 / RATE_DENOMINATOR },
  { minimum: 15, rate: 5_000 / RATE_DENOMINATOR },
] as const satisfies readonly MinimumRateBand[]

const NO_PERIOD_CREDIT_RATES = [] as const

/** 종부세 세액공제 합산율 상한 — tax-rules-spec.md §5.2, 개편안 p64. */
const COMPREHENSIVE_TAX_CREDIT_MAXIMUM_RATE =
  8_000 / RATE_DENOMINATOR

export const COMPREHENSIVE_TAX_CREDIT_RULES_2026 = {
  ageRates: COMPREHENSIVE_TAX_AGE_CREDIT_RATES,
  holdingPeriodRates: COMPREHENSIVE_TAX_HOLDING_CREDIT_RATES_2026,
  residencePeriodRates: NO_PERIOD_CREDIT_RATES,
  periodCreditKind: 'holding',
  maximumRate: COMPREHENSIVE_TAX_CREDIT_MAXIMUM_RATE,
  amountCap: null,
} as const satisfies ComprehensiveTaxCreditRules

/**
 * 종부세 2027년 세액공제 — tax-rules-spec.md §5.2, 개편안 p64.
 * 보유·거주 공제 중 큰 비율을 적용하고 금액은 800만원으로 제한한다.
 */
export const COMPREHENSIVE_TAX_CREDIT_RULES_2027 = {
  ageRates: COMPREHENSIVE_TAX_AGE_CREDIT_RATES,
  holdingPeriodRates: COMPREHENSIVE_TAX_HOLDING_CREDIT_RATES_2027,
  residencePeriodRates: COMPREHENSIVE_TAX_RESIDENCE_CREDIT_RATES_FROM_2027,
  periodCreditKind: 'maximum',
  maximumRate: COMPREHENSIVE_TAX_CREDIT_MAXIMUM_RATE,
  amountCap: 8_000_000,
} as const satisfies ComprehensiveTaxCreditRules

/**
 * 종부세 2028년 이후 세액공제 — tax-rules-spec.md §5.2, 개편안 p64.
 * 거주공제만 적용하고 금액은 600만원으로 제한한다.
 */
export const COMPREHENSIVE_TAX_CREDIT_RULES_FROM_2028 = {
  ageRates: COMPREHENSIVE_TAX_AGE_CREDIT_RATES,
  holdingPeriodRates: NO_PERIOD_CREDIT_RATES,
  residencePeriodRates: COMPREHENSIVE_TAX_RESIDENCE_CREDIT_RATES_FROM_2027,
  periodCreditKind: 'residence',
  maximumRate: COMPREHENSIVE_TAX_CREDIT_MAXIMUM_RATE,
  amountCap: 6_000_000,
} as const satisfies ComprehensiveTaxCreditRules
