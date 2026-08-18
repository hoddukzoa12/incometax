import type {
  ComprehensiveBasicDeductionRules,
  ComprehensiveFairMarketValueRatioRules,
} from '../../shared/tax-rules'
import { RATE_DENOMINATOR } from './rate'

/**
 * 종부세 과세대상 기준 — tax-rules-spec.md §3.1, 개편안 p60.
 * 2026년은 현행 기준이고 2027년 기준은 이후 연도에도 적용된다.
 */
const COMPREHENSIVE_MULTI_HOUSE_TAXABLE_THRESHOLD = 900_000_000

export const COMPREHENSIVE_TAXABLE_THRESHOLDS_2026 = {
  oneHouse: 1_200_000_000,
  multiHouse: COMPREHENSIVE_MULTI_HOUSE_TAXABLE_THRESHOLD,
} as const

export const COMPREHENSIVE_TAXABLE_THRESHOLDS_FROM_2027 = {
  oneHouse: 1_400_000_000,
  multiHouse: COMPREHENSIVE_MULTI_HOUSE_TAXABLE_THRESHOLD,
} as const

/**
 * 종부세 기본공제 — tax-rules-spec.md §3.2, 개편안 p61.
 * 2026년은 현행 기준이고 2027년 기준은 이후 연도에도 적용된다.
 */
const COMPREHENSIVE_ONE_HOUSE_BASIC_DEDUCTION_2026 = 1_200_000_000

export const COMPREHENSIVE_BASIC_DEDUCTIONS_2026 = {
  oneHouse: {
    residing: COMPREHENSIVE_ONE_HOUSE_BASIC_DEDUCTION_2026,
    nonResiding: COMPREHENSIVE_ONE_HOUSE_BASIC_DEDUCTION_2026,
  },
  multiHouse: {
    kind: 'fixed',
    amount: 900_000_000,
  },
} as const satisfies ComprehensiveBasicDeductionRules

export const COMPREHENSIVE_BASIC_DEDUCTIONS_FROM_2027 = {
  oneHouse: {
    residing: 1_400_000_000,
    nonResiding: 900_000_000,
  },
  multiHouse: {
    kind: 'residentShare',
    base: 400_000_000,
    residentHomeShareMaximum: 500_000_000,
  },
} as const satisfies ComprehensiveBasicDeductionRules

/**
 * 종부세 공정시장가액비율 — tax-rules-spec.md §3.3, 개편안 p62.
 * 2028년부터 다주택 가중 조건만 80%이고 1세대1주택자는 항상 표준 비율이다.
 */
const COMPREHENSIVE_FAIR_MARKET_VALUE_RATIO_2026 =
  6_000 / RATE_DENOMINATOR
const COMPREHENSIVE_FAIR_MARKET_VALUE_RATIO_STANDARD_REFORM =
  7_000 / RATE_DENOMINATOR
const COMPREHENSIVE_FAIR_MARKET_VALUE_RATIO_ELEVATED_FROM_2028 =
  8_000 / RATE_DENOMINATOR

export const COMPREHENSIVE_FAIR_MARKET_VALUE_RATIOS_2026 = {
  oneHouse: COMPREHENSIVE_FAIR_MARKET_VALUE_RATIO_2026,
  multiHouse: {
    standard: COMPREHENSIVE_FAIR_MARKET_VALUE_RATIO_2026,
    threeOrMoreOrAdjusted: COMPREHENSIVE_FAIR_MARKET_VALUE_RATIO_2026,
  },
} as const satisfies ComprehensiveFairMarketValueRatioRules

export const COMPREHENSIVE_FAIR_MARKET_VALUE_RATIOS_2027 = {
  oneHouse: COMPREHENSIVE_FAIR_MARKET_VALUE_RATIO_STANDARD_REFORM,
  multiHouse: {
    standard: COMPREHENSIVE_FAIR_MARKET_VALUE_RATIO_STANDARD_REFORM,
    threeOrMoreOrAdjusted:
      COMPREHENSIVE_FAIR_MARKET_VALUE_RATIO_STANDARD_REFORM,
  },
} as const satisfies ComprehensiveFairMarketValueRatioRules

