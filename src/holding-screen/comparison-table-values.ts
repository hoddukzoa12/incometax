import type { HoldingTaxHelpTerm } from '../messages/holding-tax'

export type StatementValue = number | null

export type TableRow = {
  readonly label: string
  readonly amount: string
  readonly basis: string
  readonly helpTerm?: HoldingTaxHelpTerm
  readonly strong?: boolean
}

export type StatementRowCandidate = Omit<TableRow, 'amount'> & {
  readonly values: readonly StatementValue[]
  readonly duplicateOf?: readonly StatementValue[]
  readonly format: (value: StatementValue) => string
}

export type StatementRows = {
  readonly rows: readonly TableRow[]
  readonly hiddenCount: number
}

const ZERO_AMOUNT = 0

const hasNoInformation = (value: StatementValue): boolean =>
  value === null || value === ZERO_AMOUNT

const equalAcrossYears = (
  values: readonly StatementValue[],
  comparison: readonly StatementValue[],
): boolean => values.length === comparison.length &&
  values.every((value, index) => value === comparison[index])

export const statementRows = (
  candidates: readonly StatementRowCandidate[],
  selectedIndex: number,
): StatementRows => {
  const rows = candidates.flatMap((candidate): readonly TableRow[] => {
    const emptyAcrossYears = candidate.values.every(hasNoInformation)
    const duplicatesPriorRow = candidate.duplicateOf !== undefined &&
      equalAcrossYears(candidate.values, candidate.duplicateOf)
    if (emptyAcrossYears || duplicatesPriorRow) return []

    return [{
      label: candidate.label,
      amount: candidate.format(candidate.values[selectedIndex] ?? null),
      basis: candidate.basis,
      helpTerm: candidate.helpTerm,
      strong: candidate.strong,
    }]
  })

  return {
    rows,
    hiddenCount: candidates.length - rows.length,
  }
}
