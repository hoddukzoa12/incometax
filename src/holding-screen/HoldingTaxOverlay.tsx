import { useEffect, useMemo, useState } from 'react'

import { HOLDING_TAX_MESSAGES } from '../messages/holding-tax'
import type { PortfolioController } from '../portfolio'
import {
  calculatePortfolioHoldingTax,
  getHoldingTaxMissingConditions,
  HOLDING_TAX_COMPARISON_YEARS,
  HOLDING_TAX_FIRST_ASSESSMENT_DATE,
  HOLDING_TAX_PRIOR_PRICE_YEAR,
  type HoldingTaxComparison,
} from './calculation'
import { HoldingTaxComparisonTable } from './HoldingTaxComparisonTable'
import { HoldingTaxConditions } from './HoldingTaxConditions'
import './holding-tax-overlay.css'

const OWNER_BIRTH_DATE_STORAGE_KEY = 'incometax.holdingTax.ownerBirthDate'
const ZERO_SHARE = 0

const restoreOwnerBirthDate = (): string => {
  try {
    return window.localStorage.getItem(OWNER_BIRTH_DATE_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

const persistOwnerBirthDate = (birthDate: string): void => {
  try {
    window.localStorage.setItem(OWNER_BIRTH_DATE_STORAGE_KEY, birthDate)
  } catch {
    // localStorage may be unavailable; the current session still works.
  }
}

export function HoldingTaxOverlay({
  controller,
  onClose,
}: {
  readonly controller: PortfolioController
  readonly onClose: () => void
}) {
  const [birthDate, setBirthDate] = useState(restoreOwnerBirthDate)
  const taxedItems = useMemo(
    () => controller.items.filter(
      ({ ownershipShare }) => ownershipShare > ZERO_SHARE,
    ),
    [controller.items],
  )
  const missingConditions = useMemo(
    () => getHoldingTaxMissingConditions(
      taxedItems,
      birthDate || null,
    ),
    [birthDate, taxedItems],
  )
  const [conditionsSubmitted, setConditionsSubmitted] = useState(
    () => taxedItems.length > 0 && missingConditions.length === 0,
  )
  const [conditionsOpen, setConditionsOpen] = useState(
    () => !conditionsSubmitted,
  )
  const comparison = useMemo<HoldingTaxComparison>(() => {
    if (
      controller.items.length > 0 &&
      taxedItems.length > 0 &&
      !conditionsSubmitted
    ) {
      return { status: 'missingConditions', missingConditions }
    }
    return calculatePortfolioHoldingTax(
      controller.items,
      birthDate || null,
    )
  }, [
    birthDate,
    conditionsSubmitted,
    controller.items,
    missingConditions,
    taxedItems.length,
  ])
  const assumptionSummary = comparison.status === 'calculated'
    ? HOLDING_TAX_MESSAGES.assumptionsSummary(
        comparison.calculations.map(({ year }) =>
          HOLDING_TAX_MESSAGES.yearAssumption(
            year,
            comparison.ownerAgeByYear[year],
            comparison.taxedItems.map((item) =>
              HOLDING_TAX_MESSAGES.itemAssumption(
                item.complexName,
                comparison.holdingYearsByItemAndYear[year][item.id],
                item.residenceYears!,
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
    persistOwnerBirthDate(birthDate)
    setConditionsSubmitted(true)
    setConditionsOpen(false)
  }

  return (
    <div
      className="holding-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="holding-overlay-title"
    >
      <header className="holding-overlay__header">
        <div className="holding-overlay__title-row">
          <div>
            <h1 id="holding-overlay-title">{HOLDING_TAX_MESSAGES.title}</h1>
            <p className="holding-overlay__bill-note">
              {HOLDING_TAX_MESSAGES.governmentBillNotice(
                HOLDING_TAX_COMPARISON_YEARS.slice(1),
              )}
            </p>
          </div>
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
        {(conditionsOpen || comparison.status === 'missingConditions') &&
          controller.items.length > 0 && (
            <HoldingTaxConditions
              birthDate={birthDate}
              controller={controller}
              missingConditions={missingConditions}
              referenceDate={HOLDING_TAX_FIRST_ASSESSMENT_DATE}
              onBirthDateChange={setBirthDate}
              onDirty={() => setConditionsSubmitted(false)}
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
            <div className="holding-overlay__model-note" role="note">
              <span>{HOLDING_TAX_MESSAGES.householdCount(
                comparison.householdHomeCount,
              )}</span>
              <span>{HOLDING_TAX_MESSAGES.taxedCount(
                comparison.taxedItems.length,
              )}</span>
              <p>{HOLDING_TAX_MESSAGES.samePriceModelNotice(
                HOLDING_TAX_COMPARISON_YEARS.slice(1),
              )}</p>
            </div>
            <div className="holding-overlay__cap-warning" role="note">
              <p>{HOLDING_TAX_MESSAGES.currentYearCapUnavailable(
                HOLDING_TAX_PRIOR_PRICE_YEAR,
              )}</p>
              {comparison.missingPriorPriceItems.length > 0 && (
                <p>{HOLDING_TAX_MESSAGES.currentYearPriceMissing(
                  HOLDING_TAX_PRIOR_PRICE_YEAR,
                  comparison.missingPriorPriceItems.map(
                    ({ complexName }) => complexName,
                  ),
                )}</p>
              )}
            </div>
            <HoldingTaxComparisonTable
              calculations={comparison.calculations}
              taxedItems={comparison.taxedItems}
            />
          </>
        )}
      </main>
    </div>
  )
}
