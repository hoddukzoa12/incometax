import type {
  HouseholdKind,
  LongTermDeductionRule,
  TaxRules,
} from '../../shared/tax-rules'
import type {
  TransferBasicDeductionKind,
  TransferLongTermDeductionResult,
  TransferTaxInput,
  TransferTaxResult,
  TransferTaxStatus,
} from '../../shared/transfer-tax'
import {
  evaluateBracketTax,
  findApplicableTaxBracket,
  roundTaxAmount,
  TAX_RULES_BY_YEAR,
} from '../rules'
import { assertValidTransferTaxInput } from './validation'

const DEFAULT_IS_TAX_RESIDENT = true
const DEFAULT_IS_RELATED_PARTY_TRANSACTION = false
const DEFAULT_CAP_APPORTIONMENT_RATIO = 1
const MAXIMUM_RATIO = 1
const ZERO_AMOUNT = 0
const ZERO_RATE = 0

const getCompletedYears = (years: number): number => Math.floor(years)

const getComponentRate = (
  years: number,
  component: LongTermDeductionRule['holding'],
): number => {
  if (!component) {
    return ZERO_RATE
  }

  if (
    component.minimumQualifyingYears !== undefined &&
    years < component.minimumQualifyingYears
  ) {
    return ZERO_RATE
  }

  return Math.min(
    getCompletedYears(years) * component.annualRate,
    component.maximumRate,
  )
}

const selectLongTermDeductionRule = (
  input: TransferTaxInput,
  rules: TaxRules['transferTax'],
): readonly [HouseholdKind, LongTermDeductionRule] => {
  const oneHouseRule = rules.longTermDeductions.oneHouse
  const qualifiesForOneHouseRule =
    input.householdKind === 'oneHouse' &&
    input.holdingYears >= oneHouseRule.minimumHoldingYears &&
    input.residenceYears >= (oneHouseRule.minimumResidenceYears ?? ZERO_AMOUNT)
  const ruleHouseholdKind: HouseholdKind = qualifiesForOneHouseRule
    ? 'oneHouse'
    : 'multiHouse'

  return [
    ruleHouseholdKind,
    rules.longTermDeductions[ruleHouseholdKind],
  ] as const
}

const getLongTermDeductionRates = (
  input: TransferTaxInput,
  rule: LongTermDeductionRule,
): readonly [number, number, number] => {
  if (input.holdingYears < rule.minimumHoldingYears) {
    return [ZERO_RATE, ZERO_RATE, ZERO_RATE]
  }

  const holdingRate = getComponentRate(input.holdingYears, rule.holding)
  const residenceRate = getComponentRate(input.residenceYears, rule.residence)
  const componentRates = [holdingRate, residenceRate]
  const aggregatedRate =
    rule.aggregation === 'maximum'
      ? Math.max(...componentRates)
      : componentRates.reduce((total, rate) => total + rate, ZERO_RATE)

  return [
    holdingRate,
    residenceRate,
    Math.min(aggregatedRate, rule.maximumRate),
  ]
}

const getDeductionCap = (
  input: TransferTaxInput,
  rules: TaxRules['transferTax'],
): number | null => {
  if (!rules.deductionCaps) {
    return null
  }

  const apportionmentRatio =
    input.deductionCapApportionmentRatio ??
    DEFAULT_CAP_APPORTIONMENT_RATIO
  const apportionedAnnualCap =
    rules.deductionCaps.perPersonAnnual * apportionmentRatio
  const remainingAnnualCap = Math.min(
    apportionedAnnualCap,
    input.remainingAnnualLongTermDeductionCap ?? apportionedAnnualCap,
  )
  const propertyCap =
    rules.deductionCaps.perProperty * apportionmentRatio

  return Math.min(remainingAnnualCap, propertyCap)
}

const calculateLongTermDeduction = (
  input: TransferTaxInput,
  rules: TaxRules['transferTax'],
  taxableGain: number,
): readonly [TransferLongTermDeductionResult, number] => {
  const [ruleHouseholdKind, deductionRule] = selectLongTermDeductionRule(
    input,
    rules,
  )
  const [holdingRate, residenceRate, nominalRate] =
    getLongTermDeductionRates(input, deductionRule)
  const calculatedAmount = taxableGain * nominalRate
  const capAmount = getDeductionCap(input, rules)
  const appliedAmount = Math.min(
    calculatedAmount,
    capAmount ?? Number.POSITIVE_INFINITY,
  )
  const effectiveRate =
    taxableGain > ZERO_AMOUNT ? appliedAmount / taxableGain : ZERO_RATE

  return [
    {
      ruleHouseholdKind,
      holdingRate,
      residenceRate,
      nominalRate,
      calculatedAmount: roundTaxAmount(calculatedAmount),
      capAmount: capAmount === null ? null : roundTaxAmount(capAmount),
      appliedAmount: roundTaxAmount(appliedAmount),
      effectiveRate,
      isCapped: appliedAmount < calculatedAmount,
    },
    appliedAmount,
  ]
}

