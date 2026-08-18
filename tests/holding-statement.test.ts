import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import type { PortfolioItemSeed } from '../shared/portfolio'
import { HOLDING_TAX_DEFAULT_YEAR } from '../src/holding-screen/assessment-calendar'
import { calculatePortfolioHoldingTax } from '../src/holding-screen/calculation'
import { comprehensiveRows } from '../src/holding-screen/comprehensive-table-rows'
import {
  type HoldingTaxConditionValues,
} from '../src/holding-screen/condition-values'
import { holdingTaxChangeRows } from '../src/holding-screen/holding-tax-change-rows'
import { HoldingTaxChangeReasons } from '../src/holding-screen/HoldingTaxChangeReasons'
import {
  OfficialPriceGrowthFact,
  OfficialPriceHistoryFacts,
} from '../src/holding-screen/OfficialPriceGrowthFact'
import { HoldingTaxResultSummary } from '../src/holding-screen/HoldingTaxResultSummary'
import { propertyRows } from '../src/holding-screen/property-table-rows'
import { totalRows } from '../src/holding-screen/total-table-rows'
import { ownershipShareFromFraction } from '../src/portfolio/ownership-share'
import { createStoredPortfolioItem } from '../src/portfolio/state'

const EUNMA_OFFICIAL_PRICE = 2_237_000_000
const EUNMA_PRIOR_OFFICIAL_PRICES = [
  { baseDate: '2025-01-01', price: 1_708_000_000 },
  { baseDate: '2024-01-01', price: 1_499_000_000 },
  { baseDate: '2023-01-01', price: 1_251_000_000 },
  { baseDate: '2022-01-01', price: 1_738_000_000 },
  { baseDate: '2021-01-01', price: 1_456_000_000 },
  { baseDate: '2020-01-01', price: 1_307_000_000 },
  { baseDate: '2019-01-01', price: 936_000_000 },
  { baseDate: '2018-01-01', price: 840_000_000 },
  { baseDate: '2017-01-01', price: 742_000_000 },
  { baseDate: '2016-01-01', price: 630_000_000 },
  { baseDate: '2015-01-01', price: 557_000_000 },
  { baseDate: '2014-01-01', price: 520_000_000 },
  { baseDate: '2013-01-01', price: 508_000_000 },
  { baseDate: '2012-01-01', price: 620_000_000 },
  { baseDate: '2011-01-01', price: 671_000_000 },
  { baseDate: '2010-01-01', price: 700_000_000 },
  { baseDate: '2009-01-01', price: 572_000_000 },
  { baseDate: '2008-01-01', price: 744_000_000 },
  { baseDate: '2007-01-01', price: 776_000_000 },
  { baseDate: '2006-01-01', price: 542_000_000 },
] as const

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
  priorOfficialPrices: EUNMA_PRIOR_OFFICIAL_PRICES,
})

const NO_OFFICIAL_PRICE_GROWTH = 0

