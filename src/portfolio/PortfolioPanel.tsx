import type { PortfolioController } from './usePortfolio'
import { PORTFOLIO_MESSAGES } from '../messages/portfolio'
import { PortfolioItemEditor } from './PortfolioItemEditor'
import './portfolio.css'

export interface PortfolioPanelProps {
  readonly controller: PortfolioController
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

export function PortfolioPanel({
  controller,
  open,
  onOpenChange,
}: PortfolioPanelProps) {
  return (
    <section className="portfolio-panel" aria-label={PORTFOLIO_MESSAGES.title}>
      <button
        className="portfolio-panel__toggle"
        type="button"
        aria-expanded={open}
        aria-label={open ? PORTFOLIO_MESSAGES.close : PORTFOLIO_MESSAGES.open}
        onClick={() => onOpenChange(!open)}
      >
        {PORTFOLIO_MESSAGES.toggleLabel(controller.items.length)}
      </button>

      {open && (
        <div className="portfolio-panel__body">
          <div className="portfolio-panel__header">
            <h2>{PORTFOLIO_MESSAGES.title}</h2>
            <button type="button" onClick={() => onOpenChange(false)}>
              {PORTFOLIO_MESSAGES.close}
            </button>
          </div>
          {controller.items.length === 0 ? (
            <div className="portfolio-panel__empty">
              <strong>{PORTFOLIO_MESSAGES.emptyTitle}</strong>
              <p>{PORTFOLIO_MESSAGES.emptyDescription}</p>
            </div>
          ) : (
            <ol className="portfolio-panel__list">
              {controller.items.map((item) => (
                <PortfolioItemEditor
                  key={item.id}
                  item={item}
                  onRemove={() => controller.remove(item.id)}
                  onOwnershipShareChange={(ownershipShare) =>
                    controller.setOwnershipShare(item.id, ownershipShare)}
                  onResidencyChange={(residency) =>
                    controller.update(item.id, { residency })}
                  onSoleHouseholdOwnerChange={(isSoleHouseholdOwner) =>
                    controller.update(item.id, { isSoleHouseholdOwner })}
                  onAreaKindChange={(areaKind) =>
                    controller.update(item.id, { areaKind })}
                />
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  )
}