export const COMPREHENSIVE_FAIR_MARKET_VALUE_RATIOS_FROM_2028 = {
  oneHouse: COMPREHENSIVE_FAIR_MARKET_VALUE_RATIO_STANDARD_REFORM,
  multiHouse: {
    standard: COMPREHENSIVE_FAIR_MARKET_VALUE_RATIO_STANDARD_REFORM,
    threeOrMoreOrAdjusted:
      COMPREHENSIVE_FAIR_MARKET_VALUE_RATIO_ELEVATED_FROM_2028,
  },
} as const satisfies ComprehensiveFairMarketValueRatioRules

/** 종부세 현행 2주택 이하 세율표 — tax-rules-spec.md §3.4, 개편안 p63. */
export const COMPREHENSIVE_TAX_BRACKETS_2026_UP_TO_TWO_HOMES = [
  {
    upTo: 300_000_000,
    rate: 50 / RATE_DENOMINATOR,
    progressiveDeduction: 0,
  },
  {
    upTo: 600_000_000,
    rate: 70 / RATE_DENOMINATOR,
    progressiveDeduction: 600_000,
  },
  {
    upTo: 1_200_000_000,
    rate: 100 / RATE_DENOMINATOR,
    progressiveDeduction: 2_400_000,
  },
  {
    upTo: 2_500_000_000,
    rate: 130 / RATE_DENOMINATOR,
    progressiveDeduction: 6_000_000,
  },
  {
    upTo: 5_000_000_000,
    rate: 150 / RATE_DENOMINATOR,
    progressiveDeduction: 11_000_000,
  },
  {
    upTo: 9_400_000_000,
    rate: 200 / RATE_DENOMINATOR,
    progressiveDeduction: 36_000_000,
  },
  {
    upTo: Number.POSITIVE_INFINITY,
    rate: 270 / RATE_DENOMINATOR,
    progressiveDeduction: 101_800_000,
  },
] as const

/** 종부세 현행 3주택 이상 세율표 — tax-rules-spec.md §3.4, 개편안 p63. */
export const COMPREHENSIVE_TAX_BRACKETS_2026_THREE_OR_MORE_HOMES = [
  {
    upTo: 300_000_000,
    rate: 50 / RATE_DENOMINATOR,
    progressiveDeduction: 0,
  },
  {
    upTo: 600_000_000,
    rate: 70 / RATE_DENOMINATOR,
    progressiveDeduction: 600_000,
  },
  {
    upTo: 1_200_000_000,
    rate: 100 / RATE_DENOMINATOR,
    progressiveDeduction: 2_400_000,
  },
  {
    upTo: 2_500_000_000,
    rate: 200 / RATE_DENOMINATOR,
    progressiveDeduction: 14_400_000,
  },
  {
    upTo: 5_000_000_000,
    rate: 300 / RATE_DENOMINATOR,
    progressiveDeduction: 39_400_000,
  },
  {
    upTo: 9_400_000_000,
    rate: 400 / RATE_DENOMINATOR,
    progressiveDeduction: 89_400_000,
  },
  {
    upTo: Number.POSITIVE_INFINITY,
    rate: 500 / RATE_DENOMINATOR,
    progressiveDeduction: 183_400_000,
  },
] as const

