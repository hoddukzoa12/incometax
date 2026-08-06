import type { StoredPortfolioItem } from '../../shared/portfolio'
import { formatArea, formatWon } from '../format/property'
import { PORTFOLIO_MESSAGES } from '../messages/portfolio'

export interface PortfolioItemEditorProps {
  readonly item: StoredPortfolioItem
  readonly onRemove: () => void
}

export function PortfolioItemEditor({
  item,
  onRemove,
}: PortfolioItemEditorProps) {
  const unitIdentity = PORTFOLIO_MESSAGES.unitIdentity(item.dong, item.ho)

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

    </li>
  )
}
