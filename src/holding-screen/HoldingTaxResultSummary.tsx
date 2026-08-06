import type { StoredPortfolioItem } from '../../shared/portfolio'
import { HOLDING_TAX_MESSAGES } from '../messages/holding-tax'
import type { HoldingTaxYearCalculation } from './calculation'
import { formatCompactDate, formatNullableWon } from './format'

const priceBasis = (items: readonly StoredPortfolioItem[]): string => {
  const dates = [...new Set(items.map(({ officialPriceBaseDate }) =>
    officialPriceBaseDate).filter((date): date is string => date !== null))]
    .map(formatCompactDate)
  if (dates.length === 0) return HOLDING_TAX_MESSAGES.priceBasisUnknown
  return HOLDING_TAX_MESSAGES.priceBasisMultiple(dates)
}

export function HoldingTaxResultSummary({
  calculations,
  taxedItems,
}: {
  readonly calculations: readonly HoldingTaxYearCalculation[]
  readonly taxedItems: readonly StoredPortfolioItem[]
}) {
  const basis = priceBasis(taxedItems)

  return (
    <section className="holding-result-summary">
      <div className="holding-result-summary__cards">
        {calculations.map(({ year, result }, yearIndex) => (
          <article key={year}>
            <h2>{HOLDING_TAX_MESSAGES.headlineTitle(year)}</h2>
            <strong>{formatNullableWon(
              result.totalTax,
              HOLDING_TAX_MESSAGES.headlineUnavailable,
            )}</strong>
            <p>{HOLDING_TAX_MESSAGES.headlineBasis(
              basis,
              yearIndex === 0,
            )}</p>
          </article>
        ))}
      </div>
      <p className="holding-result-summary__disclaimer">
        {HOLDING_TAX_MESSAGES.resultCardDisclaimer}
      </p>
    </section>
  )
}
