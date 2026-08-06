import type { PropertyTaxRules } from '../../shared/tax-rules'
import { RATE_DENOMINATOR } from './rate'

/**
 * 재산세 1세대1주택 주택 수 기준 — tax-rules-spec.md §2.1~2.2 및 §3.7.
 * 공동명의 지분과 무관하게 세대가 소유한 물건 수로 판정한다.
 */
export const PROPERTY_TAX_ONE_HOUSE_HOME_COUNT = 1

/**
 * 재산세 공정시장가액비율 — 지방세법 시행령 §109①2.
 * 2025년 값은 2025.5.27. 개정 대통령령 제35544호에서, 2026년 값은
 * 2026.5.29. 개정본에서 각각 1세대1주택 43%/44%/45%, 그 외 60%로 정했다.
 */
const PROPERTY_TAX_CONFIRMED_FAIR_MARKET_VALUE_RATIOS = {
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

const createPropertyTaxRules = (
  fairMarketValueRatios: PropertyTaxRules['fairMarketValueRatios'],
): PropertyTaxRules => ({
  oneHouseHomeCount: PROPERTY_TAX_ONE_HOUSE_HOME_COUNT,
  fairMarketValueRatios,
  preferentialRateMaximumOfficialPrice:
    PROPERTY_TAX_PREFERENTIAL_RATE_MAXIMUM_OFFICIAL_PRICE,
  brackets: {
    general: PROPERTY_TAX_GENERAL_BRACKETS,
    oneHouse: PROPERTY_TAX_ONE_HOUSE_BRACKETS,
  },
  surtaxes: PROPERTY_TAX_SURTAXES,
})

/** 2025년 확정 시행값 — 지방세법 시행령 §109①2, 대통령령 제35544호(2025.5.27.). */
export const PROPERTY_TAX_RULES_2025 = createPropertyTaxRules(
  PROPERTY_TAX_CONFIRMED_FAIR_MARKET_VALUE_RATIOS,
)

/** 2026년 확정 시행값 — 지방세법 시행령 §109①2, 2026.5.29. 개정본. */
export const PROPERTY_TAX_RULES_2026 = createPropertyTaxRules(
  PROPERTY_TAX_CONFIRMED_FAIR_MARKET_VALUE_RATIOS,
)

/**
 * 2027~2029년은 시행령이 아직 해당 연도를 규정하지 않아 2026년 특례가
 * 연장된다고 가정한다. 향후 시행령 확정 시 연도별 상수만 교체한다.
 */
export const PROPERTY_TAX_RULES_2027 = createPropertyTaxRules(
  PROPERTY_TAX_CONFIRMED_FAIR_MARKET_VALUE_RATIOS,
)
export const PROPERTY_TAX_RULES_2028 = createPropertyTaxRules(
  PROPERTY_TAX_CONFIRMED_FAIR_MARKET_VALUE_RATIOS,
)
export const PROPERTY_TAX_RULES_2029 = createPropertyTaxRules(
  PROPERTY_TAX_CONFIRMED_FAIR_MARKET_VALUE_RATIOS,
)
