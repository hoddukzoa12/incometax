import { HOLDING_TAX_MESSAGES } from '../messages/holding-tax'
import type { HoldingTaxYearCalculation } from './calculation'
import { formatInlineWon } from './format'
import { holdingTaxChangeRows } from './holding-tax-change-rows'

export function HoldingTaxChangeReasons({
  calculations,
}: {
  readonly calculations: readonly HoldingTaxYearCalculation[]
}) {
  const rows = holdingTaxChangeRows(calculations)

  return (
    <section
      className="holding-tax-changes"
      id="holding-tax-change-reasons"
      aria-labelledby="holding-tax-change-reasons-title"
    >
      <h2 id="holding-tax-change-reasons-title">
        {HOLDING_TAX_MESSAGES.changeReasonsTitle}
      </h2>
      <ul>
        {rows.map((row) => (
          <li key={row.key}>
            <strong>{row.label}</strong>
            <div>
              <b>{row.contribution < 0
                ? HOLDING_TAX_MESSAGES.changeContributionDecrease(
                    formatInlineWon(Math.abs(row.contribution)),
                  )
                : HOLDING_TAX_MESSAGES.changeContributionIncrease(
                    formatInlineWon(row.contribution),
                  )}</b>
              <span>{HOLDING_TAX_MESSAGES.changeTransition(
                row.fromYear,
                row.fromValue,
                row.toYear,
                row.toValue,
              )}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
