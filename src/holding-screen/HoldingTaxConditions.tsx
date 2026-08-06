import { useState, type FormEvent } from 'react'

import type { Residency } from '../../shared/tax-rules'
import { HOLDING_TAX_MESSAGES } from '../messages/holding-tax'
import type { PortfolioController } from '../portfolio'
import { AutoFilledPropertyFacts } from './AutoFilledPropertyFacts'
import type { HoldingTaxMissingCondition } from './calculation'
import { ConditionChoiceButtons } from './ConditionChoiceButtons'
import {
  MINIMUM_AGE_CREDIT_YEARS,
  MINIMUM_HOLDING_CREDIT_YEARS,
  MINIMUM_RESIDENCE_CREDIT_YEARS,
  type HoldingTaxConditionValues,
  type HoldingTaxItemConditionValues,
} from './condition-values'
import { OfficialPriceGrowthFact } from './OfficialPriceGrowthFact'
const ZERO_VALUE = 0
const ZERO_SHARE = 0

const toNonNegativeInteger = (value: string): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= ZERO_VALUE
    ? Math.trunc(parsed)
    : ZERO_VALUE
}

const missingConditionMessage = (
  condition: HoldingTaxMissingCondition,
): string => {
  const messageByKind = {
    continuesResidence: HOLDING_TAX_MESSAGES.continuesResidenceMissing,
    qualifyingRelocation: HOLDING_TAX_MESSAGES.qualifyingRelocationMissing,
    residency: HOLDING_TAX_MESSAGES.residencyMissing,
  } as const
  return messageByKind[condition.kind](condition.item.complexName)
}

