import { useState } from 'react'

import type { StoredPortfolioItem } from '../../shared/portfolio'
import { HOLDING_TAX_MESSAGES } from '../messages/holding-tax'
import { AutoFilledFactRow } from './AutoFilledFactRow'
import {
  annualOfficialPriceGrowthPercent,
  annualOfficialPriceGrowthRateFromPercent,
} from './condition-values'
import {
  formatInlineWon,
  formatRate,
  formatSignedApproximateRate,
  formatSignedHistoryRate,
} from './format'
import {
  officialPriceHistorySummary,
  type OfficialPriceHistoryPoint,
  type OfficialPriceHistorySummary,
} from './official-price-growth'

export function OfficialPriceGrowthFact({
  annualGrowthRate,
  items,
  onChange,
}: {
  readonly annualGrowthRate: number
  readonly items: readonly StoredPortfolioItem[]
  readonly onChange: (annualGrowthRate: number) => void
}) {
  const [editing, setEditing] = useState(false)
  return (
    <section className="holding-conditions__facts holding-conditions__growth">
      <h2>{HOLDING_TAX_MESSAGES.officialPriceAssumptionTitle}</h2>
      <AutoFilledFactRow
        label={HOLDING_TAX_MESSAGES.officialPriceGrowthRateLabel}
        value={HOLDING_TAX_MESSAGES.officialPriceGrowthRateValue(
          formatRate(annualGrowthRate),
          annualGrowthRate === 0,
        )}
        editing={editing}
        onEdit={() => setEditing((current) => !current)}
      >
        <label className="holding-conditions__growth-input">
          <span>{HOLDING_TAX_MESSAGES.officialPriceGrowthRateLabel}</span>
          <span>
            {HOLDING_TAX_MESSAGES.annualRatePrefix}
            <input
              type="number"
              min={annualOfficialPriceGrowthPercent.minimum}
              step={annualOfficialPriceGrowthPercent.step}
              value={annualOfficialPriceGrowthPercent.fromRate(
                annualGrowthRate,
              )}
              onChange={(event) => onChange(
                annualOfficialPriceGrowthRateFromPercent(event.target.value),
              )}
            />
            {HOLDING_TAX_MESSAGES.percentUnit}
          </span>
        </label>
      </AutoFilledFactRow>

      {editing && (
        <OfficialPriceHistoryFacts items={items} />
      )}
    </section>
  )
}

export function OfficialPriceHistoryFacts({
  items,
}: {
  readonly items: readonly StoredPortfolioItem[]
}) {
  const histories = items.map(officialPriceHistorySummary)

  return (
    <div className="holding-conditions__price-history">
      <p>{HOLDING_TAX_MESSAGES.officialPriceHistoryDescription}</p>
      {histories.map((history) => (
        <OfficialPriceHistorySection key={history.itemId} history={history} />
      ))}
    </div>
  )
}

function OfficialPriceHistorySection({
  history,
}: {
  readonly history: OfficialPriceHistorySummary
}) {
  const [showAll, setShowAll] = useState(false)
  const points = showAll ? history.points : history.recentPoints
  const hasEarlierHistory = history.points.length > history.recentPoints.length

  return (
    <section>
      <h3>{HOLDING_TAX_MESSAGES.officialPriceHistoryTitle(
        history.complexName,
      )}</h3>
      {history.points.length === 0 ? (
        <p>{HOLDING_TAX_MESSAGES.officialPriceHistoryUnavailable}</p>
      ) : (
        <>
          <OfficialPriceHistorySummaryLine history={history} />
          <OfficialPriceHistoryList points={points} />
          {hasEarlierHistory && (
            <button
              className="holding-conditions__price-history-toggle"
              type="button"
              aria-expanded={showAll}
              onClick={() => setShowAll((current) => !current)}
            >
              {showAll
                ? HOLDING_TAX_MESSAGES.officialPriceHistoryClose
                : HOLDING_TAX_MESSAGES.officialPriceHistoryOpen}
            </button>
          )}
        </>
      )}
    </section>
  )
}

function OfficialPriceHistorySummaryLine({
  history,
}: {
  readonly history: OfficialPriceHistorySummary
}) {
  if (history.recentCompoundAnnualGrowthRate === null) {
    return (
      <p>{HOLDING_TAX_MESSAGES.officialPriceHistorySummaryUnavailable(
        history.points.length,
      )}</p>
    )
  }

  const formatExtremum = (
    point: OfficialPriceHistoryPoint | null,
    unavailable: string,
  ): string => {
    if (point === null || point.changeRate === null) return unavailable
    return HOLDING_TAX_MESSAGES.officialPriceHistoryExtremum(
      point.year,
      formatSignedHistoryRate(point.changeRate),
    )
  }

  return (
    <p className="holding-conditions__price-history-summary">
      {HOLDING_TAX_MESSAGES.officialPriceHistorySummary(
        history.recentElapsedYears,
        formatSignedApproximateRate(
          history.recentCompoundAnnualGrowthRate,
        ),
        formatExtremum(
          history.highestRise,
          HOLDING_TAX_MESSAGES.officialPriceHistoryNoRise,
        ),
        formatExtremum(
          history.deepestFall,
          HOLDING_TAX_MESSAGES.officialPriceHistoryNoFall,
        ),
      )}
    </p>
  )
}

function OfficialPriceHistoryList({
  points,
}: {
  readonly points: readonly OfficialPriceHistoryPoint[]
}) {
  return (
    <ol>
      {points.map((point) => (
        <li key={point.year}>
          {point.changeRate === null
            ? HOLDING_TAX_MESSAGES.officialPriceHistoryStart(
                point.year,
                formatInlineWon(point.price),
              )
            : HOLDING_TAX_MESSAGES.officialPriceHistoryChange(
                point.year,
                formatInlineWon(point.price),
                formatSignedHistoryRate(point.changeRate),
              )}
        </li>
      ))}
    </ol>
  )
}