const conditionsFor = (itemId: string): HoldingTaxConditionValues => ({
  ownerAge: 0,
  // 세법 규칙을 고정하는 케이스다. 제품 기본 상승률이 바뀌어도 흔들리면 안 되므로
  // 상승률은 0 으로 못 박는다. 상승률 자체를 보는 케이스는 따로 값을 넘긴다.
  annualOfficialPriceGrowthRate: NO_OFFICIAL_PRICE_GROWTH,
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
    expect(html).toContain('7,999,398 원')
    expect(html).toContain('지금보다 680,044원 늘어요.')
    expect(html).toContain('2026년 현행 7,319,354 원 · 2030년 7,999,398 원')
    expect(html).toContain('무엇 때문에 늘었나요?')
    expect(html).toContain('계산 근거 보기')
  })

  it('keeps the capped Eunma totals and hides every all-zero row', () => {
    const comparison = calculatedComparison(1)

    expect(comparison.calculations.map(({ result }) => result.totalTax))
      .toEqual([7_319_354, 7_999_398, 7_999_398, 7_999_398, 7_999_398])

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
    expect(comprehensive.rows).toHaveLength(8)
    expect(comprehensive.hiddenCount).toBe(1)
    expect(totals.rows).toHaveLength(3)
    expect([
      ...property.rows,
      ...comprehensive.rows,
      ...totals.rows,
    ]).toHaveLength(17)
    expect(comprehensive.rows.find(({ label }) => label === '재산세 공제'))
      .toMatchObject({ amount: '−1,406,160 원' })
    expect(comprehensive.rows.find(
      ({ label }) => label === '세부담상한 차감액',
    )).toMatchObject({ amount: '0 원' })
    expect(comprehensive.rows.some(({ amount }) => amount.includes('−0')))
      .toBe(false)
    expect(comprehensive.rows.map(({ label }) => label))
      .not.toContain('세액공제')
    expect(comprehensiveRows(comparison.calculations, 2026).rows.map(
      ({ label, amount }) => [label, amount],
    )).toEqual([
      ['합산 공시가격', '2,237,000,000 원'],
      ['기본공제', '1,200,000,000 원'],
      ['과세표준', '622,200,000 원'],
      ['산출세액', '3,822,000 원'],
      ['재산세 공제', '−872,376 원'],
      ['세부담상한 차감액', '−451,314 원'],
      ['농어촌특별세', '499,662 원'],
      ['합계', '2,997,972 원'],
    ])
    const capBasisByYear = Object.fromEntries(
      ([2026, 2027, 2028] as const).map((year) => [
        year,
        comprehensiveRows(comparison.calculations, year).rows.find(
          ({ label }) => label === '세부담상한 차감액',
        )?.basis,
      ]),
    )
    expect(capBasisByYear).toEqual({
      2026: '실제 2025년 공시가격·2025년 시행 세법으로 계산',
      2027: '공시가격 상승률 가정으로 계산한 전년도 기준액(모형)',
      2028: '공시가격 상승률 가정으로 계산한 전년도 기준액(모형)',
    })
    expect(capBasisByYear[2026]).not.toContain('모형')
    const changeRows = holdingTaxChangeRows(comparison.calculations)
    expect(changeRows).toEqual([
      {
        key: '2026:2027:burdenCap',
        label: '세부담상한',
        fromYear: 2026,
        toYear: 2027,
        fromValue: '541,577원 차감',
        toValue: '적용 없음',
        contribution: 541_577,
      },
      {
        key: '2026:2027:beforeBurdenCap',
        label: '상한 적용 전 세액',
        fromYear: 2026,
        toYear: 2027,
        fromValue: '7,860,931원',
        toValue: '7,999,398원',
        contribution: 138_467,
      },
    ])
    expect(changeRows.reduce(
      (total, { contribution }) => total + contribution,
      0,
    )).toBe(7_999_398 - 7_319_354)

    const reasonsHtml = renderToStaticMarkup(
      createElement(HoldingTaxChangeReasons, {
        calculations: comparison.calculations,
      }),
    )
    expect(reasonsHtml).toContain('138,467원 늘리는 요인')
    expect(reasonsHtml).toContain('541,577원 늘리는 요인')
    expect(reasonsHtml).toContain(
      '2026년 541,577원 차감 → 2027년 적용 없음',
    )
  })

  it('hides the burden-cap row when all three years have no deduction', () => {
    const itemId = 'eunma-without-prior-history'
    const item = {
      ...createStoredPortfolioItem({
        ...seed(),
        priorOfficialPrices: [],
      }, itemId),
      residency: 'residing' as const,
      areaKind: 'general' as const,
    }
    const comparison = calculatePortfolioHoldingTax(
      [item],
      conditionsFor(itemId),
    )
    if (comparison.status !== 'calculated') {
      throw new TypeError(`Unexpected status: ${comparison.status}`)
    }

    const statement = comprehensiveRows(
      comparison.calculations,
      HOLDING_TAX_DEFAULT_YEAR,
    )
    expect(statement.rows.map(({ label }) => label))
      .not.toContain('세부담상한 차감액')
    expect(statement.hiddenCount).toBe(2)
    expect(statement.rows.some(({ amount }) => amount.includes('−0')))
      .toBe(false)
  })

  it('labels an unavailable observed burden cap as not applied', () => {
    const itemId = 'eunma-missing-observed-cap'
    const item = {
      ...createStoredPortfolioItem({
        ...seed(),
        priorOfficialPrices: [],
      }, itemId),
      residency: 'residing' as const,
      areaKind: 'general' as const,
    }
    const comparison = calculatePortfolioHoldingTax(
      [item],
      {
        ...conditionsFor(itemId),
        annualOfficialPriceGrowthRate: 1,
      },
    )
    if (comparison.status !== 'calculated') {
      throw new TypeError(`Unexpected status: ${comparison.status}`)
    }

    expect(comprehensiveRows(comparison.calculations, 2026).rows.find(
      ({ label }) => label === '세부담상한 차감액',
    )).toMatchObject({
      amount: '계산 불가',
      basis: '전년도 공시가격 이력이 없어 미적용',
    })
  })

  it.each([
    { rate: 0, expectedValue: '연 0% (그대로)' },
    { rate: 0.05, expectedValue: '연 5%' },
    { rate: 0.1, expectedValue: '연 10%' },
  ])('shows a $expectedValue official-price assumption input', ({
    rate,
    expectedValue,
  }) => {
    const comparison = calculatedComparison(1)
    const html = renderToStaticMarkup(createElement(OfficialPriceGrowthFact, {
      annualGrowthRate: rate,
      items: comparison.taxedItems,
      onChange: () => undefined,
    }))

    expect(html).toContain('공시가격 상승률')
    expect(html).toContain('자동 확인')
    expect(html).toContain(expectedValue)
    expect(html).toContain('수정')
  })

  it('summarizes volatility and initially shows five observed Eunma years', () => {
    const comparison = calculatedComparison(1)
    const html = renderToStaticMarkup(createElement(OfficialPriceHistoryFacts, {
      items: comparison.taxedItems,
    }))

    expect(html).toContain('예측값이 아니라 조회한 공시가격 이력이에요')
    expect(html).toContain(
      '최근 5년 연평균 상승률(CAGR) 약 +9% · ' +
      '최고 +43.2%(2007년) · 최저 −28.0%(2023년)',
    )
    expect(html).toContain('2022년 1,738,000,000원 · 전년 대비 +19.4%')
    expect(html).toContain('2023년 1,251,000,000원 · 전년 대비 −28.0%')
    expect(html).toContain('2024년 1,499,000,000원 · 전년 대비 +19.8%')
    expect(html).toContain('2025년 1,708,000,000원 · 전년 대비 +13.9%')
    expect(html).toContain('2026년 2,237,000,000원 · 전년 대비 +31.0%')
    expect(html).not.toContain('2021년 1,456,000,000원')
    expect(html).not.toMatch(/-\d/)
    expect(html.match(/<li>/g)).toHaveLength(5)
    expect(html).toContain('전체 이력 보기')
    expect(html).toContain('aria-expanded="false"')
  })

  it('states the available span when fewer than five years exist', () => {
    const item = createStoredPortfolioItem({
      ...seed(),
      priorOfficialPrices: [
        { baseDate: '2025-01-01', price: 1_708_000_000 },
        { baseDate: '2024-01-01', price: 1_499_000_000 },
      ],
    }, 'short-history')
    const html = renderToStaticMarkup(createElement(OfficialPriceHistoryFacts, {
      items: [item],
    }))

    expect(html).toContain('최근 2년 연평균 상승률(CAGR)')
    expect(html.match(/<li>/g)).toHaveLength(3)
    expect(html).not.toContain('전체 이력 보기')
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
