import type { ComprehensiveTaxCreditResidencePeriod } from './ownership'

export type UnavoidableRelocationReason =
  | { readonly kind: 'highSchoolOrUniversityEnrollment' }
  | { readonly kind: 'jobChangeOrTransfer' }
  | {
      readonly kind: 'medicalTreatmentOrCare'
      readonly requiredTreatmentYears?: number
    }
  | { readonly kind: 'schoolViolenceTransfer' }
  | { readonly kind: 'overseasStudyOrEmployment' }
  | {
      readonly kind: 'supportDirectAncestor'
      readonly directAncestorAge?: number
    }
  | { readonly kind: 'similarUnavoidableReason' }

export type RelocationDestination =
  | 'otherCityOrCounty'
  | 'qualifyingUrbanRuralAreaMove'
  | 'overseas'
  | 'sameCityOrCounty'

export interface UnavoidableRelocationRecognitionInput {
  readonly kind: 'unavoidableRelocation'
  readonly continuousResidenceStartDate?: string
  readonly relocationDate?: string
  readonly recognitionEndDate?: string
  readonly reason?: UnavoidableRelocationReason
  readonly destination?: RelocationDestination
}

export type DemolitionBeforeApprovalInput =
  | { readonly kind: 'notDemolishedBeforeApproval' }
  | {
      readonly kind: 'demolishedBeforeApproval'
      readonly demolitionDate?: string
    }

export interface RedevelopmentConstructionRecognitionInput {
  readonly kind: 'redevelopmentConstruction'
  readonly continuousResidenceStartDate?: string
  readonly managementDispositionApprovalDate?: string
  readonly occupancyAvailableDate?: string
  readonly demolitionBeforeApproval?: DemolitionBeforeApprovalInput
}

export type ComprehensiveResidenceRecognitionInput =
  | UnavoidableRelocationRecognitionInput
  | RedevelopmentConstructionRecognitionInput

export type ComprehensiveResidenceRecognitionMissingInput =
  | 'continuousResidenceStartDate'
  | 'relocationDate'
  | 'recognitionEndDate'
  | 'reason'
  | 'requiredTreatmentYears'
  | 'directAncestorAge'
  | 'destination'
  | 'managementDispositionApprovalDate'
  | 'occupancyAvailableDate'
  | 'demolitionBeforeApproval'
  | 'demolitionDate'

export type ComprehensiveResidenceRecognitionFailedCondition =
  | 'minimumContinuousResidence'
  | 'qualifyingReason'
  | 'qualifyingDestination'

interface CompleteRecognitionResult {
  readonly creditPeriod: ComprehensiveTaxCreditResidencePeriod
}

export interface ResidenceRecognitionNotEffectiveResult
  extends CompleteRecognitionResult {
  readonly status: 'notEffective'
}

export interface ResidenceRecognitionNotApplicableResult
  extends CompleteRecognitionResult {
  readonly status: 'notApplicable'
  readonly reason: 'notOneHouse'
}

export interface ResidenceRecognitionNotRequestedResult
  extends CompleteRecognitionResult {
  readonly status: 'notRequested'
}

export interface ResidenceRecognitionNotComputedResult {
  readonly status: 'notComputed'
  readonly kind: ComprehensiveResidenceRecognitionInput['kind']
  readonly missingInputs:
    readonly ComprehensiveResidenceRecognitionMissingInput[]
  readonly creditPeriod: null
}

export interface ResidenceRecognitionNotQualifiedResult
  extends CompleteRecognitionResult {
  readonly status: 'notQualified'
  readonly kind: ComprehensiveResidenceRecognitionInput['kind']
  readonly failedConditions:
    readonly ComprehensiveResidenceRecognitionFailedCondition[]
}

export interface ResidenceRecognitionComputedResult
  extends CompleteRecognitionResult {
  readonly status: 'computed'
  readonly kind: ComprehensiveResidenceRecognitionInput['kind']
}

export type ComprehensiveResidenceRecognitionResult =
  | ResidenceRecognitionNotEffectiveResult
  | ResidenceRecognitionNotApplicableResult
  | ResidenceRecognitionNotRequestedResult
  | ResidenceRecognitionNotComputedResult
  | ResidenceRecognitionNotQualifiedResult
  | ResidenceRecognitionComputedResult
