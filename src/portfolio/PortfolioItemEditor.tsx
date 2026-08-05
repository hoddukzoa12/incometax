import { useState } from 'react'

import type {
  OwnershipShare,
  StoredPortfolioItem,
} from '../../shared/portfolio'
import type { AreaKind, Residency } from '../../shared/tax-rules'
import { formatArea, formatWon } from '../format/property'
import { PORTFOLIO_MESSAGES } from '../messages/portfolio'
import {
  MAX_OWNERSHIP_PERCENT,
  MIN_OWNERSHIP_PERCENT,
  OWNERSHIP_PERCENT_INPUT_STEP,
  ownershipPercentFromNumber,
  ownershipShareFromPercent,
  ownershipShareToPercent,
} from './ownership-share'

export interface PortfolioItemEditorProps {
  readonly item: StoredPortfolioItem
  readonly onRemove: () => void
  readonly onOwnershipShareChange: (value: OwnershipShare) => void
  readonly onResidencyChange: (value: Residency) => void
  readonly onSoleHouseholdOwnerChange: (value: boolean) => void
  readonly onAreaKindChange: (value: AreaKind) => void
}

export function PortfolioItemEditor({
  item,
  onRemove,
  onOwnershipShareChange,
  onResidencyChange,
  onSoleHouseholdOwnerChange,
  onAreaKindChange,
}: PortfolioItemEditorProps) {
  const [shareInput, setShareInput] = useState(
    String(ownershipShareToPercent(item.ownershipShare)),
  )
  const [shareError, setShareError] = useState(false)
  const unitIdentity = PORTFOLIO_MESSAGES.unitIdentity(item.dong, item.ho)

  const changeShare = (value: string): void => {
    setShareInput(value)
    if (value.trim() === '') {
      setShareError(true)
      return
    }
    try {
      const percent = ownershipPercentFromNumber(Number(value))
      onOwnershipShareChange(ownershipShareFromPercent(percent))
      setShareError(false)
    } catch {
      setShareError(true)
    }
  }

  return (
    <li className="portfolio-item">
      <div className="portfolio-item__heading">
        <div>
          <span className="portfolio-item__kind">
            {PORTFOLIO_MESSAGES.assetKind[item.assetKind]}
          </span>
          <h3>{item.complexName}</h3>
        </div>
        <button
          className="portfolio-item__remove"
          type="button"
          onClick={onRemove}
        >
          {PORTFOLIO_MESSAGES.remove}
        </button>
      </div>

      <p className="portfolio-item__address">{item.address}</p>
      {(unitIdentity || item.exclusiveArea !== null) && (
        <p className="portfolio-item__identity">
          {[unitIdentity, item.exclusiveArea === null
            ? ''
            : formatArea(item.exclusiveArea)]
            .filter(Boolean)
            .join(PORTFOLIO_MESSAGES.identitySeparator)}
        </p>
      )}

      <p className={item.officialPrice === null
        ? 'portfolio-item__price portfolio-item__price--incomplete'
        : 'portfolio-item__price'}>
        <span>{PORTFOLIO_MESSAGES.officialPriceLabel}</span>
        <strong>
          {item.officialPrice === null
            ? PORTFOLIO_MESSAGES.officialPriceIncomplete
            : formatWon(item.officialPrice)}
        </strong>
      </p>

      <div className="portfolio-item__fields">
        <label>
          <span>{PORTFOLIO_MESSAGES.ownershipShareLabel}</span>
          <span className="portfolio-item__share-input">
            <input
              type="number"
              min={MIN_OWNERSHIP_PERCENT}
              max={MAX_OWNERSHIP_PERCENT}
              step={OWNERSHIP_PERCENT_INPUT_STEP}
              value={shareInput}
              aria-invalid={shareError}
              onChange={(event) => changeShare(event.target.value)}
            />
            <span>{PORTFOLIO_MESSAGES.ownershipShareUnit}</span>
          </span>
        </label>
        <label>
          <span>{PORTFOLIO_MESSAGES.residencyLabel}</span>
          <select
            value={item.residency}
            onChange={(event) =>
              onResidencyChange(event.target.value as Residency)}
          >
            <option value="nonResiding">
              {PORTFOLIO_MESSAGES.nonResiding}
            </option>
            <option value="residing">{PORTFOLIO_MESSAGES.residing}</option>
          </select>
        </label>
        <label>
          <span>{PORTFOLIO_MESSAGES.areaKindLabel}</span>
          <select
            value={item.areaKind}
            onChange={(event) =>
              onAreaKindChange(event.target.value as AreaKind)}
          >
            <option value="general">{PORTFOLIO_MESSAGES.generalArea}</option>
            <option value="adjusted">
              {PORTFOLIO_MESSAGES.adjustedArea}
            </option>
          </select>
        </label>
      </div>
      {shareError && (
        <p className="portfolio-item__field-error" role="alert">
          {PORTFOLIO_MESSAGES.ownershipShareInvalid}
        </p>
      )}
      <label className="portfolio-item__check">
        <input
          type="checkbox"
          checked={item.isSoleHouseholdOwner}
          onChange={(event) =>
            onSoleHouseholdOwnerChange(event.target.checked)}
        />
        <span>{PORTFOLIO_MESSAGES.soleHouseholdOwner}</span>
      </label>
    </li>
  )
}
