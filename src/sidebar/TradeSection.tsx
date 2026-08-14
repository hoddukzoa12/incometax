import { useState } from 'react'

import type { RecentTrade } from '../../shared/trade'
import { SHELL_MESSAGES } from '../messages/shell'
import { SIDEBAR_MESSAGES } from '../messages/sidebar'
import { TradeHistory } from './TradeHistory'
import { YearlyTradeChart } from './YearlyTradeChart'
import {
  availableTradeAreas,
  defaultTradeAreaKey,
  filterTradesByArea,
} from './trade-filter-data'
import type { SidebarLoadStatus } from './useSidebarData'

const ALL_YEARS = 'all'
const YEAR_LENGTH = 4

export function TradeSection({
  trades,
  status,
  onRetry,
}: {
  readonly trades: readonly RecentTrade[]
  readonly status: SidebarLoadStatus
  readonly onRetry: () => void
}) {
  const [areaKey, setAreaKey] = useState<string | null>(null)
  const [year, setYear] = useState(ALL_YEARS)
  const areaOptions = availableTradeAreas(trades)
  const selectedAreaKey =
    areaKey !== null && areaOptions.some((option) => option.key === areaKey)
      ? areaKey
      : defaultTradeAreaKey(areaOptions)
  const areaTrades = filterTradesByArea(trades, selectedAreaKey)
  const years = [
    ...new Set(areaTrades.map((trade) => trade.dealDate.slice(0, YEAR_LENGTH))),
  ].sort().reverse()
  const shownTrades = years.includes(year)
    ? areaTrades.filter((trade) => trade.dealDate.slice(0, YEAR_LENGTH) === year)
    : areaTrades

  return (
    <section className="complex-sidebar__section">
      <div className="tradehead">
        <h3>{SHELL_MESSAGES.tradesTitle}</h3>
        {areaOptions.length > 0 && (
          <div className="tradehead__filters">
            <select
              aria-label={SHELL_MESSAGES.tradeYearLabel}
              value={years.includes(year) ? year : ALL_YEARS}
              onChange={(event) => setYear(event.target.value)}
            >
              <option value={ALL_YEARS}>{SHELL_MESSAGES.tradeYearAll}</option>
              {years.map((value) => (
                <option key={value} value={value}>
                  {SHELL_MESSAGES.tradeYearOption(value)}
                </option>
              ))}
            </select>
            <select
              aria-label={SIDEBAR_MESSAGES.areaFilterLabel}
              value={selectedAreaKey}
              onChange={(event) => {
                setAreaKey(event.target.value)
                setYear(ALL_YEARS)
              }}
            >
              {areaOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.area}㎡
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {status === 'loading' && (
        <p className="complex-sidebar__loading" role="status">
          {SIDEBAR_MESSAGES.tradesLoading}
        </p>
      )}
      {status === 'failed' && (
        <div className="complex-sidebar__error" role="alert">
          <p>{SIDEBAR_MESSAGES.tradesFailed}</p>
          <button type="button" onClick={onRetry}>
            {SIDEBAR_MESSAGES.retry}
          </button>
        </div>
      )}

      {status === 'loaded' && (
        <div className="tradebody">
          <TradeHistory trades={shownTrades} areaKey={selectedAreaKey} />
          {areaTrades.length > 0 && (
            <YearlyTradeChart
              trades={areaTrades}
              areaLabel={`${selectedAreaKey}㎡`}
            />
          )}
          <p className="pricenote">{SHELL_MESSAGES.priceNote}</p>
        </div>
      )}
    </section>
  )
}
