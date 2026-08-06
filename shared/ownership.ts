export interface OwnershipPeriod {
  readonly holdingYears: number
  readonly residenceYears: number
}

export interface ActualResidencePeriod {
  readonly basis: 'actualResidence'
  readonly years: number
}

export interface ComprehensiveTaxCreditResidencePeriod {
  readonly basis: 'comprehensiveTaxCreditResidence'
  readonly actualYears: number
  readonly recognizedYears: number
  readonly years: number
}
