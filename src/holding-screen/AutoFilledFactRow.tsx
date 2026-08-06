import type { ReactNode } from 'react'

import { HOLDING_TAX_MESSAGES } from '../messages/holding-tax'

export function AutoFilledFactRow({
  label,
  help,
  value,
  editing,
  onEdit,
  children,
}: {
  readonly label: string
  readonly help?: ReactNode
  readonly value: string
  readonly editing: boolean
  readonly onEdit?: () => void
  readonly children: ReactNode
}) {
  return (
    <div className="holding-conditions__fact">
      <div>
        <span>{label}</span>
        {help}
        <small>{HOLDING_TAX_MESSAGES.automaticFact}</small>
      </div>
      {editing ? children : <strong>{value}</strong>}
      {onEdit !== undefined && (
        <button type="button" onClick={onEdit}>
          {editing
            ? HOLDING_TAX_MESSAGES.finishEditingFact
            : HOLDING_TAX_MESSAGES.editFact}
        </button>
      )}
    </div>
  )
}
