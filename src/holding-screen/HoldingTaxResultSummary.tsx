import type { StoredPortfolioItem } from '../../shared/portfolio'
import { formatInlineWon, formatNullableWon } from '../format/won'
import { HOLDING_TAX_MESSAGES } from '../messages/holding-tax'
import { HOLDING_TAX_DEFAULT_YEAR } from './assessment-calendar'
import type { HoldingTaxYearCalculation } from './calculation'
import {
  formatCompactDate,
} from './format'

const ZERO_CHANGE = 0

const changeMessage = (change: number | null): string => {
  if (change === null) return HOLDING_TAX_MESSAGES.changeUnavailable
  if (change === ZERO_CHANGE) return HOLDING_TAX_MESSAGES.changeSame
  if (change < ZERO_CHANGE) {
    return HOLDING_TAX_MESSAGES.changeDecrease(
      formatInlineWon(Math.abs(change)),
    )
  }
  return HOLDING_TAX_MESSAGES.changeIncrease(formatInlineWon(change))
}

const priceBasis = (items: readonly StoredPortfolioItem[]): string => {
  const dates = [...new Set(items.map(({ officialPriceBaseDate }) =>
    officialPriceBaseDate).filter((date): date is string => date !== null))]
    .map(formatCompactDate)
  if (dates.length === 0) return HOLDING_TAX_MESSAGES.priceBasisUnknown
  return HOLDING_TAX_MESSAGES.priceBasisMultiple(dates)
}

export function HoldingTaxResultSummary({
  calculations,
  detailsOpen,
  onDetailsToggle,
  onReasonsToggle,
  reasonsOpen,
  taxedItems,
}: {
  readonly calculations: readonly HoldingTaxYearCalculation[]
  readonly detailsOpen: boolean
  readonly onDetailsToggle: () => void
  readonly onReasonsToggle: () => void
  readonly reasonsOpen: boolean
  readonly taxedItems: readonly StoredPortfolioItem[]
}) {
  const current = calculations[0]
  const target = calculations.find(
    ({ year }) => year === HOLDING_TAX_DEFAULT_YEAR,
  ) ?? current
  const last = calculations.at(-1) ?? target
  const basis = priceBasis(taxedItems)
  const change = current.result.totalTax === null ||
    target.result.totalTax === null
    ? null
    : target.result.totalTax - current.result.totalTax

  return (
    <section
      className="holding-result-summary"
      aria-labelledby="holding-result-summary-title"
    >
      <p className="holding-result-summary__eyebrow">
        {HOLDING_TAX_MESSAGES.headlineTitle(target.year)}
      </p>
      <h2 id="holding-result-summary-title">
        {formatNullableWon(
          target.result.totalTax,
          HOLDING_TAX_MESSAGES.headlineUnavailable,
        )}
      </h2>
      <p className="holding-result-summary__change">
        {changeMessage(change)}
      </p>
      <p className="holding-result-summary__comparison">
        {HOLDING_TAX_MESSAGES.comparisonSnapshot(
          current.year,
          formatNullableWon(
            current.result.totalTax,
            HOLDING_TAX_MESSAGES.headlineUnavailable,
          ),
          last.year,
          formatNullableWon(
            last.result.totalTax,
            HOLDING_TAX_MESSAGES.headlineUnavailable,
          ),
        )}
      </p>
      <p className="holding-result-summary__basis">
        {HOLDING_TAX_MESSAGES.headlineBasis(basis, false)}
      </p>
      <div className="holding-result-summary__actions">
        <button
          type="button"
          aria-expanded={reasonsOpen}
          aria-controls="holding-tax-change-reasons"
          onClick={onReasonsToggle}
        >
          {reasonsOpen
            ? HOLDING_TAX_MESSAGES.changeReasonsClose
            : HOLDING_TAX_MESSAGES.changeReasonsOpen(change)}
        </button>
        <button
          type="button"
          aria-expanded={detailsOpen}
          aria-controls="holding-tax-details"
          onClick={onDetailsToggle}
        >
          {detailsOpen
            ? HOLDING_TAX_MESSAGES.evidenceClose
            : HOLDING_TAX_MESSAGES.evidenceOpen}
        </button>
      </div>
      <p className="holding-result-summary__disclaimer">
        {HOLDING_TAX_MESSAGES.resultCardDisclaimer}
      </p>
    </section>
  )
}
