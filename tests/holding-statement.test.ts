import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import type { PortfolioItemSeed } from '../shared/portfolio'
import { HOLDING_TAX_DEFAULT_YEAR } from '../src/holding-screen/assessment-calendar'
import { calculatePortfolioHoldingTax } from '../src/holding-screen/calculation'
import { comprehensiveRows } from '../src/holding-screen/comprehensive-table-rows'
import {
  DEFAULT_ANNUAL_OFFICIAL_PRICE_GROWTH_RATE,
  type HoldingTaxConditionValues,
} from '../src/holding-screen/condition-values'
import { holdingTaxChangeRows } from '../src/holding-screen/holding-tax-change-rows'
import { HoldingTaxResultSummary } from '../src/holding-screen/HoldingTaxResultSummary'
import { propertyRows } from '../src/holding-screen/property-table-rows'
import { totalRows } from '../src/holding-screen/total-table-rows'
import { ownershipShareFromFraction } from '../src/portfolio/ownership-share'
import { createStoredPortfolioItem } from '../src/portfolio/state'

const EUNMA_OFFICIAL_PRICE = 2_237_000_000

const seed = (): PortfolioItemSeed => ({
  assetKind: 'apartment',
  complexId: 'eunma-1381',
  legalDongCode: '1168010600',
  complexName: '은마아파트 1동 101호',
  address: '서울특별시 강남구 대치동 316',
  dong: '1',
  ho: '101',
  exclusiveArea: 76.79,
  officialPrice: EUNMA_OFFICIAL_PRICE,
  officialPriceBaseDate: '2026-01-01',
  priorOfficialPrices: [],
})

const conditionsFor = (itemId: string): HoldingTaxConditionValues => ({
  ownerAge: 0,
  annualOfficialPriceGrowthRate:
    DEFAULT_ANNUAL_OFFICIAL_PRICE_GROWTH_RATE,
  items: {
    [itemId]: {
      holdingYears: 0,
      residenceYears: 0,
      continuesResidence: false,
      qualifyingRelocation: false,
    },
  },
})

const calculatedComparison = (ownershipShare: number) => {
  const itemId = `eunma-${ownershipShare}`
  const item = {
    ...createStoredPortfolioItem(seed(), itemId),
    ownershipShare: ownershipShareFromFraction(ownershipShare),
    residency: 'residing' as const,
    areaKind: 'general' as const,
  }
  const comparison = calculatePortfolioHoldingTax(
    [item],
    conditionsFor(itemId),
  )
  if (comparison.status !== 'calculated') {
    throw new TypeError(`Unexpected comparison status: ${comparison.status}`)
  }
  return comparison
}

describe('holding-tax compact statement', () => {
  it('puts the 2027 answer and absolute change in the first-stage headline', () => {
    const comparison = calculatedComparison(1)
    const html = renderToStaticMarkup(
      createElement(HoldingTaxResultSummary, {
        calculations: comparison.calculations,
        detailsOpen: false,
        onDetailsToggle: () => undefined,
        onReasonsToggle: () => undefined,
        reasonsOpen: false,
        taxedItems: comparison.taxedItems,
      }),
    )

    expect(html).toContain('2027년 보유세')
    expect(html).toContain('8,421,246 원')
    expect(html).toContain('지금보다 306,432원 줄어요.')
    expect(html).toContain('2026년 현행 8,727,678 원 · 2028년 8,421,246 원')
    expect(html).toContain('무엇 때문에 줄었나요?')
    expect(html).toContain('계산 근거 보기')
  })

  it('keeps the Eunma tax totals while reducing the statement to 16 rows', () => {
    const comparison = calculatedComparison(1)

    expect(comparison.calculations.map(({ result }) => result.totalTax))
      .toEqual([8_727_678, 8_421_246, 8_421_246])

    const property = propertyRows(
      comparison.calculations,
      0,
      HOLDING_TAX_DEFAULT_YEAR,
    )
    const comprehensive = comprehensiveRows(
      comparison.calculations,
      HOLDING_TAX_DEFAULT_YEAR,
    )
    const totals = totalRows(
      comparison.calculations,
      HOLDING_TAX_DEFAULT_YEAR,
    )

    expect(property.rows.map(({ label }) => label)).toEqual([
      '공시가격',
      '과세표준',
      '재산세',
      '지방교육세',
      '도시지역분',
      '합계',
    ])
    expect(property.rows.map(({ amount }) => amount)).toEqual([
      '2,237,000,000 원',
      '1,006,650,000 원',
      '3,396,600 원',
      '679,320 원',
      '1,409,310 원',
      '5,485,230 원',
    ])
    expect(property.hiddenCount).toBe(3)
    expect(comprehensive.rows).toHaveLength(7)
    expect(comprehensive.hiddenCount).toBe(2)
    expect(totals.rows).toHaveLength(3)
    expect([
      ...property.rows,
      ...comprehensive.rows,
      ...totals.rows,
    ]).toHaveLength(16)
    expect(comprehensive.rows.find(({ label }) => label === '재산세 공제'))
      .toMatchObject({ amount: '−1,054,620 원' })
    expect(comprehensiveRows(comparison.calculations, 2026).rows.map(
      ({ label, amount }) => [label, amount],
    )).toEqual([
      ['합산 공시가격', '2,237,000,000 원'],
      ['기본공제', '1,200,000,000 원'],
      ['과세표준', '622,200,000 원'],
      ['산출세액', '3,822,000 원'],
      ['재산세 공제', '−1,119,960 원'],
      ['농어촌특별세', '540,408 원'],
      ['합계', '3,242,448 원'],
    ])
    expect(holdingTaxChangeRows(comparison.calculations)).toMatchObject([
      { label: '기본공제', fromValue: '1,200,000,000원',
        toValue: '1,400,000,000원' },
      { label: '공정시장가액비율', fromValue: '60%', toValue: '70%' },
      { label: '적용세율', fromValue: '1%', toValue: '0.7%' },
    ])
  })

  it('shows ownership rows only when all three years differ from the source row', () => {
    const full = calculatedComparison(1)
    const partial = calculatedComparison(0.3)
    const fullStatement = propertyRows(
      full.calculations,
      0,
      HOLDING_TAX_DEFAULT_YEAR,
    )
    const partialStatement = propertyRows(
      partial.calculations,
      0,
      HOLDING_TAX_DEFAULT_YEAR,
    )
    const fullLabels = fullStatement.rows.map(({ label }) => label)
    const partialLabels = partialStatement.rows.map(({ label }) => label)

    expect(fullLabels).not.toContain('내 지분 공시가격')
    expect(fullLabels).not.toContain('내 지분 과세표준')
    expect(fullLabels).not.toContain('재산세 지분')
    expect(fullStatement.hiddenCount).toBe(3)
    expect(partialLabels).toEqual(expect.arrayContaining([
      '내 지분 공시가격',
      '내 지분 과세표준',
      '재산세 지분',
    ]))
    expect(partialStatement.hiddenCount).toBe(0)
  })
})
