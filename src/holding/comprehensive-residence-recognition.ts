import type {
  ComprehensiveResidenceRecognitionFailedCondition,
  ComprehensiveResidenceRecognitionInput,
  ComprehensiveResidenceRecognitionMissingInput,
  ComprehensiveResidenceRecognitionResult,
  UnavoidableRelocationRecognitionInput,
} from '../../shared/comprehensive-residence-recognition'
import type {
  ActualResidencePeriod,
  ComprehensiveTaxCreditResidencePeriod,
} from '../../shared/ownership'
import type { ComprehensiveResidenceRecognitionRules } from '../../shared/tax-rules'
import {
  addRecognitionCalendarMonths,
  elapsedRecognitionCalendarYears,
  meetsMinimumRecognitionCalendarYears,
  parseRecognitionCalendarDate,
} from './residence-recognition-calendar'
import {
  assertValidUnavoidableReason,
  getUnavoidableReasonMissingInput,
  qualifiesUnavoidableDestination,
  qualifiesUnavoidableReason,
} from './unavoidable-relocation-reason'

const ZERO_YEARS = 0

const createCreditPeriod = (
  actualPeriod: ActualResidencePeriod,
  recognizedYears: number,
): ComprehensiveTaxCreditResidencePeriod => ({
  basis: 'comprehensiveTaxCreditResidence',
  actualYears: actualPeriod.years,
  recognizedYears,
  years: actualPeriod.years + recognizedYears,
})

const getUnavoidableMissingInputs = (
  input: UnavoidableRelocationRecognitionInput,
  rules: ComprehensiveResidenceRecognitionRules,
): readonly ComprehensiveResidenceRecognitionMissingInput[] => {
  const missingInputs: ComprehensiveResidenceRecognitionMissingInput[] = []
  if (input.continuousResidenceStartDate === undefined) {
    missingInputs.push('continuousResidenceStartDate')
  }
  if (input.relocationDate === undefined) {
    missingInputs.push('relocationDate')
  }
  if (input.recognitionEndDate === undefined) {
    missingInputs.push('recognitionEndDate')
  }
  if (input.reason === undefined) {
    missingInputs.push('reason')
  } else {
    const missingReasonInput = getUnavoidableReasonMissingInput(
      input.reason,
      rules,
    )
    if (missingReasonInput !== undefined) {
      missingInputs.push(missingReasonInput)
    }
  }
  if (input.destination === undefined) {
    missingInputs.push('destination')
  }

  return missingInputs
}

const resolveUnavoidableRelocation = (
  actualPeriod: ActualResidencePeriod,
  input: UnavoidableRelocationRecognitionInput,
  rules: ComprehensiveResidenceRecognitionRules,
): ComprehensiveResidenceRecognitionResult => {
  const missingInputs = getUnavoidableMissingInputs(input, rules)
  if (missingInputs.length > 0) {
    return {
      status: 'notComputed',
      kind: input.kind,
      missingInputs,
      creditPeriod: null,
    }
  }

  const residenceStart = parseRecognitionCalendarDate(
    input.continuousResidenceStartDate!,
  )
  const relocationDate = parseRecognitionCalendarDate(input.relocationDate!)
  const recognitionEndDate = parseRecognitionCalendarDate(
    input.recognitionEndDate!,
  )
  const reason = input.reason!
  const destination = input.destination!
  assertValidUnavoidableReason(reason)

  const failedConditions: ComprehensiveResidenceRecognitionFailedCondition[] = []
  if (
    !meetsMinimumRecognitionCalendarYears(
      residenceStart,
      relocationDate,
      rules.minimumContinuousResidenceYears,
    )
  ) {
    failedConditions.push('minimumContinuousResidence')
  }
  if (!qualifiesUnavoidableReason(reason, rules)) {
    failedConditions.push('qualifyingReason')
  }
  if (!qualifiesUnavoidableDestination(reason, destination)) {
    failedConditions.push('qualifyingDestination')
  }

  if (failedConditions.length > 0) {
    return {
      status: 'notQualified',
      kind: input.kind,
      failedConditions,
      creditPeriod: createCreditPeriod(actualPeriod, ZERO_YEARS),
    }
  }

  const recognizedYears = Math.min(
    elapsedRecognitionCalendarYears(relocationDate, recognitionEndDate),
    rules.unavoidableRelocationMaximumYears,
  )
  return {
    status: 'computed',
    kind: input.kind,
    creditPeriod: createCreditPeriod(actualPeriod, recognizedYears),
  }
}