export function HoldingTaxConditions({
  conditions,
  controller,
  missingConditions,
  onChange,
  onSubmit,
}: {
  readonly conditions: HoldingTaxConditionValues
  readonly controller: PortfolioController
  readonly missingConditions: readonly HoldingTaxMissingCondition[]
  readonly onChange: (conditions: HoldingTaxConditionValues) => void
  readonly onSubmit: () => void
}) {
  const [exactPeriodsOpen, setExactPeriodsOpen] = useState(false)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit()
  }

  const changeConditions = (next: HoldingTaxConditionValues) => {
    onChange(next)
  }

  const updateItemConditions = (
    itemId: string,
    update: Partial<HoldingTaxItemConditionValues>,
  ) => {
    changeConditions({
      ...conditions,
      items: {
        ...conditions.items,
        [itemId]: { ...conditions.items[itemId], ...update },
      },
    })
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
              <li key={`${condition.item.id}:${condition.kind}`}>
                {missingConditionMessage(condition)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="holding-conditions__owner">
        <h2>{HOLDING_TAX_MESSAGES.ownerConditionsTitle}</h2>
        <label className="holding-conditions__checkbox">
          <input
            type="checkbox"
            checked={conditions.ownerAge >= MINIMUM_AGE_CREDIT_YEARS}
            onChange={(event) => changeConditions({
              ...conditions,
              ownerAge: event.target.checked
                ? MINIMUM_AGE_CREDIT_YEARS
                : ZERO_VALUE,
            })}
          />
          <span>{HOLDING_TAX_MESSAGES.ageThresholdLabel(
            MINIMUM_AGE_CREDIT_YEARS,
          )}</span>
        </label>
        <button
          className="holding-conditions__disclosure"
          type="button"
          aria-expanded={exactPeriodsOpen}
          onClick={() => setExactPeriodsOpen((current) => !current)}
        >
          {exactPeriodsOpen
            ? HOLDING_TAX_MESSAGES.exactPeriodsClose
            : HOLDING_TAX_MESSAGES.exactPeriodsOpen}
        </button>
        {exactPeriodsOpen && (
          <label className="holding-conditions__number-field">
            <span>{HOLDING_TAX_MESSAGES.ownerAgeLabel}</span>
            <span>
              <input
                type="number"
                min={ZERO_VALUE}
                step="1"
                value={conditions.ownerAge}
                onChange={(event) => changeConditions({
                  ...conditions,
                  ownerAge: toNonNegativeInteger(event.target.value),
                })}
              />
              {HOLDING_TAX_MESSAGES.yearsUnit}
            </span>
          </label>
        )}
      </section>

      <OfficialPriceGrowthFact
        annualGrowthRate={conditions.annualOfficialPriceGrowthRate}
        items={controller.items.filter(
          ({ ownershipShare }) => ownershipShare > ZERO_SHARE,
        )}
        onChange={(annualOfficialPriceGrowthRate) => changeConditions({
          ...conditions,
          annualOfficialPriceGrowthRate,
        })}
      />

      <div className="holding-conditions__properties">
        {controller.items.map((item) => {
          const itemConditions = conditions.items[item.id]

          return (
            <fieldset key={item.id}>
              <legend>
                {HOLDING_TAX_MESSAGES.propertyConditions(item.complexName)}
              </legend>

              <AutoFilledPropertyFacts
                controller={controller}
                item={item}
              />

              {item.ownershipShare > ZERO_SHARE && <>
                <div className="holding-conditions__thresholds">
                <label className="holding-conditions__checkbox">
                  <input
                    type="checkbox"
                    checked={itemConditions.holdingYears >=
                      MINIMUM_HOLDING_CREDIT_YEARS}
                    onChange={(event) => updateItemConditions(item.id, {
                      holdingYears: event.target.checked
                        ? MINIMUM_HOLDING_CREDIT_YEARS
                        : ZERO_VALUE,
                      residenceYears: event.target.checked
                        ? itemConditions.residenceYears
                        : ZERO_VALUE,
                    })}
                  />
                  <span>{HOLDING_TAX_MESSAGES.holdingThresholdLabel(
                    MINIMUM_HOLDING_CREDIT_YEARS,
                  )}</span>
                </label>
                <label className="holding-conditions__checkbox">
                  <input
                    type="checkbox"
                    checked={itemConditions.residenceYears >=
                      MINIMUM_RESIDENCE_CREDIT_YEARS}
                    onChange={(event) => updateItemConditions(item.id, {
                      holdingYears: event.target.checked
                        ? Math.max(
                            itemConditions.holdingYears,
                            MINIMUM_HOLDING_CREDIT_YEARS,
                          )
                        : itemConditions.holdingYears,
                      residenceYears: event.target.checked
                        ? MINIMUM_RESIDENCE_CREDIT_YEARS
                        : ZERO_VALUE,
                    })}
                  />
                  <span>{HOLDING_TAX_MESSAGES.residenceThresholdLabel(
                    MINIMUM_RESIDENCE_CREDIT_YEARS,
                  )}</span>
                </label>
                </div>

                {exactPeriodsOpen && (
                <div className="holding-conditions__periods">
                  <label className="holding-conditions__number-field">
                    <span>{HOLDING_TAX_MESSAGES.holdingYearsLabel}</span>
                    <span>
                      <input
                        type="number"
                        min={ZERO_VALUE}
                        step="1"
                        value={itemConditions.holdingYears}
                        onChange={(event) => updateItemConditions(item.id, {
                          holdingYears: Math.max(
                            toNonNegativeInteger(event.target.value),
                            itemConditions.residenceYears,
                          ),
                        })}
                      />
                      {HOLDING_TAX_MESSAGES.yearsUnit}
                    </span>
                  </label>
                  <label className="holding-conditions__number-field">
                    <span>{HOLDING_TAX_MESSAGES.residenceYearsLabel}</span>
                    <span>
                      <input
                        type="number"
                        min={ZERO_VALUE}
                        max={itemConditions.holdingYears}
                        step="1"
                        value={itemConditions.residenceYears}
                        onChange={(event) => updateItemConditions(item.id, {
                          residenceYears: Math.min(
                            toNonNegativeInteger(event.target.value),
                            itemConditions.holdingYears,
                          ),
                        })}
                      />
                      {HOLDING_TAX_MESSAGES.yearsUnit}
                    </span>
                  </label>
                </div>
                )}

                <section className="holding-conditions__question">
                <h3>{HOLDING_TAX_MESSAGES.residencyQuestion}</h3>
                <ConditionChoiceButtons
                  value={item.residency === null
                    ? null
                    : item.residency === 'residing'}
                  onChange={(residing) => {
                    const residency: Residency = residing
                      ? 'residing'
                      : 'nonResiding'
                    controller.update(item.id, { residency })
                    updateItemConditions(item.id, {
                      continuesResidence: residing ? null : false,
                      qualifyingRelocation: null,
                    })
                  }}
                />
                </section>

                {item.residency === 'residing' && (
                <section className="holding-conditions__question">
                  <h3>{HOLDING_TAX_MESSAGES.continuesResidenceQuestion}</h3>
                  <ConditionChoiceButtons
                    value={itemConditions.continuesResidence}
                    onChange={(continuesResidence) => updateItemConditions(
                      item.id,
                      {
                        continuesResidence,
                        qualifyingRelocation: null,
                      },
                    )}
                  />
                </section>
                )}

                {(item.residency === 'nonResiding' ||
                itemConditions.continuesResidence === false) && (
                <section className="holding-conditions__question">
                  <h3>
                    {HOLDING_TAX_MESSAGES.qualifyingRelocationQuestion}
                  </h3>
                  <ConditionChoiceButtons
                    value={itemConditions.qualifyingRelocation}
                    onChange={(qualifyingRelocation) => updateItemConditions(
                      item.id,
                      { qualifyingRelocation },
                    )}
                  />
                </section>
                )}
              </>}
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
