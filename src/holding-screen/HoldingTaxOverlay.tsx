import { useEffect, useMemo, useState } from 'react'

import { HOLDING_TAX_MESSAGES } from '../messages/holding-tax'
import type { PortfolioController } from '../portfolio'
import {
  calculatePortfolioHoldingTax,
  getHoldingTaxMissingConditions,
  HOLDING_TAX_PRIOR_PRICE_YEAR,
  type HoldingTaxComparison,
} from './calculation'
import {
  persistHoldingTaxConditionValues,
  restoreHoldingTaxConditionValues,
} from './condition-values'
import { HoldingTaxChangeReasons } from './HoldingTaxChangeReasons'
import { HoldingTaxComparisonTable } from './HoldingTaxComparisonTable'
import { HoldingTaxConditions } from './HoldingTaxConditions'
import { HoldingTaxResultSummary } from './HoldingTaxResultSummary'
import { formatCompactDate } from './format'
import './holding-tax-overlay.css'

const ZERO_SHARE = 0

export function HoldingTaxOverlay({
  controller,
  onClose,
}: {
  readonly controller: PortfolioController
  readonly onClose: () => void
}) {
  const [conditions, setConditions] = useState(() =>
    restoreHoldingTaxConditionValues(controller.items))
  const taxedItems = useMemo(
    () => controller.items.filter(
      ({ ownershipShare }) => ownershipShare > ZERO_SHARE,
    ),
    [controller.items],
  )
  const missingConditions = useMemo(
    () => getHoldingTaxMissingConditions(
      taxedItems,
      conditions,
    ),
    [conditions, taxedItems],
  )
  const [conditionsOpen, setConditionsOpen] = useState(
    () => !(taxedItems.length > 0 && missingConditions.length === 0),
  )
  const [reasonsOpen, setReasonsOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const comparison = useMemo<HoldingTaxComparison>(() =>
    calculatePortfolioHoldingTax(controller.items, conditions), [
    conditions,
    controller.items,
  ])
  const assumptionSummary = comparison.status === 'calculated'
    ? HOLDING_TAX_MESSAGES.assumptionsSummary(
        comparison.calculations.map(({ year, input }) =>
          HOLDING_TAX_MESSAGES.yearAssumption(
            year,
            comparison.ownerAgeByYear[year],
            comparison.taxedItems.map((item, itemIndex) =>
              HOLDING_TAX_MESSAGES.itemAssumption(
                item.complexName,
                comparison.holdingYearsByItemAndYear[year][item.id],
                input.items[itemIndex].residenceYears,
              )),
          )),
      )
    : null

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const submitConditions = () => {
    if (missingConditions.length > 0) return
    try {
      persistHoldingTaxConditionValues(conditions)
    } catch {
      // The calculation remains usable for the current session.
    }
    setConditionsOpen(false)
  }

  const priceAssumptions = taxedItems.map((item) =>
    `${item.complexName} ${item.officialPriceBaseDate === null
      ? HOLDING_TAX_MESSAGES.officialPriceBaseDateMissing
      : formatCompactDate(item.officialPriceBaseDate)}`)
  const continuingResidenceItems = taxedItems.filter((item) =>
    conditions.items[item.id]?.continuesResidence === true)
  const frozenResidenceItems = taxedItems.filter((item) =>
    item.residency === 'nonResiding' ||
    conditions.items[item.id]?.continuesResidence === false)
  const recognitionItems = frozenResidenceItems.filter((item) =>
    conditions.items[item.id]?.qualifyingRelocation === true)

  return (
    <div
      className="holding-overlay"
      aria-labelledby="holding-overlay-title"
    >
      <header className="holding-overlay__header">
        <div className="holding-overlay__title-row">
          <h1 id="holding-overlay-title">{HOLDING_TAX_MESSAGES.title}</h1>
          <button type="button" autoFocus onClick={onClose}>
            {HOLDING_TAX_MESSAGES.close}
          </button>
        </div>

        {assumptionSummary !== null && (
          <section
            className="holding-assumptions"
            aria-labelledby="holding-assumptions-title"
          >
            <div className="holding-assumptions__summary">
              <div>
                <strong id="holding-assumptions-title">
                  {HOLDING_TAX_MESSAGES.assumptionsTitle}
                </strong>
                <p>{assumptionSummary}</p>
              </div>
              <button
                type="button"
                aria-expanded={conditionsOpen}
                onClick={() => setConditionsOpen((current) => !current)}
              >
                {conditionsOpen
                  ? HOLDING_TAX_MESSAGES.assumptionsDone
                  : HOLDING_TAX_MESSAGES.assumptionsChange}
              </button>
            </div>
          </section>
        )}
      </header>

      <main className="holding-overlay__content">
        {(conditionsOpen ||
          comparison.status === 'missingConditions' ||
          comparison.status === 'missingOfficialPrices') &&
          controller.items.length > 0 && (
            <HoldingTaxConditions
              conditions={conditions}
              controller={controller}
              missingConditions={missingConditions}
              onChange={setConditions}
              onSubmit={submitConditions}
            />
          )}

        {comparison.status === 'empty' && (
          <section className="holding-overlay__status">
            <h2>{HOLDING_TAX_MESSAGES.emptyTitle}</h2>
            <p>{HOLDING_TAX_MESSAGES.emptyDescription}</p>
          </section>
        )}
        {comparison.status === 'noTaxedItems' && (
          <section className="holding-overlay__status">
            <h2>{HOLDING_TAX_MESSAGES.noTaxedItemsTitle}</h2>
            <p>{HOLDING_TAX_MESSAGES.noTaxedItemsDescription}</p>
          </section>
        )}
        {comparison.status === 'missingOfficialPrices' && (
          <section className="holding-overlay__status holding-overlay__status--warning">
            <h2>{HOLDING_TAX_MESSAGES.missingPriceTitle}</h2>
            <ul>
              {comparison.missingItems.map((item) => (
                <li key={item.id}>
                  {HOLDING_TAX_MESSAGES.missingPriceReason(item.complexName)}
                </li>
              ))}
            </ul>
          </section>
        )}
        {comparison.status === 'calculated' && !conditionsOpen && (
          <>
            <HoldingTaxResultSummary
              calculations={comparison.calculations}
              detailsOpen={detailsOpen}
              onDetailsToggle={() => setDetailsOpen((current) => !current)}
              onReasonsToggle={() => setReasonsOpen((current) => !current)}
              reasonsOpen={reasonsOpen}
              taxedItems={comparison.taxedItems}
            />
            {reasonsOpen && (
              <HoldingTaxChangeReasons calculations={comparison.calculations} />
            )}
            {detailsOpen && (
              <section className="holding-tax-details" id="holding-tax-details">
                <HoldingTaxComparisonTable
                  calculations={comparison.calculations}
                  taxedItems={comparison.taxedItems}
                />
                <section className="holding-tax-details__assumptions">
                  <h2>{HOLDING_TAX_MESSAGES.assumptionsProseTitle}</h2>
                  <p>{HOLDING_TAX_MESSAGES.portfolioAssumption(
                    comparison.householdHomeCount,
                    comparison.taxedItems.length,
                  )}</p>
                  <p>{HOLDING_TAX_MESSAGES.priceDateAssumption(
                    priceAssumptions,
                  )}</p>
                  {continuingResidenceItems.length > 0 && (
                    <p>{HOLDING_TAX_MESSAGES.continuingResidenceAssumption(
                      continuingResidenceItems.map(({ complexName }) =>
                        complexName),
                    )}</p>
                  )}
                  {frozenResidenceItems.length > 0 && (
                    <p>{HOLDING_TAX_MESSAGES.frozenResidenceAssumption(
                      frozenResidenceItems.map(({ complexName }) =>
                        complexName),
                    )}</p>
                  )}
                  {recognitionItems.length > 0 && (
                    <p>{HOLDING_TAX_MESSAGES.recognitionAssumption(
                      recognitionItems.map(({ complexName }) => complexName),
                    )}</p>
                  )}
                  <p>{HOLDING_TAX_MESSAGES.modeledCapAssumption}</p>
                  {comparison.missingPriorPriceItems.length > 0 && (
                    <p>{HOLDING_TAX_MESSAGES.unavailableCapAssumption(
                      HOLDING_TAX_PRIOR_PRICE_YEAR,
                      comparison.missingPriorPriceItems.map(
                        ({ complexName }) => complexName,
                      ),
                    )}</p>
                  )}
                </section>
                <section className="holding-overlay__cautions">
                  <h2>{HOLDING_TAX_MESSAGES.cautionsTitle}</h2>
                  {HOLDING_TAX_MESSAGES.cautions.map((caution) => (
                    <p key={caution}>{caution}</p>
                  ))}
                </section>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
