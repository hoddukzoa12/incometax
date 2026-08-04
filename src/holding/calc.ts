import type {
  HoldingTaxInput,
  HoldingTaxResult,
} from '../../shared/holding-tax'
import type { HouseholdKind } from '../../shared/tax-rules'
import { TAX_RULES_BY_YEAR } from '../rules'
import { calculateComprehensiveTax } from './comprehensive-tax'
import { calculatePropertyTax } from './property-tax'
import { assertValidHoldingTaxInput } from './validation'

const ZERO_AMOUNT = 0

export const calculateHoldingTax = (
  input: HoldingTaxInput,
): HoldingTaxResult => {
  assertValidHoldingTaxInput(input)
  const rules = TAX_RULES_BY_YEAR[input.year]
  const propertyTaxHouseholdKind: HouseholdKind =
    input.householdHomeCount === rules.propertyTax.oneHouseHomeCount
      ? 'oneHouse'
      : 'multiHouse'
  const comprehensiveTaxHouseholdKind: HouseholdKind =
    propertyTaxHouseholdKind === 'oneHouse' &&
    input.items[0].isSoleHouseholdOwner
      ? 'oneHouse'
      : 'multiHouse'
  const propertyTaxes = input.items.map((item, itemIndex) =>
    calculatePropertyTax(
      item,
      itemIndex,
      propertyTaxHouseholdKind,
      rules.propertyTax,
    ),
  )
  const propertyTaxTotal = propertyTaxes.reduce(
    (total, result) => total + result.totalTax,
    ZERO_AMOUNT,
  )
  const comprehensiveTax = calculateComprehensiveTax(
    input.items,
    comprehensiveTaxHouseholdKind,
    propertyTaxHouseholdKind,
    input.householdHomeCount,
    propertyTaxes,
    rules,
  )

  return {
    year: input.year,
    householdHomeCount: input.householdHomeCount,
    propertyTaxHouseholdKind,
    comprehensiveTaxHouseholdKind,
    propertyTaxes,
    propertyTaxTotal,
    comprehensiveTax,
    totalTax: propertyTaxTotal + comprehensiveTax.totalTax,
  }
}
