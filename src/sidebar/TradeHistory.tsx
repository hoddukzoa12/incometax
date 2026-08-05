import { useState } from 'react'

import type { RecentTrade } from '../../shared/trade'
import { SIDEBAR_MESSAGES } from '../messages/sidebar'
import { formatArea, formatFloor, formatWon } from './format'
import { availableTradeYears } from './trade-filter-data'
import './trade.css'

const TRADE_PAGE_SIZE = 6
const ALL_YEARS = 'all'

export function TradeHistory({
  trades,
  areaKey,
}: {
  readonly trades: readonly RecentTrade[]
  readonly areaKey: string
}) {
  const years = availableTradeYears(trades)
  const [requestedYear, setRequestedYear] = useState<{
    readonly areaKey: string
    readonly year: string
  } | null>(null)
  const selectedYear = requestedYear !== null &&
    requestedYear.areaKey === areaKey &&
    years.includes(requestedYear.year)
    ? requestedYear.year
    : ALL_YEARS
  const filteredTrades = selectedYear === ALL_YEARS
    ? trades
    : trades.filter((trade) => trade.dealDate.startsWith(selectedYear))
  const filterKey = `${areaKey}:${selectedYear}`
  const [page, setPage] = useState({ key: '', count: TRADE_PAGE_SIZE })
  const visibleCount = page.key === filterKey ? page.count : TRADE_PAGE_SIZE

  return (
    <section className="complex-sidebar__section">
      <div className="trade-history__heading">
        <h3>{SIDEBAR_MESSAGES.tradesTitle}</h3>
        {years.length > 1 && (
          <label>
            <span>{SIDEBAR_MESSAGES.tradeYearFilterLabel}</span>
            <select
              value={selectedYear}
              onChange={(event) => setRequestedYear({
                areaKey,
                year: event.target.value,
              })}
            >
              <option value={ALL_YEARS}>{SIDEBAR_MESSAGES.allYears}</option>
              {years.map((year) => <option key={year}>{year}</option>)}
            </select>
          </label>
        )}
      </div>
      {trades.length === 0 ? (
        <p className="complex-sidebar__empty">{SIDEBAR_MESSAGES.tradesEmpty}</p>
      ) : (
        <>
          <p className="trade-history__count">
            {filteredTrades.length}{SIDEBAR_MESSAGES.tradeCountSuffix}
          </p>
          <ol className="trade-history">
            {filteredTrades.slice(0, visibleCount).map((trade) => (
              <li key={trade.tradeId}>
                <div>
                  <strong>{formatWon(trade.dealAmount)}</strong>
                  <time dateTime={trade.dealDate}>{trade.dealDate}</time>
                </div>
                <span>
                  {formatArea(trade.exclusiveArea)} · {formatFloor(trade.floor)}
                </span>
              </li>
            ))}
          </ol>
          {filteredTrades.length > visibleCount && (
            <button
              className="complex-sidebar__more"
              type="button"
              onClick={() => setPage({
                key: filterKey,
                count: visibleCount + TRADE_PAGE_SIZE,
              })}
            >
              {SIDEBAR_MESSAGES.moreTrades}
            </button>
          )}
        </>
      )}
    </section>
  )
}
