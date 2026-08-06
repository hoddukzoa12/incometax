import type {
  ComprehensiveResidenceRecognitionMissingInput,
  RelocationDestination,
  UnavoidableRelocationReason,
} from '../../shared/comprehensive-residence-recognition'
import type { ComprehensiveResidenceRecognitionRules } from '../../shared/tax-rules'

const ZERO_VALUE = 0
const INVALID_REASON_DETAIL_MESSAGE =
  'Residence-recognition reason details must be finite non-negative values'

type ReasonKind = UnavoidableRelocationReason['kind']

type ConditionResolution =
  | { readonly status: 'resolved'; readonly qualifies: boolean }
  | {
      readonly status: 'missing'
      readonly input: ComprehensiveResidenceRecognitionMissingInput
    }

interface ReasonFacts {
  readonly requiredTreatmentYears: number | undefined
  readonly directAncestorAge: number | undefined
}

const resolvedCondition = (qualifies: boolean): ConditionResolution => ({
  status: 'resolved',
  qualifies,
})

const missingCondition = (
  input: ComprehensiveResidenceRecognitionMissingInput,
): ConditionResolution => ({ status: 'missing', input })

const REASON_CONDITION_BY_KIND = {
  highSchoolOrUniversityEnrollment: (): ConditionResolution =>
    resolvedCondition(true),
  jobChangeOrTransfer: (): ConditionResolution => resolvedCondition(true),
  medicalTreatmentOrCare: (
    facts: ReasonFacts,
    rules: ComprehensiveResidenceRecognitionRules,
  ): ConditionResolution =>
    facts.requiredTreatmentYears === undefined
      ? missingCondition('requiredTreatmentYears')
      : resolvedCondition(
          facts.requiredTreatmentYears >=
            rules.medicalTreatmentMinimumYears,
        ),
  schoolViolenceTransfer: (): ConditionResolution =>
    resolvedCondition(true),
  overseasStudyOrEmployment: (): ConditionResolution =>
    resolvedCondition(true),
  supportDirectAncestor: (
    facts: ReasonFacts,
    rules: ComprehensiveResidenceRecognitionRules,
  ): ConditionResolution =>
    facts.directAncestorAge === undefined
      ? missingCondition('directAncestorAge')
      : resolvedCondition(
          facts.directAncestorAge >= rules.directAncestorMinimumAge,
        ),
  similarUnavoidableReason: (): ConditionResolution =>
    resolvedCondition(true),
} as const satisfies Readonly<
  Record<
    ReasonKind,
    (
      facts: ReasonFacts,
      rules: ComprehensiveResidenceRecognitionRules,
    ) => ConditionResolution
  >
>

const DESTINATION_MODE_BY_REASON = {
  highSchoolOrUniversityEnrollment: 'domestic',
  jobChangeOrTransfer: 'domestic',
  medicalTreatmentOrCare: 'domestic',
  schoolViolenceTransfer: 'domestic',
  overseasStudyOrEmployment: 'overseas',
  supportDirectAncestor: 'domestic',
  similarUnavoidableReason: 'domestic',
} as const satisfies Readonly<Record<ReasonKind, 'domestic' | 'overseas'>>

const QUALIFYING_DESTINATIONS = {
  domestic: new Set<RelocationDestination>([
    'otherCityOrCounty',
    'qualifyingUrbanRuralAreaMove',
  ]),
  overseas: new Set<RelocationDestination>(['overseas']),
} as const

const getReasonFacts = (
  reason: UnavoidableRelocationReason,
): ReasonFacts => ({
  requiredTreatmentYears:
    reason.kind === 'medicalTreatmentOrCare'
      ? reason.requiredTreatmentYears
      : undefined,
  directAncestorAge:
    reason.kind === 'supportDirectAncestor'
      ? reason.directAncestorAge
      : undefined,
})

const resolveReasonCondition = (
  reason: UnavoidableRelocationReason,
  rules: ComprehensiveResidenceRecognitionRules,
): ConditionResolution =>
  REASON_CONDITION_BY_KIND[reason.kind](getReasonFacts(reason), rules)

export const getUnavoidableReasonMissingInput = (
  reason: UnavoidableRelocationReason,
  rules: ComprehensiveResidenceRecognitionRules,
): ComprehensiveResidenceRecognitionMissingInput | undefined => {
  const resolution = resolveReasonCondition(reason, rules)
  return resolution.status === 'missing' ? resolution.input : undefined
}

export const assertValidUnavoidableReason = (
  reason: UnavoidableRelocationReason,
): void => {
  const facts = getReasonFacts(reason)
  const values = [facts.requiredTreatmentYears, facts.directAncestorAge]
    .filter((value): value is number => value !== undefined)
  if (
    values.some(
      (value) => !Number.isFinite(value) || value < ZERO_VALUE,
    )
  ) {
    throw new RangeError(INVALID_REASON_DETAIL_MESSAGE)
  }
}

export const qualifiesUnavoidableReason = (
  reason: UnavoidableRelocationReason,
  rules: ComprehensiveResidenceRecognitionRules,
): boolean => {
  const resolution = resolveReasonCondition(reason, rules)
  return resolution.status === 'resolved' && resolution.qualifies
}

export const qualifiesUnavoidableDestination = (
  reason: UnavoidableRelocationReason,
  destination: RelocationDestination,
): boolean => {
  const destinationMode = DESTINATION_MODE_BY_REASON[reason.kind]
  return QUALIFYING_DESTINATIONS[destinationMode].has(destination)
}
