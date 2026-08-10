import { useEffect, useRef, useState } from 'react'

import { HoldingTaxOverlay, useHoldingTaxOverlay } from '../holding-screen'
import ComplexMap from '../map/ComplexMap'
import { APP_MESSAGES } from '../messages/app'
import { SHELL_MESSAGES } from '../messages/shell'
import { usePortfolio } from '../portfolio'
import { ComplexSearch } from '../search'
import { ComplexPanel } from './ComplexPanel'
import { PortfolioMenu } from './PortfolioMenu'
import { useCompactLayout } from './useCompactLayout'
import '../app.css'
import './shell.css'

const TOAST_MS = 2200

/**
 * 앱 셸 — claude.ai/design 시안(shell-v2.html, B안).
 *
 * 지도가 화면을 채운다. 단지를 고르면 옆에서 패널이 열리고(좁은 화면은 바텀시트),
 * 보유세 결과는 화면을 덮는다 — 계산하는 동안에는 지도를 잊는다.
 */
export default function AppShell() {
  const compact = useCompactLayout()
  const portfolio = usePortfolio()
  const holdingTaxOverlay = useHoldingTaxOverlay()
  const [selectedComplexId, setSelectedComplexId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [addRequestSeq, setAddRequestSeq] = useState(0)
  const [focus, setFocus] = useState<
    { readonly lat: number; readonly lng: number; readonly seq: number } | null
  >(null)
  const toastTimer = useRef<number | null>(null)
  const focusSeq = useRef(0)

  const flash = (message: string) => {
    setToast(message)
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), TOAST_MS)
  }

  useEffect(() => () => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
  }, [])

  const panelOpen = selectedComplexId !== null

  const closeButton = (
    <button
      className="panel__close"
      type="button"
      aria-label={SHELL_MESSAGES.collapsePanelLabel}
      onClick={() => setSelectedComplexId(null)}
    >
      {/* 패널이 접히는 모양 — 오른쪽 면이 닫힌다 */}
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <rect
          x="1.5" y="3" width="15" height="12" rx="2"
          stroke="currentColor" strokeWidth="1.5"
        />
        <rect x="10.5" y="4.5" width="4.5" height="9" fill="currentColor" />
      </svg>
    </button>
  )

  const panel = (
    <ComplexPanel
      complexId={selectedComplexId}
      onAddToPortfolio={(seed) => {
        portfolio.add(seed)
        flash(SHELL_MESSAGES.added(seed.complexName))
      }}
      addRequestSeq={addRequestSeq}
      onCalculate={holdingTaxOverlay.show}
    />
  )

  // 지도에 없는 물건도 담을 수 있으므로 complexId 가 없는 항목이 있다.
  const ownedComplexIds = portfolio.items
    .map((item) => item.complexId)
    .filter((complexId): complexId is string => complexId !== null)

  // 지도에서 뺄 때는 그 단지로 담은 것을 모두 뺀다 — 같은 단지의 다른 호도 함께다.
  const removeComplex = (complexId: string) => {
    for (const item of portfolio.items) {
      if (item.complexId === complexId) portfolio.remove(item.id)
    }
  }

  return (
    <div className="frame">
      <div
        className="frame__body"
        aria-hidden={holdingTaxOverlay.open || undefined}
        inert={holdingTaxOverlay.open || undefined}
      >
        <div className="app-shell__map">
          <ComplexMap
            onComplexSelect={setSelectedComplexId}
            ownedComplexIds={ownedComplexIds}
            selectedComplexId={selectedComplexId}
            onAddComplex={(complexId) => {
              setSelectedComplexId(complexId)
              setAddRequestSeq((seq) => seq + 1)
            }}
            onRemoveComplex={removeComplex}
            focus={focus}
          />

          <div className="app-shell__search">
            <div className="searchbox">
              <img
                className="searchbox__logo"
                src="/logo.png"
                alt={SHELL_MESSAGES.logoAlt}
                width={22}
                height={26}
              />
              <ComplexSearch
                onSelectComplex={(complex) => {
                  setSelectedComplexId(complex.complexId)
                  // 좌표가 없는 단지가 있다. 그때는 사이드바만 열고 지도는 두고 본다.
                  if (complex.lat !== null && complex.lng !== null) {
                    setFocus({
                      lat: complex.lat,
                      lng: complex.lng,
                      seq: focusSeq.current += 1,
                    })
                  }
                }}
              />
            </div>
          </div>

          {toast !== null && (
            <p className="maptoast" role="status">
              {toast}
            </p>
          )}

          <div className="map__corner">
            <PortfolioMenu
              controller={portfolio}
              onCalculateHoldingTax={holdingTaxOverlay.show}
            />
          </div>

          {compact && panelOpen && (
            <div className="sheet" style={{ height: '62%' }}>
              <div className="sheet__grip">
                <span />
              </div>
              {closeButton}
              <div className="panel__scroll">{panel}</div>
            </div>
          )}
        </div>

        {!compact && panelOpen && (
          <aside
            className="panel app-shell__sidebar"
            aria-label={APP_MESSAGES.sidebarLabel}
          >
            {closeButton}
            <div className="panel__scroll">{panel}</div>
          </aside>
        )}
      </div>

      {holdingTaxOverlay.open && (
        <div className={compact ? 'resultlayer' : 'resultlayer cols'}>
          <HoldingTaxOverlay
            controller={portfolio}
            onClose={holdingTaxOverlay.hide}
          />
        </div>
      )}
    </div>
  )
}
