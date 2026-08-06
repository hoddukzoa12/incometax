import type { TaxRules } from '../../shared/tax-rules'
import { TAX_RULES_2026 } from './2026'
import { PROPERTY_TAX_RULES_2025 } from './property-tax'

/**
 * 2025년 룰은 2026년 세부담상한의 직전년도 기준액 계산 전용이다.
 * 종부세법 §8(2023.4.18. 개정)·§9(2022.12.31. 개정)·§10
 * (2023.4.18. 개정)과 시행령 §2조의4①(2023.2.28. 개정)은 2025년과
 * 2026년이 같고, 2025.12.23. 공포·2026.1.1. 시행 개정도 해당 조문을
 * 변경하지 않았다.
 * 재산세 공정시장가액비율만 2025년 확정 시행값을 명시적으로 선택한다.
 */
export const TAX_RULES_2025 = {
  year: 2025,
  propertyTax: PROPERTY_TAX_RULES_2025,
  comprehensiveTax: TAX_RULES_2026.comprehensiveTax,
  transferTax: TAX_RULES_2026.transferTax,
} as const satisfies TaxRules
