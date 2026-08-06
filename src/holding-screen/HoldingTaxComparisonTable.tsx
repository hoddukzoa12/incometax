import { useState } from 'react'

import type { StoredPortfolioItem } from '../../shared/portfolio'
import { HOLDING_TAX_MESSAGES } from '../messages/holding-tax'
import {
  HOLDING_TAX_DEFAULT_YEAR,
  type HoldingTaxComparisonYear,
} from './assessment-calendar'
import type { HoldingTaxYearCalculation } from './calculation'
import { comprehensiveRows } from './comprehensive-table-rows'
import { ComparisonTableRow } from './ComparisonTableRow'
import { formatRate } from './format'
import { propertyRows } from './property-table-rows'
import { TaxTermHelp } from './TaxTermHelp'
import { totalRows } from './total-table-rows'

export function HoldingTaxComparisonTable({
  calculations,
  taxedItems,
}: {
  readonly calculations: readonly HoldingTaxYearCalculation[]
  readonly taxedItems: readonly StoredPortfolioItem[]
}) {
  const [selectedYear, setSelectedYear] =
    useState<HoldingTaxComparisonYear>(HOLDING_TAX_DEFAULT_YEAR)
  const propertyStatements = taxedItems.map((_, itemIndex) =>
    propertyRows(calculations, itemIndex, selectedYear))
  const comprehensiveStatement = comprehensiveRows(
    calculations,
    selectedYear,
  )
  const totalStatement = totalRows(calculations, selectedYear)

  return (
    <section
      className="holding-tax-statement"
      aria-labelledby="holding-tax-statement-title"
    >
      <div className="holding-tax-statement__header">
        <h2 id="holding-tax-statement-title">
          {HOLDING_TAX_MESSAGES.evidenceTitle}
        </h2>
        <div
          className="holding-tax-statement__years"
          role="tablist"
          aria-label={HOLDING_TAX_MESSAGES.yearSelectionLabel}
        >
          {calculations.map(({ year }) => (
            <button
              key={year}
              type="button"
              role="tab"
              aria-selected={year === selectedYear}
              onClick={() => setSelectedYear(year)}
            >
              {HOLDING_TAX_MESSAGES.yearTab(year)}
            </button>
          ))}
        </div>
      </div>

      <div className="holding-tax-table-scroll">
        <table className="holding-tax-table">
          <thead>
            <tr>
              <th scope="col">{HOLDING_TAX_MESSAGES.comparisonItem}</th>
              <th scope="col">{HOLDING_TAX_MESSAGES.statementAmount}</th>
              <th scope="col">{HOLDING_TAX_MESSAGES.comparisonBasis}</th>
            </tr>
          </thead>
          {taxedItems.map((item, itemIndex) => (
            <tbody key={item.id}>
              <tr className="holding-tax-table__section">
                <th scope="rowgroup" colSpan={3}>
                  {HOLDING_TAX_MESSAGES.propertySection(
                    item.complexName,
                    formatRate(item.ownershipShare),
                  )}
                  <TaxTermHelp term="propertyTax" />
                </th>
              </tr>
              {propertyStatements[itemIndex].rows.map((row) => (
                <ComparisonTableRow key={row.label} row={row} />
              ))}
            </tbody>
          ))}
          <tbody>
            <tr className="holding-tax-table__section">
              <th scope="rowgroup" colSpan={3}>
                {HOLDING_TAX_MESSAGES.comprehensiveSection}
                <TaxTermHelp term="comprehensiveTax" />
              </th>
            </tr>
            {comprehensiveStatement.rows.map((row) => (
              <ComparisonTableRow key={row.label} row={row} />
            ))}
          </tbody>
          <tbody>
            <tr className="holding-tax-table__section">
              <th scope="rowgroup" colSpan={3}>
                {HOLDING_TAX_MESSAGES.totalSection}
              </th>
            </tr>
            {totalStatement.rows.map((row) => (
              <ComparisonTableRow key={row.label} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
