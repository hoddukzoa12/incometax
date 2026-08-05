import type {
  ComprehensiveTaxBurdenCapRules,
} from '../../shared/tax-rules'
import { RATE_DENOMINATOR } from './rate'

/** 종부세 현행 세부담상한 150% — tax-rules-spec.md §5.1, 개편안 p65. */
export const COMPREHENSIVE_TAX_BURDEN_CAP_RULES_2026 = {
  rate: 15_000 / RATE_DENOMINATOR,
} as const satisfies ComprehensiveTaxBurdenCapRules

/**
 * 종부세 2027년 이후 세부담상한 200% — tax-rules-spec.md §5.1, 개편안 p65.
 * 2027년 1월 1일 이후 납세의무 성립분부터 적용한다.
 */
export const COMPREHENSIVE_TAX_BURDEN_CAP_RULES_FROM_2027 = {
  rate: 20_000 / RATE_DENOMINATOR,
} as const satisfies ComprehensiveTaxBurdenCapRules
