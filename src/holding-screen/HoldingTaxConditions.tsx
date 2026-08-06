import type { FormEvent } from 'react'

import type { Residency } from '../../shared/tax-rules'
import { HOLDING_TAX_MESSAGES } from '../messages/holding-tax'
import { PORTFOLIO_MESSAGES } from '../messages/portfolio'
import {
  MAX_OWNERSHIP_PERCENT,
  MIN_OWNERSHIP_PERCENT,
  OWNERSHIP_PERCENT_INPUT_STEP,
  ownershipPercentFromNumber,
  ownershipShareFromPercent,
  ownershipShareToPercent,
  type PortfolioController,
} from '../portfolio'
import type { HoldingTaxMissingCondition } from './calculation'

const ZERO_SHARE = 0
const FULL_OWNERSHIP_PERCENT = 100

const toNonNegativeInteger = (value: string): number | null => {
  if (value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0
    ? Math.trunc(parsed)
    : null
}

const missingConditionMessage = (
  condition: HoldingTaxMissingCondition,
): string => {
  if (condition.kind === 'birthDate') {
    return HOLDING_TAX_MESSAGES.birthDateMissing
  }
  const messageByKind = {
    acquisitionDate: HOLDING_TAX_MESSAGES.acquisitionDateMissing,
    coOwnerHousehold: HOLDING_TAX_MESSAGES.coOwnerHouseholdMissing,
    residenceYears: HOLDING_TAX_MESSAGES.residenceYearsMissing,
    residency: HOLDING_TAX_MESSAGES.residencyMissing,
  } as const
  return messageByKind[condition.kind](condition.item.complexName)
}

export function HoldingTaxConditions({
  birthDate,
  controller,
  missingConditions,
  referenceDate,
  onBirthDateChange,
  onDirty,
  onSubmit,
}: {
  readonly birthDate: string
  readonly controller: PortfolioController
  readonly missingConditions: readonly HoldingTaxMissingCondition[]
  readonly referenceDate: string
  readonly onBirthDateChange: (value: string) => void
  readonly onDirty: () => void
  readonly onSubmit: () => void
}) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form className="holding-conditions" onSubmit={submit}>
      <p className="holding-conditions__intro">
        {HOLDING_TAX_MESSAGES.conditionsIntro}
      </p>
      {missingConditions.length > 0 && (
        <section className="holding-conditions__missing" role="alert">
          <strong>{HOLDING_TAX_MESSAGES.conditionsRequired}</strong>
          <ul>
            {missingConditions.map((condition) => (
              <li key={condition.kind === 'birthDate'
                ? condition.kind
                : `${condition.item.id}:${condition.kind}`}>
                {missingConditionMessage(condition)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <label className="holding-conditions__person">
        <span>{HOLDING_TAX_MESSAGES.birthDateLabel}</span>
        <input
          type="date"
          max={referenceDate}
          required
          value={birthDate}
          onChange={(event) => {
            onBirthDateChange(event.target.value)
            onDirty()
          }}
        />
      </label>

      <div className="holding-conditions__properties">
        {controller.items.map((item) => {
          const sharePercent = ownershipShareToPercent(item.ownershipShare)
          const isTaxed = item.ownershipShare > ZERO_SHARE
          const hasRemainder = sharePercent < FULL_OWNERSHIP_PERCENT

          return (
            <fieldset key={item.id}>
              <legend>
                {HOLDING_TAX_MESSAGES.propertyConditions(item.complexName)}
              </legend>
              <div className="holding-conditions__fields">
                <label>
                  <span>{PORTFOLIO_MESSAGES.ownershipShareLabel}</span>
                  <span className="holding-conditions__share">
                    <input
                      type="number"
                      min={MIN_OWNERSHIP_PERCENT}
                      max={MAX_OWNERSHIP_PERCENT}
                      step={OWNERSHIP_PERCENT_INPUT_STEP}
                      required
                      value={sharePercent}
                      onChange={(event) => {
                        try {
                          const percent = ownershipPercentFromNumber(
                            Number(event.target.value),
                          )
                          const ownershipShare = ownershipShareFromPercent(
                            percent,
                          )
                          controller.setOwnershipShare(item.id, ownershipShare)
                          controller.update(item.id, {
                            isSoleHouseholdOwner:
                              percent === FULL_OWNERSHIP_PERCENT
                                ? true
                                : sharePercent === FULL_OWNERSHIP_PERCENT
                                  ? null
                                  : item.isSoleHouseholdOwner,
                          })
                          onDirty()
                        } catch {
                          return
                        }
                      }}
                    />
                    <span>{PORTFOLIO_MESSAGES.ownershipShareUnit}</span>
                  </span>
                </label>

                {isTaxed && (
                  <>
                    <label>
                      <span>{HOLDING_TAX_MESSAGES.acquisitionDateLabel}</span>
                      <input
                        type="date"
                        max={referenceDate}
                        required
                        value={item.acquisitionDate ?? ''}
                        onChange={(event) => {
                          controller.update(item.id, {
                            acquisitionDate: event.target.value || null,
                          })
                          onDirty()
                        }}
                      />
                    </label>
                    <label>
                      <span>{HOLDING_TAX_MESSAGES.residenceYearsLabel}</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        required
                        value={item.residenceYears ?? ''}
                        onChange={(event) => {
                          const value = event.target.value
                          controller.update(item.id, {
                            residenceYears: toNonNegativeInteger(value),
                          })
                          onDirty()
                        }}
                      />
                    </label>
                    <label>
                      <span>{PORTFOLIO_MESSAGES.residencyLabel}</span>
                      <select
                        required
                        value={item.residency ?? ''}
                        onChange={(event) => {
                          controller.update(item.id, {
                            residency: event.target.value as Residency,
                          })
                          onDirty()
                        }}
                      >
                        <option value="" disabled>
                          {HOLDING_TAX_MESSAGES.residencyPlaceholder}
                        </option>
                        <option value="nonResiding">
                          {PORTFOLIO_MESSAGES.nonResiding}
                        </option>
                        <option value="residing">
                          {PORTFOLIO_MESSAGES.residing}
                        </option>
                      </select>
                    </label>
                    <label>
                      <span>{PORTFOLIO_MESSAGES.areaKindLabel}</span>
                      <select
                        value={item.areaKind}
                        onChange={(event) => {
                          controller.update(item.id, {
                            areaKind: event.target.value as typeof item.areaKind,
                          })
                          onDirty()
                        }}
                      >
                        <option value="general">
                          {PORTFOLIO_MESSAGES.generalArea}
                        </option>
                        <option value="adjusted">
                          {PORTFOLIO_MESSAGES.adjustedArea}
                        </option>
                      </select>
                    </label>
                  </>
                )}
              </div>

              {isTaxed && hasRemainder && (
                <fieldset className="holding-conditions__remainder">
                  <legend>{HOLDING_TAX_MESSAGES.remainderOwnerQuestion}</legend>
                  <label>
                    <input
                      type="radio"
                      name={`remainder-owner-${item.id}`}
                      required
                      checked={item.isSoleHouseholdOwner === false}
                      onChange={() => {
                        controller.update(item.id, {
                          isSoleHouseholdOwner: false,
                        })
                        onDirty()
                      }}
                    />
                    <span>
                      {HOLDING_TAX_MESSAGES.remainderOwnerSameHousehold}
                    </span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      name={`remainder-owner-${item.id}`}
                      required
                      checked={item.isSoleHouseholdOwner === true}
                      onChange={() => {
                        controller.update(item.id, {
                          isSoleHouseholdOwner: true,
                        })
                        onDirty()
                      }}
                    />
                    <span>
                      {HOLDING_TAX_MESSAGES.remainderOwnerOtherHousehold}
                    </span>
                  </label>
                </fieldset>
              )}
            </fieldset>
          )
        })}
      </div>

      <button className="holding-conditions__submit" type="submit">
        {HOLDING_TAX_MESSAGES.conditionsSave}
      </button>
    </form>
  )
}
