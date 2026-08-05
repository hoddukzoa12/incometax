import { SIDEBAR_MESSAGES } from '../messages/sidebar'
import { formatArea } from './format'
import type { TradeAreaOption } from './trade-filter-data'

export function TradeAreaSelect({
  options,
  selectedAreaKey,
  onChange,
}: {
  readonly options: readonly TradeAreaOption[]
  readonly selectedAreaKey: string
  readonly onChange: (areaKey: string) => void
}) {
  if (options.length === 0) return null
  return (
    <label className="trade-area-filter">
      <span>{SIDEBAR_MESSAGES.areaFilterLabel}</span>
      <select
        value={selectedAreaKey}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {formatArea(option.area)} · {option.count}
            {SIDEBAR_MESSAGES.tradeCountSuffix}
          </option>
        ))}
      </select>
    </label>
  )
}
