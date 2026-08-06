import { useState } from 'react'

import { HoldingTaxOverlay, useHoldingTaxOverlay } from './holding-screen'
import ComplexMap from './map/ComplexMap'
import { APP_MESSAGES } from './messages/app'
import { ComplexSearch } from './search'
import { ComplexSidebar } from './sidebar'
import { PortfolioPanel, usePortfolio } from './portfolio'
import './app.css'

export default function App() {
  const [selectedComplexId, setSelectedComplexId] = useState<string | null>(
    null,
  )
  const [isPortfolioOpen, setIsPortfolioOpen] = useState(false)
  const portfolio = usePortfolio()
  const holdingTaxOverlay = useHoldingTaxOverlay()

  return (
    <div className="app-shell">
      <main className="app-shell__body">
        <div className="app-shell__map">
          <ComplexMap onComplexSelect={setSelectedComplexId} />
          <div className="app-shell__search">
            <div className="app-shell__identity">
              <h1 className="app-shell__title">{APP_MESSAGES.title}</h1>
              <p className="app-shell__subtitle">{APP_MESSAGES.subtitle}</p>
            </div>
            <ComplexSearch onSelectComplex={setSelectedComplexId} />
          </div>
          <PortfolioPanel
            controller={portfolio}
            open={isPortfolioOpen}
            onOpenChange={setIsPortfolioOpen}
            onCalculateHoldingTax={holdingTaxOverlay.show}
          />
        </div>
        <aside
          className="app-shell__sidebar"
          aria-label={APP_MESSAGES.sidebarLabel}
        >
          <ComplexSidebar
            complexId={selectedComplexId}
            onClose={() => setSelectedComplexId(null)}
            onAddToPortfolio={(seed) => {
              portfolio.add(seed)
              setIsPortfolioOpen(true)
            }}
          />
        </aside>
      </main>
      {holdingTaxOverlay.open && (
        <HoldingTaxOverlay
          controller={portfolio}
          onClose={holdingTaxOverlay.hide}
        />
      )}
    </div>
  )
}
