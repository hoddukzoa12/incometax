import { HOLDING_TAX_MESSAGES } from '../messages/holding-tax'

export function ConditionChoiceButtons({
  value,
  onChange,
}: {
  readonly value: boolean | null
  readonly onChange: (value: boolean) => void
}) {
  return (
    <div className="holding-conditions__choices">
      <button
        type="button"
        aria-pressed={value === true}
        onClick={() => onChange(true)}
      >
        {HOLDING_TAX_MESSAGES.yes}
      </button>
      <button
        type="button"
        aria-pressed={value === false}
        onClick={() => onChange(false)}
      >
        {HOLDING_TAX_MESSAGES.no}
      </button>
    </div>
  )
}
