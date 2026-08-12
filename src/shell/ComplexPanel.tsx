import { useState } from 'react'

import type { PortfolioItemSeed } from '../../shared/portfolio'
import { SHELL_MESSAGES } from '../messages/shell'
import { SIDEBAR_MESSAGES } from '../messages/sidebar'
import { ComplexBasics } from '../sidebar/ComplexBasics'
import { TradeHistory } from '../sidebar/TradeHistory'
import { YearlyTradeChart } from '../sidebar/YearlyTradeChart'
import {
  availableTradeAreas,
  defaultTradeAreaKey,
  filterTradesByArea,
} from '../sidebar/trade-filter-data'
import { useSidebarData } from '../sidebar/useSidebarData'
import { useLayerHistory } from './layer-history'
import { UnitLookup } from './UnitLookup'
// ComplexSidebar 를 안 쓰므로 그 CSS 를 여기서 싣는다 —
// 단지 정보·섹션·「거래 더 보기」가 전부 이 파일에 있다.
import '../sidebar/complex-sidebar.css'

const ALL_YEARS = 'all'
const YEAR_LENGTH = 4

/**
 * 단지 패널 — claude.ai/design 시안(shell-v2.html, SidebarBody).
 *
 * 시안이 탭을 없앴다. 공시가격은 동·호가 정해져야 나오는 값이라 상시 자리를 주면
 * 대부분의 시간 동안 비어 있다. 그래서 패널은 단지 정보와 실거래가만 담고,
 * 공시가격은 「보유세 계산」·「내 부동산에 담기」를 누를 때 모달로 묻는다.
 */
export function ComplexPanel({
  complexId,
  addRequestSeq,
  onAddToPortfolio,
}: {
  readonly complexId: string | null
  /** 지도 라벨의 + 를 누를 때마다 증가한다. 같은 단지를 다시 눌러도 모달이 열려야 한다. */
  readonly addRequestSeq: number
  readonly onAddToPortfolio: (seed: PortfolioItemSeed) => void
}) {
  const data = useSidebarData(complexId)
  const [pending, setPending] = useState<'add' | null>(null)
  const [seenAddSeq, setSeenAddSeq] = useState(addRequestSeq)
  if (addRequestSeq !== seenAddSeq) {
    setSeenAddSeq(addRequestSeq)
    setPending('add')
  }
  const [areaKey, setAreaKey] = useState<string | null>(null)
  const [year, setYear] = useState(ALL_YEARS)
  /* 동·호 모달도 지도를 덮는 층이다 — 뒤로가기는 사이트가 아니라 이것을 닫는다. */
  useLayerHistory('unitLookup', pending !== null, () => setPending(null))

  const trades = data.trades?.items ?? []
  const areaOptions = availableTradeAreas(trades)
  const selectedAreaKey =
    areaKey !== null && areaOptions.some((option) => option.key === areaKey)
      ? areaKey
      : defaultTradeAreaKey(areaOptions)
  const areaTrades = filterTradesByArea(trades, selectedAreaKey)
  const years = [
    ...new Set(areaTrades.map((trade) => trade.dealDate.slice(0, YEAR_LENGTH))),
  ].sort().reverse()
  const shownTrades = years.includes(year)
    ? areaTrades.filter((trade) => trade.dealDate.slice(0, YEAR_LENGTH) === year)
    : areaTrades

  return (
    <div className="complex-sidebar">
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
          <div className="sidehead">
            <ComplexBasics complex={data.detail}>
              {data.detail.placeUrl && (
                <a
                  className="sidehead__place-link"
                  href={data.detail.placeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {SHELL_MESSAGES.kakaoComplexDetails}
                </a>
              )}
            </ComplexBasics>
            <div className="sidehead__acts">
              <button
                className="cta"
                type="button"
                onClick={() => setPending('add')}
              >
                <span>{SHELL_MESSAGES.addFromComplex}</span>
              </button>
            </div>
          </div>
        )}

        <section className="complex-sidebar__section">
          <div className="tradehead">
            <h3>{SHELL_MESSAGES.tradesTitle}</h3>
            {areaOptions.length > 0 && (
              <div className="tradehead__filters">
                <select
                  aria-label={SHELL_MESSAGES.tradeYearLabel}
                  value={years.includes(year) ? year : ALL_YEARS}
                  onChange={(event) => setYear(event.target.value)}
                >
                  <option value={ALL_YEARS}>{SHELL_MESSAGES.tradeYearAll}</option>
                  {years.map((value) => (
                    <option key={value} value={value}>
                      {SHELL_MESSAGES.tradeYearOption(value)}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={SIDEBAR_MESSAGES.areaFilterLabel}
                  value={selectedAreaKey}
                  onChange={(event) => {
                    setAreaKey(event.target.value)
                    setYear(ALL_YEARS)
                  }}
                >
                  {areaOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.area}㎡
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {data.tradeStatus === 'loading' && (
            <p className="complex-sidebar__loading" role="status">
              {SIDEBAR_MESSAGES.tradesLoading}
            </p>
          )}
          {data.tradeStatus === 'failed' && (
            <div className="complex-sidebar__error" role="alert">
              <p>{SIDEBAR_MESSAGES.tradesFailed}</p>
              <button type="button" onClick={data.retryTrades}>
                {SIDEBAR_MESSAGES.retry}
              </button>
            </div>
          )}

          {data.tradeStatus === 'loaded' && (
            <div className="tradebody">
              <TradeHistory trades={shownTrades} areaKey={selectedAreaKey} />
              {areaTrades.length > 0 && (
                <YearlyTradeChart
                  trades={areaTrades}
                  areaLabel={`${selectedAreaKey}㎡`}
                />
              )}
              <p className="pricenote">{SHELL_MESSAGES.priceNote}</p>
            </div>
          )}
        </section>
      </div>

      {pending !== null && data.detail && (
        <UnitLookup
          complex={data.detail}
          mode="add"
          onCancel={() => setPending(null)}
          onConfirm={(seed) => {
            setPending(null)
            onAddToPortfolio(seed)
          }}
        />
      )}
    </div>
  )
}
