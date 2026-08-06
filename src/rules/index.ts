import type { TaxRules, TaxYear } from '../../shared/tax-rules'
import { TAX_RULES_2025 } from './2025'
import { TAX_RULES_2026 } from './2026'
import { TAX_RULES_2027 } from './2027'
import { TAX_RULES_2028 } from './2028'
import { TAX_RULES_2029 } from './2029'

export { evaluateBracketTax, findApplicableTaxBracket } from './bracket'
export { roundTaxAmount } from './rounding'

export const TAX_RULES_BY_YEAR = {
  2025: TAX_RULES_2025,
  2026: TAX_RULES_2026,
  2027: TAX_RULES_2027,
  2028: TAX_RULES_2028,
  2029: TAX_RULES_2029,
} as const satisfies Readonly<Record<TaxYear, TaxRules>>
