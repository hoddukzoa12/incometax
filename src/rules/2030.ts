import type { TaxRules } from '../../shared/tax-rules'
import {
  COMPREHENSIVE_BASIC_DEDUCTIONS_FROM_2027,
  COMPREHENSIVE_CALCULATED_TAX_MINIMUM_FROM_2027,
  COMPREHENSIVE_FAIR_MARKET_VALUE_RATIOS_FROM_2028,
  COMPREHENSIVE_PAYABLE_TAX_MINIMUM_FROM_2027,
  COMPREHENSIVE_TAX_COMMON_RULES,
  COMPREHENSIVE_TAX_REFORM_UNIFIED_BRACKETS,
  COMPREHENSIVE_TAXABLE_THRESHOLDS_FROM_2027,
} from './comprehensive-tax'
import {
  COMPREHENSIVE_TAX_BURDEN_CAP_RULES_FROM_2027,
} from './comprehensive-tax-burden-cap'
import {
  COMPREHENSIVE_TAX_CREDIT_RULES_FROM_2028,
} from './comprehensive-tax-credit'
import { PROPERTY_TAX_RULES_2030 } from './property-tax'
import {
  TRANSFER_BASIC_DEDUCTIONS_FROM_2027,
  TRANSFER_DEDUCTION_CAPS_FROM_2029,
  TRANSFER_LONG_TERM_DEDUCTIONS_FROM_2029,
} from './transfer-deductions'
import { TRANSFER_TAX_COMMON_RULES } from './transfer-tax-common'

/**
 * 2030년은 개편안이 정한 마지막 단계(2028년 기준)가 그대로 이어진다고 본다.
 * 이 해를 두는 이유는 세법이 새로 정해져서가 아니라, 추이 화면이 6년치 막대를
 * 세우기 때문이다 — 시안 shell-v2.html 의 `buildSeries` 가 2025~2030 을 그린다.
 * 값이 실제로 정해지면 이 파일의 상수만 갈아 끼운다.
 */
export const TAX_RULES_2030 = {
  year: 2030,
  propertyTax: PROPERTY_TAX_RULES_2030,
  comprehensiveTax: {
    ...COMPREHENSIVE_TAX_COMMON_RULES,
    taxableThresholds: COMPREHENSIVE_TAXABLE_THRESHOLDS_FROM_2027,
    basicDeductions: COMPREHENSIVE_BASIC_DEDUCTIONS_FROM_2027,
    fairMarketValueRatios: COMPREHENSIVE_FAIR_MARKET_VALUE_RATIOS_FROM_2028,
    calculatedTaxMinimum:
      COMPREHENSIVE_CALCULATED_TAX_MINIMUM_FROM_2027,
    payableTaxMinimum: COMPREHENSIVE_PAYABLE_TAX_MINIMUM_FROM_2027,
    brackets: {
      kind: 'unified',
      brackets: COMPREHENSIVE_TAX_REFORM_UNIFIED_BRACKETS,
    },
    taxCredit: COMPREHENSIVE_TAX_CREDIT_RULES_FROM_2028,
    taxBurdenCap: COMPREHENSIVE_TAX_BURDEN_CAP_RULES_FROM_2027,
  },
  transferTax: {
    ...TRANSFER_TAX_COMMON_RULES,
    longTermDeductions: TRANSFER_LONG_TERM_DEDUCTIONS_FROM_2029,
    deductionCaps: TRANSFER_DEDUCTION_CAPS_FROM_2029,
    basicDeductions: TRANSFER_BASIC_DEDUCTIONS_FROM_2027,
  },
} as const satisfies TaxRules
