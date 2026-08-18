import type {
  ComprehensiveResidenceRecognitionRules,
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

/**
 * 종부세 거주기간 인정 특례 — tax-rules-spec.md §5.2-a,
 * 2026 세제개편안 상세본 문서 p91–92. '27.1.1. 성립분부터 적용한다.
 */
const COMPREHENSIVE_TAX_RESIDENCE_RECOGNITION_RULES_FROM_2027 = {
  minimumContinuousResidenceYears: 1,
  unavoidableRelocationMaximumYears: 3,
  medicalTreatmentMinimumYears: 1,
  directAncestorMinimumAge: 60,
  constructionRecognitionRate: 0.5,
  demolitionReferenceMonthsBefore: 6,
} as const satisfies ComprehensiveResidenceRecognitionRules

export const COMPREHENSIVE_TAX_CREDIT_RULES_2026 = {
  // 현행 종부세 세액공제 — v3.5 단독보유 시트 2026 열은 거주 여부를 요건으로 두지 않는다.
  requiresResidence: false,
  ageRates: COMPREHENSIVE_TAX_AGE_CREDIT_RATES,
  holdingPeriodRates: COMPREHENSIVE_TAX_HOLDING_CREDIT_RATES_2026,
  residencePeriodRates: NO_PERIOD_CREDIT_RATES,
  periodCreditKind: 'holding',
  maximumRate: COMPREHENSIVE_TAX_CREDIT_MAXIMUM_RATE,
  amountCap: null,
  residenceRecognition: null,
} as const satisfies ComprehensiveTaxCreditRules

/**
 * 종부세 2027년 세액공제 — tax-rules-spec.md §5.2, 개편안 p64.
 * 보유·거주 공제 중 큰 비율을 적용하고 금액은 800만원으로 제한한다. v3.5 엑셀
 * 단독보유 시트 K44가 비거주 1주택에 빈 셀인 것에 따라 거주를 요건으로 한다.
 */
export const COMPREHENSIVE_TAX_CREDIT_RULES_2027 = {
  requiresResidence: true,
  ageRates: COMPREHENSIVE_TAX_AGE_CREDIT_RATES,
  holdingPeriodRates: COMPREHENSIVE_TAX_HOLDING_CREDIT_RATES_2027,
  residencePeriodRates: COMPREHENSIVE_TAX_RESIDENCE_CREDIT_RATES_FROM_2027,
  periodCreditKind: 'maximum',
  maximumRate: COMPREHENSIVE_TAX_CREDIT_MAXIMUM_RATE,
  amountCap: 8_000_000,
  residenceRecognition:
    COMPREHENSIVE_TAX_RESIDENCE_RECOGNITION_RULES_FROM_2027,
} as const satisfies ComprehensiveTaxCreditRules

/**
 * 종부세 2028년 이후 세액공제 — 개편안 p64, v3.3 엑셀.
 * '28년 이후에는 거주공제만 적용한다. 보유공제는 후보에서 빠진다.
 * 금액 한도 600만원.
 */
export const COMPREHENSIVE_TAX_CREDIT_RULES_FROM_2028 = {
  requiresResidence: true,
  ageRates: COMPREHENSIVE_TAX_AGE_CREDIT_RATES,
  holdingPeriodRates: COMPREHENSIVE_TAX_HOLDING_CREDIT_RATES_2027,
  residencePeriodRates: COMPREHENSIVE_TAX_RESIDENCE_CREDIT_RATES_FROM_2027,
  periodCreditKind: 'residence',
  maximumRate: COMPREHENSIVE_TAX_CREDIT_MAXIMUM_RATE,
  amountCap: 6_000_000,
  residenceRecognition:
    COMPREHENSIVE_TAX_RESIDENCE_RECOGNITION_RULES_FROM_2027,
} as const satisfies ComprehensiveTaxCreditRules
