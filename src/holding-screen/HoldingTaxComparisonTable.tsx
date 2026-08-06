import type { StoredPortfolioItem } from '../../shared/portfolio'
import { HOLDING_TAX_MESSAGES } from '../messages/holding-tax'
import type { HoldingTaxYearCalculation } from './calculation'
import { comprehensiveRows } from './comprehensive-table-rows'
import { ComparisonTableRow } from './ComparisonTableRow'
import {
  comparisonValues,
  type TableRow,
} from './comparison-table-values'
import { formatNullableWon, formatRate, formatWon } from './format'
import { propertyRows } from './property-table-rows'
import { TaxTermHelp } from './TaxTermHelp'

export function HoldingTaxComparisonTable({
  calculations,
  taxedItems,
}: {
  readonly calculations: readonly HoldingTaxYearCalculation[]
  readonly taxedItems: readonly StoredPortfolioItem[]
}) {
  const totals: readonly TableRow[] = [
    {
      label: HOLDING_TAX_MESSAGES.propertyTaxTotalAll,
      basis: HOLDING_TAX_MESSAGES.basisSum,
      values: comparisonValues(
        calculations,
        ({ result }) => result.propertyTaxTotal,
        formatWon,
      ),
    },
    {
      label: HOLDING_TAX_MESSAGES.comprehensiveTaxTotal,
      basis: HOLDING_TAX_MESSAGES.basisSum,
      values: comparisonValues(
        calculations,
        ({ result }) => result.comprehensiveTax.totalTax,
        (value) => formatNullableWon(value, HOLDING_TAX_MESSAGES.unavailable),
      ),
    },
    {
      label: HOLDING_TAX_MESSAGES.holdingTaxTotal,
      basis: HOLDING_TAX_MESSAGES.basisSum,
      values: comparisonValues(
        calculations,
        ({ result }) => result.totalTax,
        (value) => formatNullableWon(
          value,
          HOLDING_TAX_MESSAGES.totalUnavailable,
        ),
      ),
      strong: true,
    },
  ]

  return (
    <div className="holding-tax-table-scroll">
      <table className="holding-tax-table">
        <thead>
          <tr>
            <th scope="col">{HOLDING_TAX_MESSAGES.comparisonItem}</th>
            {calculations.map(({ year }, yearIndex) => (
              <th scope="col" key={year}>
                {HOLDING_TAX_MESSAGES.yearLabel(year, yearIndex === 0)}
              </th>
            ))}
            <th scope="col">{HOLDING_TAX_MESSAGES.comparisonBasis}</th>
          </tr>
        </thead>
        {taxedItems.map((item, itemIndex) => (
          <tbody key={item.id}>
            <tr className="holding-tax-table__section">
              <th scope="rowgroup" colSpan={calculations.length + 2}>
                {HOLDING_TAX_MESSAGES.propertySection(
                  item.complexName,
                  formatRate(item.ownershipShare),
                )}
                <TaxTermHelp term="propertyTax" />
              </th>
            </tr>
            {propertyRows(calculations, itemIndex).map((row) => (
              <ComparisonTableRow key={row.label} row={row} />
            ))}
          </tbody>
        ))}
        <tbody>
          <tr className="holding-tax-table__section">
            <th scope="rowgroup" colSpan={calculations.length + 2}>
              {HOLDING_TAX_MESSAGES.comprehensiveSection}
              <TaxTermHelp term="comprehensiveTax" />
            </th>
          </tr>
          {comprehensiveRows(calculations).map((row) => (
            <ComparisonTableRow key={row.label} row={row} />
          ))}
        </tbody>
        <tbody>
          <tr className="holding-tax-table__section">
            <th scope="rowgroup" colSpan={calculations.length + 2}>
              {HOLDING_TAX_MESSAGES.totalSection}
            </th>
          </tr>
          {totals.map((row) => (
            <ComparisonTableRow key={row.label} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