const getBasicDeduction = (
  input: TransferTaxInput,
  rules: TaxRules['transferTax'],
  gainAfterLongTermDeduction: number,
): readonly [TransferBasicDeductionKind, number] => {
  const specialRule = rules.basicDeductions.special
  const qualifiesForSpecial =
    specialRule !== null &&
    input.householdKind === specialRule.householdKind &&
    input.residenceYears >= specialRule.minimumResidenceYears &&
    input.salePrice <= specialRule.maximumSalePrice &&
    (input.isTaxResident ?? DEFAULT_IS_TAX_RESIDENT) &&
    !(
      input.isRelatedPartyTransaction ??
      DEFAULT_IS_RELATED_PARTY_TRANSACTION
    )
  const deductionKind: TransferBasicDeductionKind = qualifiesForSpecial
    ? 'longResidenceSpecial'
    : 'standard'
  const statutoryAmount = qualifiesForSpecial
    ? specialRule.annualAmount
    : rules.basicDeductions.standardAnnualAmount

  return [deductionKind, Math.min(gainAfterLongTermDeduction, statutoryAmount)]
}

const createZeroResult = (
  input: TransferTaxInput,
  status: Exclude<TransferTaxStatus, 'taxable'>,
  grossGain: number,
): TransferTaxResult => ({
  year: input.year,
  status,
  grossGain,
  taxableGainRatio: ZERO_RATE,
  taxableGain: ZERO_AMOUNT,
  longTermDeduction: {
    ruleHouseholdKind: input.householdKind,
    holdingRate: ZERO_RATE,
    residenceRate: ZERO_RATE,
    nominalRate: ZERO_RATE,
    calculatedAmount: ZERO_AMOUNT,
    capAmount: null,
    appliedAmount: ZERO_AMOUNT,
    effectiveRate: ZERO_RATE,
    isCapped: false,
  },
  basicDeductionKind: 'none',
  basicDeductionAmount: ZERO_AMOUNT,
  taxableBase: ZERO_AMOUNT,
  appliedRate: {
    kind: 'none',
    rate: ZERO_RATE,
    progressiveDeduction: ZERO_AMOUNT,
  },
  nationalTax: ZERO_AMOUNT,
  localIncomeTax: ZERO_AMOUNT,
  totalTax: ZERO_AMOUNT,
})

export const calculateTransferTax = (
  input: TransferTaxInput,
): TransferTaxResult => {
  assertValidTransferTaxInput(input)

  const rules = TAX_RULES_BY_YEAR[input.year].transferTax
  const grossGain =
    input.salePrice - input.acquisitionPrice - input.necessaryExpenses

  if (grossGain <= ZERO_AMOUNT) {
    return createZeroResult(input, 'noGain', grossGain)
  }

  const qualifiesForOneHouseExemption =
    input.householdKind === 'oneHouse' &&
    input.holdingYears >= rules.oneHouseExemption.minimumHoldingYears
  if (
    qualifiesForOneHouseExemption &&
    input.salePrice <= rules.oneHouseExemption.maximumSalePrice
  ) {
    return createZeroResult(input, 'exempt', grossGain)
  }

  const isHighPriceApportionment =
    qualifiesForOneHouseExemption &&
    input.salePrice > rules.oneHouseExemption.maximumSalePrice
  const taxableGainRatio = isHighPriceApportionment
    ? (input.salePrice - rules.oneHouseExemption.maximumSalePrice) /
      input.salePrice
    : MAXIMUM_RATIO
  const taxableGain = grossGain * taxableGainRatio
  const [longTermDeduction, rawLongTermDeductionAmount] =
    calculateLongTermDeduction(input, rules, taxableGain)
  const gainAfterLongTermDeduction = Math.max(
    ZERO_AMOUNT,
    taxableGain - rawLongTermDeductionAmount,
  )
  const [basicDeductionKind, rawBasicDeductionAmount] = getBasicDeduction(
    input,
    rules,
    gainAfterLongTermDeduction,
  )
  const taxableBase = Math.max(
    ZERO_AMOUNT,
    gainAfterLongTermDeduction - rawBasicDeductionAmount,
  )
  const shortTermRate = rules.shortTermRates.find(
    ({ lessThanYears }) => input.holdingYears < lessThanYears,
  )
  const bracket = shortTermRate
    ? null
    : findApplicableTaxBracket(taxableBase, rules.brackets)
  const unroundedNationalTax = shortTermRate
    ? taxableBase * shortTermRate.rate
    : evaluateBracketTax(taxableBase, rules.brackets)
  const nationalTax = roundTaxAmount(unroundedNationalTax)
  const localIncomeTax = roundTaxAmount(
    nationalTax * rules.localIncomeTaxRate,
  )

  return {
    year: input.year,
    status: 'taxable',
    grossGain,
    taxableGainRatio,
    taxableGain: roundTaxAmount(taxableGain),
    longTermDeduction,
    basicDeductionKind,
    basicDeductionAmount: roundTaxAmount(rawBasicDeductionAmount),
    taxableBase: roundTaxAmount(taxableBase),
    appliedRate: {
      kind: shortTermRate ? 'shortTerm' : 'progressive',
      rate: shortTermRate?.rate ?? bracket?.rate ?? ZERO_RATE,
      progressiveDeduction: bracket?.progressiveDeduction ?? ZERO_AMOUNT,
    },
    nationalTax,
    localIncomeTax,
    totalTax: nationalTax + localIncomeTax,
  }
}
