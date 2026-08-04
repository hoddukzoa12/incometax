import type { TaxRules } from '../../shared/tax-rules'
import {
  COMPREHENSIVE_BASIC_DEDUCTIONS_FROM_2027,
  COMPREHENSIVE_FAIR_MARKET_VALUE_RATIOS_FROM_2028,
  COMPREHENSIVE_TAX_COMMON_RULES,
  COMPREHENSIVE_TAX_REFORM_UNIFIED_BRACKETS,
  COMPREHENSIVE_TAXABLE_THRESHOLDS_FROM_2027,
} from './comprehensive-tax'
import { PROPERTY_TAX_RULES } from './property-tax'
import {
  TRANSFER_BASIC_DEDUCTIONS_FROM_2027,
  TRANSFER_DEDUCTION_CAPS_FROM_2029,
  TRANSFER_LONG_TERM_DEDUCTIONS_FROM_2029,
} from './transfer-deductions'
import { TRANSFER_TAX_COMMON_RULES } from './transfer-tax-common'

export const TAX_RULES_2029 = {
  year: 2029,
  propertyTax: PROPERTY_TAX_RULES,
  comprehensiveTax: {
    ...COMPREHENSIVE_TAX_COMMON_RULES,
    taxableThresholds: COMPREHENSIVE_TAXABLE_THRESHOLDS_FROM_2027,
    basicDeductions: COMPREHENSIVE_BASIC_DEDUCTIONS_FROM_2027,
    fairMarketValueRatios: COMPREHENSIVE_FAIR_MARKET_VALUE_RATIOS_FROM_2028,
    brackets: {
      kind: 'unified',
      brackets: COMPREHENSIVE_TAX_REFORM_UNIFIED_BRACKETS,
    },
  },
  transferTax: {
    ...TRANSFER_TAX_COMMON_RULES,
    longTermDeductions: TRANSFER_LONG_TERM_DEDUCTIONS_FROM_2029,
    deductionCaps: TRANSFER_DEDUCTION_CAPS_FROM_2029,
    basicDeductions: TRANSFER_BASIC_DEDUCTIONS_FROM_2027,
  },
} as const satisfies TaxRules

