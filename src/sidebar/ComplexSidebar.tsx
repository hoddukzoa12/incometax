import { useId, useState } from 'react'

import type { RecentTrade } from '../../shared/trade'
import type { PortfolioItemSeed } from '../../shared/portfolio'
import { SIDEBAR_MESSAGES } from '../messages/sidebar'
import { ComplexBasics } from './ComplexBasics'
import { TradeAreaSelect } from './TradeAreaSelect'
import { TradeHistory } from './TradeHistory'
import { UnitPicker } from './UnitPicker'
import { YearlyTradeChart } from './YearlyTradeChart'
import {
  availableTradeAreas,
  defaultTradeAreaKey,
  filterTradesByArea,
} from './trade-filter-data'
import { useSidebarData } from './useSidebarData'
import './complex-sidebar.css'

const EMPTY_TRADES: readonly RecentTrade[] = []

type SidebarTab = 'officialPrice' | 'trades'

export interface ComplexSidebarProps {
  readonly complexId: string | null
  readonly onClose: () => void
  readonly onAddToPortfolio: (seed: PortfolioItemSeed) => void
}

export function ComplexSidebar({
  complexId,
  onClose,
  onAddToPortfolio,
}: ComplexSidebarProps) {
  const data = useSidebarData(complexId)
  const tabsId = useId()
  const [activeTab, setActiveTab] = useState<SidebarTab>('officialPrice')
  const [requestedArea, setRequestedArea] = useState<{
    readonly complexId: string
    readonly areaKey: string
  } | null>(null)
  if (complexId === null) return null

  const trades = data.trades?.items ?? EMPTY_TRADES
  const areaOptions = availableTradeAreas(trades)
  const requestedAreaKey = requestedArea?.complexId === complexId
    ? requestedArea.areaKey
    : ''
  const selectedAreaKey = areaOptions.some(
    (option) => option.key === requestedAreaKey,
  )
    ? requestedAreaKey
    : defaultTradeAreaKey(areaOptions)
  const selectedArea = areaOptions.find(
    (option) => option.key === selectedAreaKey,
  )
  const selectedAreaTrades = filterTradesByArea(trades, selectedAreaKey)
  const officialPriceTabId = `${tabsId}-official-price-tab`
  const officialPricePanelId = `${tabsId}-official-price-panel`
  const tradesTabId = `${tabsId}-trades-tab`
  const tradesPanelId = `${tabsId}-trades-panel`

  return (
    <div
      className="complex-sidebar"
      role="region"
      aria-label={SIDEBAR_MESSAGES.sidebarLabel}
    >
      <button
        className="complex-sidebar__close"
        type="button"
        aria-label={SIDEBAR_MESSAGES.closeSidebar}
        title={SIDEBAR_MESSAGES.closeSidebar}
        onClick={onClose}
      >
        {SIDEBAR_MESSAGES.closeSymbol}
      </button>

      <div className="complex-sidebar__content">
        {data.detailStatus === 'loading' && (
          <p className="complex-sidebar__loading" role="status">
            {SIDEBAR_MESSAGES.loading}
          </p>
        )}
        {data.detailStatus === 'failed' && (
          <div className="complex-sidebar__error" role="alert">
            <p>{SIDEBAR_MESSAGES.detailFailed}</p>
            <button type="button" onClick={data.retryDetail}>
              {SIDEBAR_MESSAGES.retry}
            </button>
          </div>
        )}
        {data.detail && (
          <ComplexBasics complex={data.detail}>
            {selectedArea && (
              <div className="complex-sidebar__chart">
                <TradeAreaSelect
                  options={areaOptions}
                  selectedAreaKey={selectedAreaKey}
                  onChange={(areaKey) => setRequestedArea({ complexId, areaKey })}
                />
                <YearlyTradeChart
                  trades={selectedAreaTrades}
                  areaLabel={`${selectedArea.key}㎡`}
                />
              </div>
            )}
          </ComplexBasics>
        )}

        <div className="complex-sidebar__tabs" role="tablist">
          <button
            id={officialPriceTabId}
            type="button"
            role="tab"
            aria-selected={activeTab === 'officialPrice'}
            aria-controls={officialPricePanelId}
            onClick={() => setActiveTab('officialPrice')}
          >
            {SIDEBAR_MESSAGES.officialPriceTab}
          </button>
          <button
            id={tradesTabId}
            type="button"
            role="tab"
            aria-selected={activeTab === 'trades'}
            aria-controls={tradesPanelId}
            onClick={() => setActiveTab('trades')}
          >
            {SIDEBAR_MESSAGES.recentTradesTab}
          </button>
        </div>

        <section
          id={officialPricePanelId}
          role="tabpanel"
          aria-labelledby={officialPriceTabId}
          hidden={activeTab !== 'officialPrice'}
        >
          {data.detail && (
            <UnitPicker
              key={data.detail.complexId}
              complex={data.detail}
              onAddToPortfolio={onAddToPortfolio}
            />
          )}
        </section>

        <section
          id={tradesPanelId}
          role="tabpanel"
          aria-labelledby={tradesTabId}
          hidden={activeTab !== 'trades'}
        >
          {data.tradeStatus === 'loading' && (
            <section className="complex-sidebar__section" aria-live="polite">
              <h3>{SIDEBAR_MESSAGES.tradesTitle}</h3>
              <p className="complex-sidebar__loading">
                {SIDEBAR_MESSAGES.tradesLoading}
              </p>
            </section>
          )}
          {data.tradeStatus === 'failed' && (
            <section
              className="complex-sidebar__section complex-sidebar__error"
              role="alert"
            >
              <h3>{SIDEBAR_MESSAGES.tradesTitle}</h3>
              <p>{SIDEBAR_MESSAGES.tradesFailed}</p>
              <button type="button" onClick={data.retryTrades}>
                {SIDEBAR_MESSAGES.retry}
              </button>
            </section>
          )}
          {data.trades && (
            <TradeHistory trades={selectedAreaTrades} areaKey={selectedAreaKey} />
          )}
        </section>

        <p className="complex-sidebar__proposal-notice">
          {SIDEBAR_MESSAGES.governmentProposalNotice}
        </p>
      </div>
    </div>
  )
}
