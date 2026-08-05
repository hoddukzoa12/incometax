import { useState } from 'react'

import ComplexMap from './map/ComplexMap'
import { APP_MESSAGES } from './messages/app'
import { ComplexSearch } from './search'
import { ComplexSidebar } from './sidebar'
import './app.css'

export default function App() {
  const [selectedComplexId, setSelectedComplexId] = useState<string | null>(
    null,
  )

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <h1 className="app-shell__title">{APP_MESSAGES.title}</h1>
        <p className="app-shell__subtitle">{APP_MESSAGES.subtitle}</p>
      </header>
      <main className="app-shell__body">
        <div className="app-shell__map">
          <ComplexMap onComplexSelect={setSelectedComplexId} />
          <div className="app-shell__search">
            <ComplexSearch onSelectComplex={setSelectedComplexId} />
          </div>
        </div>
        <aside
          className="app-shell__sidebar"
          aria-label={APP_MESSAGES.sidebarLabel}
        >
          <ComplexSidebar
            complexId={selectedComplexId}
            onClose={() => setSelectedComplexId(null)}
          />
        </aside>
      </main>
    </div>
  )
}
