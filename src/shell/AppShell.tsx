import { useEffect, useRef, useState } from 'react'

import type { PortfolioItemSeed } from '../../shared/portfolio'
import type { AddressSearchResult } from '../../shared/search'
import {
  HoldingTaxConditionsModal,
  HoldingTaxOverlay,
  useHoldingTaxOverlay,
} from '../holding-screen'
import ComplexMap from '../map/ComplexMap'
import { APP_MESSAGES } from '../messages/app'
import { SHELL_MESSAGES } from '../messages/shell'
import { usePortfolio } from '../portfolio'
import { ComplexSearch } from '../search'
import { AddressLookupPanel } from './AddressLookupPanel'
import { ComplexPanel } from './ComplexPanel'
import { ConsultIntroModal } from './ConsultIntroModal'
import {
  persistConsultIntroDismissal,
  shouldShowConsultIntro,
} from './consult-intro-dismissal'
import { useLayerHistory } from './layer-history'
import { PortfolioMenu } from './PortfolioMenu'
import { useCompactLayout } from './useCompactLayout'
import '../app.css'
import './shell.css'

const TOAST_MS = 2200
const YOUTUBE_EMBED_URL = 'https://www.youtube.com/embed/'

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
  const [consultIntroOpen, setConsultIntroOpen] = useState(
    shouldShowConsultIntro,
  )
  const [selectedComplexId, setSelectedComplexId] = useState<string | null>(null)
  const [selectedAddress, setSelectedAddress] = useState<{
    readonly result: AddressSearchResult
    readonly seq: number
  } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [addRequestSeq, setAddRequestSeq] = useState(0)
  /*
   * 시안은 조건을 결과보다 먼저 묻는다 — 「보유세 계산」 → 동·호 → 조건 →
   * 결과. 조건이 세액을 가르므로 결과를 띄워 놓고 되묻는 것은 순서가 뒤집힌 것이다.
   */
  const [askingConditions, setAskingConditions] = useState(false)
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/config')
      .then((response) => response.json())
      .then((data) => {
        const config = data as { youtubeVideoId?: string | null }
        if (config.youtubeVideoId) setYoutubeVideoId(config.youtubeVideoId)
      })
      .catch(() => {})
  }, [])
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

  const panelOpen = selectedComplexId !== null || selectedAddress !== null
  const backgroundInert = consultIntroOpen || holdingTaxOverlay.open

  const dismissConsultIntro = (dismissToday: boolean) => {
    if (dismissToday) persistConsultIntroDismissal()
    setConsultIntroOpen(false)
  }

  /*
   * 지도를 덮는 층은 뒤로가기로 하나씩 벗겨진다. 안 그러면 좁은 화면에서
   * 단지 정보를 열어 놓고 뒤로가기를 누른 사람이 사이트 밖으로 튕겨 나간다.
   * 나중에 연 것이 먼저 닫힌다 — 동·호 모달은 그것을 띄운 ComplexPanel 이 건다.
   */
  const closePanel = () => {
    setSelectedComplexId(null)
    setSelectedAddress(null)
  }

  const selectComplex = (complexId: string) => {
    setSelectedAddress(null)
    setSelectedComplexId(complexId)
  }

  useLayerHistory('complexPanel', panelOpen, closePanel)
  useLayerHistory('conditions', askingConditions, () => setAskingConditions(false))
  useLayerHistory('holdingTax', holdingTaxOverlay.open, holdingTaxOverlay.hide)

  /*
   * 아이콘이 자리에 따라 다르다. 넓은 화면에서는 옆에 붙은 패널이 접히는 것이라
   * 접히는 면을 그리지만, 좁은 화면에서는 패널이 지도를 통째로 덮으므로
   * 접힐 옆면이 없다 — 덮은 것을 걷어내는 ✕ 가 맞다.
   */
  const closeButton = (
    <button
      className="panel__close"
      type="button"
      aria-label={compact
        ? SHELL_MESSAGES.closePanelLabel
        : SHELL_MESSAGES.collapsePanelLabel}
      onClick={closePanel}
    >
      {compact ? (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path
            d="M4 4l10 10M14 4L4 14"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
          />
        </svg>
      ) : (
        /* 패널이 접히는 모양 — 오른쪽 면이 닫힌다 */
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <rect
            x="1.5" y="3" width="15" height="12" rx="2"
            stroke="currentColor" strokeWidth="1.5"
          />
          <rect x="10.5" y="4.5" width="4.5" height="9" fill="currentColor" />
        </svg>
      )}
    </button>
  )

  const addToPortfolio = (seed: PortfolioItemSeed) => {
    portfolio.add(seed)
    flash(SHELL_MESSAGES.added(seed.complexName))
  }

  const panel = selectedAddress !== null ? (
    <AddressLookupPanel
      key={selectedAddress.seq}
      result={selectedAddress.result}
      onAddToPortfolio={addToPortfolio}
    />
  ) : (
    <ComplexPanel
      complexId={selectedComplexId}
      onAddToPortfolio={addToPortfolio}
      addRequestSeq={addRequestSeq}
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
        aria-hidden={backgroundInert || undefined}
        inert={backgroundInert || undefined}
      >
        <div className="app-shell__map">
          <ComplexMap
            onComplexSelect={selectComplex}
            ownedComplexIds={ownedComplexIds}
            selectedComplexId={selectedComplexId}
            onAddComplex={(complexId) => {
              selectComplex(complexId)
              setAddRequestSeq((seq) => seq + 1)
            }}
            onRemoveComplex={removeComplex}
            focus={focus}
            addressMarker={selectedAddress === null ? null : {
              lat: selectedAddress.result.lat,
              lng: selectedAddress.result.lng,
              title: selectedAddress.result.placeName ??
                selectedAddress.result.roadAddress ??
                selectedAddress.result.address,
              seq: selectedAddress.seq,
            }}
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
                  selectComplex(complex.complexId)
                  // 좌표가 없는 단지가 있다. 그때는 사이드바만 열고 지도는 두고 본다.
                  if (complex.lat !== null && complex.lng !== null) {
                    setFocus({
                      lat: complex.lat,
                      lng: complex.lng,
                      seq: focusSeq.current += 1,
                    })
                  }
                }}
                onSelectAddress={(result) => {
                  setSelectedComplexId(null)
                  const seq = focusSeq.current += 1
                  setSelectedAddress({ result, seq })
                  setFocus({
                    lat: result.lat,
                    lng: result.lng,
                    seq,
                  })
                }}
              />
            </div>
          </div>

          {toast !== null && (
            <p className="maptoast" role="status">
              {toast}
            </p>
          )}

          {!compact && youtubeVideoId !== null && (
            <div className="map__youtube-embed">
              <span className="map__youtube-embed-label" aria-hidden="true">사용방법</span>
              <iframe
                width="320"
                height="180"
                src={`${YOUTUBE_EMBED_URL}${encodeURIComponent(youtubeVideoId)}`}
                title="두꺼비세무사"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          )}

          <div className="map__corner">
            {compact && youtubeVideoId !== null && (
              <a
                className="map__youtube map__youtube--icon"
                href={`https://www.youtube.com/watch?v=${encodeURIComponent(youtubeVideoId)}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="두꺼비세무사 유튜브"
              >
                <svg viewBox="0 0 28 20" aria-hidden="true">
                  <path fill="#FF0000" d="M27.4 3.1a3.5 3.5 0 0 0-2.5-2.5C22.7 0 14 0 14 0S5.3 0 3.1.6A3.5 3.5 0 0 0 .6 3.1C0 5.3 0 10 0 10s0 4.7.6 6.9a3.5 3.5 0 0 0 2.5 2.5C5.3 20 14 20 14 20s8.7 0 10.9-.6a3.5 3.5 0 0 0 2.5-2.5C28 14.7 28 10 28 10s0-4.7-.6-6.9Z"/>
                  <path fill="#FFF" d="m11.2 14.3 7.2-4.3-7.2-4.3v8.6Z"/>
                </svg>
                <span>사용방법</span>
              </a>
            )}
            <PortfolioMenu
              controller={portfolio}
              onCalculateHoldingTax={() => setAskingConditions(true)}
            />
          </div>

          {/*
            좁은 화면에서는 단지 패널이 지도를 통째로 덮는다. 아래 62% 만 쓰던
            바텀시트로는 단지 헤더를 빼면 실거래가에 116px 밖에 안 남아,
            거래 목록도 연도별 막대도 끝까지 볼 수가 없었다.
          */}
          {compact && panelOpen && (
            <div className="sheet">
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

      {consultIntroOpen && (
        <ConsultIntroModal onDismiss={dismissConsultIntro} />
      )}

      {askingConditions && portfolio.items.length > 0 && (
        <HoldingTaxConditionsModal
          controller={portfolio}
          onCancel={() => setAskingConditions(false)}
          onSubmit={() => {
            setAskingConditions(false)
            holdingTaxOverlay.show()
          }}
          variant="beforeCalculation"
        />
      )}

      {holdingTaxOverlay.open && (
        <div
          className="resultlayer"
          role="dialog"
          aria-modal="true"
          aria-label={SHELL_MESSAGES.resultLabel}
          onClick={(event) => {
            // 카드 바깥(어두운 배경)을 눌렀을 때만 닫는다.
            if (event.target === event.currentTarget) holdingTaxOverlay.hide()
          }}
        >
          <div className="resultlayer__card">
            <HoldingTaxOverlay
              controller={portfolio}
              onClose={holdingTaxOverlay.hide}
            />
          </div>
        </div>
      )}
    </div>
  )
}
