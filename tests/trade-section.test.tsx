import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { SIDEBAR_MESSAGES } from '../src/messages/sidebar'
import { TradeSection } from '../src/sidebar/TradeSection'

vi.mock('../src/sidebar/YearlyTradeChart', () => ({
  YearlyTradeChart: () => null,
}))

describe('address trade section', () => {
  it('uses the existing empty-trade guidance for a successful empty result', () => {
    const markup = renderToStaticMarkup(
      <TradeSection trades={[]} status="loaded" onRetry={vi.fn()} />,
    )

    expect(markup).toContain(SIDEBAR_MESSAGES.tradesEmpty)
  })

  it('renders a rowhouse trade with the existing trade-history UI', () => {
    const markup = renderToStaticMarkup(
      <TradeSection
        trades={[{
          tradeId: 'rowhouse-trade-1',
          source: 'rowhouse',
          matchLevel: 'lot',
          dealDate: '2026-06-14',
          dealAmount: 1_460_000_000,
          exclusiveArea: 135.84,
          floor: 4,
        }]}
        status="loaded"
        onRetry={vi.fn()}
      />,
    )

    expect(markup).toContain('1,460,000,000 원')
    expect(markup).toContain('2026-06-14')
    expect(markup).toContain('135.84㎡')
  })
})