const resolveRedevelopmentConstruction = (
  actualPeriod: ActualResidencePeriod,
  input: Extract<
    ComprehensiveResidenceRecognitionInput,
    { readonly kind: 'redevelopmentConstruction' }
  >,
  rules: ComprehensiveResidenceRecognitionRules,
): ComprehensiveResidenceRecognitionResult => {
  const missingInputs: ComprehensiveResidenceRecognitionMissingInput[] = []
  if (input.continuousResidenceStartDate === undefined) {
    missingInputs.push('continuousResidenceStartDate')
  }
  if (input.managementDispositionApprovalDate === undefined) {
    missingInputs.push('managementDispositionApprovalDate')
  }
  if (input.occupancyAvailableDate === undefined) {
    missingInputs.push('occupancyAvailableDate')
  }
  if (input.demolitionBeforeApproval === undefined) {
    missingInputs.push('demolitionBeforeApproval')
  } else if (
    input.demolitionBeforeApproval.kind === 'demolishedBeforeApproval' &&
    input.demolitionBeforeApproval.demolitionDate === undefined
  ) {
    missingInputs.push('demolitionDate')
  }
  if (missingInputs.length > 0) {
    return {
      status: 'notComputed',
      kind: input.kind,
      missingInputs,
      creditPeriod: null,
    }
  }

  const residenceStart = parseRecognitionCalendarDate(
    input.continuousResidenceStartDate!,
  )
  const approvalDate = parseRecognitionCalendarDate(
    input.managementDispositionApprovalDate!,
  )
  const occupancyAvailableDate = parseRecognitionCalendarDate(
    input.occupancyAvailableDate!,
  )
  const demolition = input.demolitionBeforeApproval!
  const continuousResidenceReference =
    demolition.kind === 'demolishedBeforeApproval'
      ? addRecognitionCalendarMonths(
          parseRecognitionCalendarDate(demolition.demolitionDate!),
          -rules.demolitionReferenceMonthsBefore,
        )
      : approvalDate

  if (
    !meetsMinimumRecognitionCalendarYears(
      residenceStart,
      continuousResidenceReference,
      rules.minimumContinuousResidenceYears,
    )
  ) {
    return {
      status: 'notQualified',
      kind: input.kind,
      failedConditions: ['minimumContinuousResidence'],
      creditPeriod: createCreditPeriod(actualPeriod, ZERO_YEARS),
    }
  }

  const recognizedYears =
    elapsedRecognitionCalendarYears(approvalDate, occupancyAvailableDate) *
    rules.constructionRecognitionRate
  return {
    status: 'computed',
    kind: input.kind,
    creditPeriod: createCreditPeriod(actualPeriod, recognizedYears),
  }
}

const RECOGNITION_RESOLVER_BY_KIND = {
  unavoidableRelocation: resolveUnavoidableRelocation,
  redevelopmentConstruction: resolveRedevelopmentConstruction,
} as const

export const calculateComprehensiveResidenceRecognition = (
  actualPeriod: ActualResidencePeriod,
  input: ComprehensiveResidenceRecognitionInput | undefined,
  rules: ComprehensiveResidenceRecognitionRules | null,
): ComprehensiveResidenceRecognitionResult => {
  if (rules === null) {
    return {
      status: 'notEffective',
      creditPeriod: createCreditPeriod(actualPeriod, ZERO_YEARS),
    }
  }

  if (input === undefined) {
    return {
      status: 'notRequested',
      creditPeriod: createCreditPeriod(actualPeriod, ZERO_YEARS),
    }
  }

  const resolver = RECOGNITION_RESOLVER_BY_KIND[input.kind] as (
    actual: ActualResidencePeriod,
    claim: typeof input,
    recognitionRules: ComprehensiveResidenceRecognitionRules,
  ) => ComprehensiveResidenceRecognitionResult
  return resolver(actualPeriod, input, rules)
}
