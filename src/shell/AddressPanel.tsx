import { useState } from 'react'

import { addressApartmentIdentity } from '../../shared/official-price'
import type { PortfolioItemSeed } from '../../shared/portfolio'
import type { AddressComplexSelection } from '../../shared/search'
import { SHELL_MESSAGES } from '../messages/shell'
import { SIDEBAR_MESSAGES } from '../messages/sidebar'
import { TradeSection } from '../sidebar/TradeSection'
import { useTradeData } from '../sidebar/useSidebarData'
import { useLayerHistory } from './layer-history'
import { UnitLookup } from './UnitLookup'
import '../sidebar/complex-sidebar.css'

export function AddressPanel({
  complex,
  onAddToPortfolio,
}: {
  readonly complex: AddressComplexSelection
  readonly onAddToPortfolio: (seed: PortfolioItemSeed) => void
}) {
  const [unitLookupOpen, setUnitLookupOpen] = useState(false)
  const tradeData = useTradeData(null, complex)
  useLayerHistory('unitLookup', unitLookupOpen, () => setUnitLookupOpen(false))

  return (
    <div className="complex-sidebar">
      <div className="complex-sidebar__content">
        <div className="sidehead">
          <header className="complex-sidebar__header">
            <p className="complex-sidebar__eyebrow">
              {SIDEBAR_MESSAGES.apartmentComplexLabel}
            </p>
            <h2>{complex.complexName}</h2>
            <address>{complex.roadAddress ?? complex.address}</address>
            {complex.roadAddress && complex.roadAddress !== complex.address && (
              <p className="complex-sidebar__legal-address">
                {SIDEBAR_MESSAGES.lotAddressLabel} {complex.address}
              </p>
            )}
          </header>
          <div className="sidehead__acts">
            <button
              className="cta"
              type="button"
              onClick={() => setUnitLookupOpen(true)}
            >
              <span>{SHELL_MESSAGES.addFromComplex}</span>
            </button>
          </div>
        </div>
        <TradeSection
          trades={tradeData.trades?.items ?? []}
          status={tradeData.tradeStatus}
          onRetry={tradeData.retryTrades}
        />
      </div>

      {unitLookupOpen && (
        <UnitLookup
          key={addressApartmentIdentity(complex.pnu, complex.aptCode)}
          complex={complex}
          mode="add"
          onCancel={() => setUnitLookupOpen(false)}
          onConfirm={(seed) => {
            setUnitLookupOpen(false)
            onAddToPortfolio(seed)
          }}
        />
      )}
    </div>
  )
}