/** 종부세 2027년 2주택 이하 세율표 — tax-rules-spec.md §3.4, 개편안 p63. */
export const COMPREHENSIVE_TAX_BRACKETS_2027_UP_TO_TWO_HOMES = [
  {
    upTo: 300_000_000,
    rate: 50 / RATE_DENOMINATOR,
    progressiveDeduction: 0,
  },
  {
    upTo: 600_000_000,
    rate: 70 / RATE_DENOMINATOR,
    progressiveDeduction: 600_000,
  },
  {
    upTo: 1_200_000_000,
    rate: 130 / RATE_DENOMINATOR,
    progressiveDeduction: 4_200_000,
  },
  {
    upTo: 2_500_000_000,
    rate: 150 / RATE_DENOMINATOR,
    progressiveDeduction: 6_600_000,
  },
  {
    upTo: 5_000_000_000,
    rate: 200 / RATE_DENOMINATOR,
    progressiveDeduction: 19_100_000,
  },
  {
    upTo: 9_400_000_000,
    rate: 270 / RATE_DENOMINATOR,
    progressiveDeduction: 54_100_000,
  },
  {
    upTo: Number.POSITIVE_INFINITY,
    rate: 350 / RATE_DENOMINATOR,
    progressiveDeduction: 129_300_000,
  },
] as const

/**
 * 종부세 2027년 3주택 이상 및 2028년 이후 일원화 세율표 —
 * tax-rules-spec.md §3.4, 개편안 p63. 두 적용 구간의 표가 동일하므로 한 번만 정의한다.
 */
export const COMPREHENSIVE_TAX_REFORM_UNIFIED_BRACKETS = [
  {
    upTo: 300_000_000,
    rate: 50 / RATE_DENOMINATOR,
    progressiveDeduction: 0,
  },
  {
    upTo: 600_000_000,
    rate: 70 / RATE_DENOMINATOR,
    progressiveDeduction: 600_000,
  },
  {
    upTo: 1_200_000_000,
    rate: 130 / RATE_DENOMINATOR,
    progressiveDeduction: 4_200_000,
  },
  {
    upTo: 2_500_000_000,
    rate: 200 / RATE_DENOMINATOR,
    progressiveDeduction: 12_600_000,
  },
  {
    upTo: 5_000_000_000,
    rate: 300 / RATE_DENOMINATOR,
    progressiveDeduction: 37_600_000,
  },
  {
    upTo: 9_400_000_000,
    rate: 400 / RATE_DENOMINATOR,
    progressiveDeduction: 87_600_000,
  },
  {
    upTo: Number.POSITIVE_INFINITY,
    rate: 500 / RATE_DENOMINATOR,
    progressiveDeduction: 181_600_000,
  },
] as const

/**
 * 종부세 산출세액 음수 보정 — holding-tax-v3-spec.md §3.9.
 * v3 엑셀은 2026년에 하한을 두지 않고, 2027년 이후에만 0원 하한을 둔다.
 */
export const COMPREHENSIVE_CALCULATED_TAX_MINIMUM_2026 = null
export const COMPREHENSIVE_CALCULATED_TAX_MINIMUM_FROM_2027 = 0

/**
 * 세액공제·세부담상한 반영 후 종합부동산세 하한 — v3.5 엑셀 행 55.
 * 2026년은 하한이 없고, 2027년 이후에는 0원 하한을 둔다.
 */
export const COMPREHENSIVE_PAYABLE_TAX_MINIMUM_2026 = null
export const COMPREHENSIVE_PAYABLE_TAX_MINIMUM_FROM_2027 = 0

/**
 * 농어촌특별세율 — tax-rules-spec.md §3.8.
 * 개편안 페이지가 별도 명시되지 않은 현행 세율이다.
 */
export const COMPREHENSIVE_RURAL_SPECIAL_TAX_RATE =
  2_000 / RATE_DENOMINATOR

/**
 * 종부세 3주택 이상 판정 기준 — tax-rules-spec.md §3.3~3.4, 개편안 p62~63.
 * 공정시장가액비율 가중과 주택 수별 세율표 선택에 같은 기준을 사용한다.
 */
export const COMPREHENSIVE_ELEVATED_HOME_COUNT_MINIMUM = 3

export const COMPREHENSIVE_TAX_COMMON_RULES = {
  elevatedHomeCountMinimum: COMPREHENSIVE_ELEVATED_HOME_COUNT_MINIMUM,
  ruralSpecialTaxRate: COMPREHENSIVE_RURAL_SPECIAL_TAX_RATE,
} as const
