import type { PropertyTaxRules } from '../../shared/tax-rules'
import { RATE_DENOMINATOR } from './rate'

/**
 * 재산세 1세대1주택 주택 수 기준 — tax-rules-spec.md §2.1~2.2 및 §3.7.
 * 공동명의 지분과 무관하게 세대가 소유한 물건 수로 판정한다.
 */
export const PROPERTY_TAX_ONE_HOUSE_HOME_COUNT = 1

/**
 * 재산세 공정시장가액비율 — tax-rules-spec.md §2.1.
 * 개편안 개정 대상이 아니어서 개편안 페이지는 없으며, 현행 지방세법 수치다.
 */
export const PROPERTY_TAX_FAIR_MARKET_VALUE_RATIOS = {
  oneHouse: [
    { upTo: 300_000_000, rate: 4_300 / RATE_DENOMINATOR },
    { upTo: 600_000_000, rate: 4_400 / RATE_DENOMINATOR },
    { upTo: Number.POSITIVE_INFINITY, rate: 4_500 / RATE_DENOMINATOR },
  ],
  other: 6_000 / RATE_DENOMINATOR,
} as const

/**
 * 재산세 1세대1주택 특례세율 적용 공시가격 상한 — tax-rules-spec.md §2.2.
 * 개편안 개정 대상이 아니어서 개편안 페이지는 없으며, 현행 지방세법 수치다.
 */
export const PROPERTY_TAX_PREFERENTIAL_RATE_MAXIMUM_OFFICIAL_PRICE =
  900_000_000

/**
 * 재산세 일반·특례 세율표 — tax-rules-spec.md §2.2.
 * 개편안 개정 대상이 아니어서 개편안 페이지는 없으며, 현행 지방세법 수치다.
 */
const PROPERTY_TAX_BRACKET_ROWS = [
  {
    upTo: 60_000_000,
    progressiveDeduction: 0,
    generalRate: 10 / RATE_DENOMINATOR,
    oneHouseRate: 5 / RATE_DENOMINATOR,
  },
  {
    upTo: 150_000_000,
    progressiveDeduction: 30_000,
    generalRate: 15 / RATE_DENOMINATOR,
    oneHouseRate: 10 / RATE_DENOMINATOR,
  },
  {
    upTo: 300_000_000,
    progressiveDeduction: 180_000,
    generalRate: 25 / RATE_DENOMINATOR,
    oneHouseRate: 20 / RATE_DENOMINATOR,
  },
  {
    upTo: Number.POSITIVE_INFINITY,
    progressiveDeduction: 630_000,
    generalRate: 40 / RATE_DENOMINATOR,
    oneHouseRate: 35 / RATE_DENOMINATOR,
  },
] as const

export const PROPERTY_TAX_GENERAL_BRACKETS = Object.freeze(
  PROPERTY_TAX_BRACKET_ROWS.map(
    ({ upTo, progressiveDeduction, generalRate }) => ({
      upTo,
      rate: generalRate,
      progressiveDeduction,
    }),
  ),
)

export const PROPERTY_TAX_ONE_HOUSE_BRACKETS = Object.freeze(
  PROPERTY_TAX_BRACKET_ROWS.map(
    ({ upTo, progressiveDeduction, oneHouseRate }) => ({
      upTo,
      rate: oneHouseRate,
      progressiveDeduction,
    }),
  ),
)

/**
 * 재산세 부가세율과 각 과세 기준 — tax-rules-spec.md §2.3.
 * 개편안 개정 대상이 아니어서 개편안 페이지는 없으며, 현행 지방세법 수치다.
 */
export const PROPERTY_TAX_SURTAXES = {
  localEducation: {
    base: 'baseTax',
    rate: 2_000 / RATE_DENOMINATOR,
  },
  cityArea: {
    base: 'taxableBase',
    rate: 14 / RATE_DENOMINATOR,
  },
} as const

export const PROPERTY_TAX_RULES = {
  oneHouseHomeCount: PROPERTY_TAX_ONE_HOUSE_HOME_COUNT,
  fairMarketValueRatios: PROPERTY_TAX_FAIR_MARKET_VALUE_RATIOS,
  preferentialRateMaximumOfficialPrice:
    PROPERTY_TAX_PREFERENTIAL_RATE_MAXIMUM_OFFICIAL_PRICE,
  brackets: {
    general: PROPERTY_TAX_GENERAL_BRACKETS,
    oneHouse: PROPERTY_TAX_ONE_HOUSE_BRACKETS,
  },
  surtaxes: PROPERTY_TAX_SURTAXES,
} as const satisfies PropertyTaxRules
