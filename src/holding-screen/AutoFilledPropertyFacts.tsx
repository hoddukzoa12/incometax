import { useState } from 'react'

import type { StoredPortfolioItem } from '../../shared/portfolio'
import type { AreaKind } from '../../shared/tax-rules'
import { formatWon } from '../format/won'
import { HOLDING_TAX_MESSAGES } from '../messages/holding-tax'
import {
  MAX_OWNERSHIP_PERCENT,
  MIN_OWNERSHIP_PERCENT,
  OWNERSHIP_PERCENT_INPUT_STEP,
  ownershipPercentFromNumber,
  ownershipShareFromPercent,
  ownershipShareToPercent,
  type PortfolioController,
} from '../portfolio'
import { AutoFilledFactRow } from './AutoFilledFactRow'
import { formatCompactDate } from './format'
import { TaxTermHelp } from './TaxTermHelp'

const FULL_OWNERSHIP_PERCENT = 100

const toPositiveInteger = (value: string): number | null => {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

export function AutoFilledPropertyFacts({
  controller,
  item,
}: {
  readonly controller: PortfolioController
  readonly item: StoredPortfolioItem
}) {
  const [priceEditing, setPriceEditing] = useState(false)
  const [areaEditing, setAreaEditing] = useState(false)
  const [shareEditing, setShareEditing] = useState(false)
  const sharePercent = ownershipShareToPercent(item.ownershipShare)
  const partialShare = sharePercent < FULL_OWNERSHIP_PERCENT

  return (
    <section className="holding-conditions__facts">
      <h3>{HOLDING_TAX_MESSAGES.automaticFactsTitle}</h3>
      <AutoFilledFactRow
        label={HOLDING_TAX_MESSAGES.officialPriceLabel}
        value={item.officialPrice === null
          ? HOLDING_TAX_MESSAGES.headlineUnavailable
          : formatWon(item.officialPrice)}
        editing={priceEditing}
        onEdit={() => setPriceEditing((current) => !current)}
      >
        <div className="holding-conditions__fact-inputs">
          <label>
            <span>{HOLDING_TAX_MESSAGES.officialPriceLabel}</span>
            <input
              type="number"
              min="1"
              step="1"
              required
              value={item.officialPrice ?? ''}
              onChange={(event) => controller.update(item.id, {
                officialPrice: toPositiveInteger(event.target.value),
              })}
            />
          </label>
          <label>
            <span>{HOLDING_TAX_MESSAGES.officialPriceBaseDateLabel}</span>
            <input
              type="date"
              required
              value={item.officialPriceBaseDate ?? ''}
              onChange={(event) => controller.update(item.id, {
                officialPriceBaseDate: event.target.value || null,
              })}
            />
          </label>
        </div>
      </AutoFilledFactRow>
      {!priceEditing && (
        <p className="holding-conditions__base-date">
          {HOLDING_TAX_MESSAGES.officialPriceBaseDateLabel}{' '}
          <strong>{item.officialPriceBaseDate === null
            ? HOLDING_TAX_MESSAGES.officialPriceBaseDateMissing
            : formatCompactDate(item.officialPriceBaseDate)}</strong>
        </p>
      )}
      <AutoFilledFactRow
        label={HOLDING_TAX_MESSAGES.areaKindLabel}
        help={<TaxTermHelp term="adjustedArea" />}
        value={item.areaKind === 'adjusted'
          ? HOLDING_TAX_MESSAGES.adjustedArea
          : HOLDING_TAX_MESSAGES.generalArea}
        editing={areaEditing}
        onEdit={() => setAreaEditing((current) => !current)}
      >
        <select
          value={item.areaKind}
          onChange={(event) => controller.update(item.id, {
            areaKind: event.target.value as AreaKind,
          })}
        >
          <option value="general">{HOLDING_TAX_MESSAGES.generalArea}</option>
          <option value="adjusted">{HOLDING_TAX_MESSAGES.adjustedArea}</option>
        </select>
      </AutoFilledFactRow>
      <AutoFilledFactRow
        label={HOLDING_TAX_MESSAGES.ownershipShareLabel}
        value={`${sharePercent}${HOLDING_TAX_MESSAGES.ownershipShareUnit}`}
        editing={partialShare || shareEditing}
        onEdit={partialShare
          ? undefined
          : () => setShareEditing((current) => !current)}
      >
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
                controller.setOwnershipShare(
                  item.id,
                  ownershipShareFromPercent(percent),
                )
                controller.update(item.id, {
                  isSoleHouseholdOwner:
                    percent === FULL_OWNERSHIP_PERCENT,
                })
              } catch {
                return
              }
            }}
          />
          <span>{HOLDING_TAX_MESSAGES.ownershipShareUnit}</span>
        </span>
      </AutoFilledFactRow>
    </section>
  )
}
