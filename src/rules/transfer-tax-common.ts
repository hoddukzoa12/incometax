import { RATE_DENOMINATOR } from './rate'

/**
 * 양도소득세 기본세율표 — tax-rules-spec.md §4.1.
 * 개편안 개정 대상이 아니어서 개편안 페이지는 없는 현행 세율이다.
 */
export const TRANSFER_TAX_BRACKETS = [
  {
    upTo: 14_000_000,
    rate: 600 / RATE_DENOMINATOR,
    progressiveDeduction: 0,
  },
  {
    upTo: 50_000_000,
    rate: 1_500 / RATE_DENOMINATOR,
    progressiveDeduction: 1_260_000,
  },
  {
    upTo: 88_000_000,
    rate: 2_400 / RATE_DENOMINATOR,
    progressiveDeduction: 5_760_000,
  },
  {
    upTo: 150_000_000,
    rate: 3_500 / RATE_DENOMINATOR,
    progressiveDeduction: 15_440_000,
  },
  {
    upTo: 300_000_000,
    rate: 3_800 / RATE_DENOMINATOR,
    progressiveDeduction: 19_940_000,
  },
  {
    upTo: 500_000_000,
    rate: 4_000 / RATE_DENOMINATOR,
    progressiveDeduction: 25_940_000,
  },
  {
    upTo: 1_000_000_000,
    rate: 4_200 / RATE_DENOMINATOR,
    progressiveDeduction: 35_940_000,
  },
  {
    upTo: Number.POSITIVE_INFINITY,
    rate: 4_500 / RATE_DENOMINATOR,
    progressiveDeduction: 65_940_000,
  },
] as const

/**
 * 단기보유 중과세율과 기본세율 전환 보유기간 — tax-rules-spec.md §4.2.
 * 개편안 개정 대상이 아니어서 개편안 페이지는 없는 현행 세율이다.
 */
const TRANSFER_ONE_YEAR_HOLDING_PERIOD = 1

export const TRANSFER_ORDINARY_RATE_MINIMUM_HOLDING_YEARS = 2

export const TRANSFER_SHORT_TERM_RATES = [
  {
    lessThanYears: TRANSFER_ONE_YEAR_HOLDING_PERIOD,
    rate: 7_000 / RATE_DENOMINATOR,
  },
  {
    lessThanYears: TRANSFER_ORDINARY_RATE_MINIMUM_HOLDING_YEARS,
    rate: 6_000 / RATE_DENOMINATOR,
  },
] as const

/**
 * 1세대1주택 비과세 및 고가주택 안분 기준 — tax-rules-spec.md §4.3.
 * 개편안 페이지가 별도 명시되지 않은 현행 기준이다.
 */
export const TRANSFER_ONE_HOUSE_EXEMPTION = {
  maximumSalePrice: 1_200_000_000,
  minimumHoldingYears: 2,
} as const

/**
 * 지방소득세율 — tax-rules-spec.md §4.7.
 * 개편안 페이지가 별도 명시되지 않은 현행 세율이다.
 */
export const TRANSFER_LOCAL_INCOME_TAX_RATE = 1_000 / RATE_DENOMINATOR

export const TRANSFER_TAX_COMMON_RULES = {
  brackets: TRANSFER_TAX_BRACKETS,
  shortTermRates: TRANSFER_SHORT_TERM_RATES,
  ordinaryRateMinimumHoldingYears:
    TRANSFER_ORDINARY_RATE_MINIMUM_HOLDING_YEARS,
  oneHouseExemption: TRANSFER_ONE_HOUSE_EXEMPTION,
  localIncomeTaxRate: TRANSFER_LOCAL_INCOME_TAX_RATE,
} as const
