import { useEffect, useMemo, useState } from 'react'

import { HOLDING_TAX_MESSAGES } from '../messages/holding-tax'
import type { PortfolioController } from '../portfolio'
import {
  calculatePortfolioHoldingTax,
  getHoldingTaxMissingConditions,
  type HoldingTaxComparison,
} from './calculation'
import { restoreHoldingTaxConditionValues } from './condition-values'
import { HoldingTaxConditionsModal } from './HoldingTaxConditionsModal'
import { TaxTrend } from './TaxTrend'
import { buildHoldingTaxTrend } from './trend-series'
import './holding-tax-overlay.css'

const ZERO_SHARE = 0
const ONE_HOUSE = 1

export function HoldingTaxOverlay({
  controller,
  onClose,
}: {
  readonly controller: PortfolioController
  readonly onClose: () => void
}) {
  const [conditions, setConditions] = useState(() =>
    restoreHoldingTaxConditionValues(controller.items))
  const taxedItems = useMemo(
    () => controller.items.filter(
      ({ ownershipShare }) => ownershipShare > ZERO_SHARE,
    ),
    [controller.items],
  )
  const missingConditions = useMemo(
    () => getHoldingTaxMissingConditions(
      taxedItems,
      conditions,
    ),
    [conditions, taxedItems],
  )
  const [conditionsOpen, setConditionsOpen] = useState(
    () => !(taxedItems.length > 0 && missingConditions.length === 0),
  )
  const comparison = useMemo<HoldingTaxComparison>(() =>
    calculatePortfolioHoldingTax(controller.items, conditions), [
    conditions,
    controller.items,
  ])
  /*
   * 조건은 첫 해 기준으로 한 번만 적는다. 연도마다 나이를 한 살씩 올려 적으면
   * 여섯 해치가 줄줄이 붙어 정작 무엇을 가정했는지가 안 읽힌다.
   *
   * 다주택이면 나이·보유·거주기간을 아예 안 적는다 — 그 공제를 받을 수 없어
   * 계산에 쓰이지 않는 값이다. 안 쓰는 값을 조건이라고 적으면 거짓말이 된다.
   */
  const assumptionSummary = comparison.status !== 'calculated'
    ? null
    : HOLDING_TAX_MESSAGES.conditionSummary({
        year: comparison.calculations[0].year,
        householdHomeCount: comparison.householdHomeCount,
        ownerAge: comparison.householdHomeCount === ONE_HOUSE
          ? comparison.ownerAgeByYear[comparison.calculations[0].year]
          : null,
        items: comparison.taxedItems.map((item, itemIndex) => ({
          name: item.complexName,
          residing: item.residency === 'residing',
          holdingYears: comparison.householdHomeCount === ONE_HOUSE
            ? comparison
              .holdingYearsByItemAndYear[comparison.calculations[0].year][item.id]
            : null,
          residenceYears: comparison.householdHomeCount === ONE_HOUSE
            ? comparison.calculations[0].input.items[itemIndex].residenceYears
            : null,
        })),
        annualOfficialPriceGrowthRate: conditions.annualOfficialPriceGrowthRate,
      })

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="holding-overlay"
      aria-labelledby="holding-overlay-title"
    >
      <header className="holding-overlay__header">
        <div className="holding-overlay__title-row">
          <h1 id="holding-overlay-title">{HOLDING_TAX_MESSAGES.title}</h1>
          <button type="button" autoFocus onClick={onClose}>
            {HOLDING_TAX_MESSAGES.close}
          </button>
        </div>

        {assumptionSummary !== null && (
          <section
            className="holding-assumptions"
            aria-labelledby="holding-assumptions-title"
          >
            <div className="holding-assumptions__summary">
              <div>
                <strong id="holding-assumptions-title">
                  {HOLDING_TAX_MESSAGES.assumptionsTitle}
                </strong>
                <p>{assumptionSummary}</p>
              </div>
              <button
                type="button"
                aria-expanded={conditionsOpen}
                onClick={() => setConditionsOpen((current) => !current)}
              >
                {conditionsOpen
                  ? HOLDING_TAX_MESSAGES.assumptionsDone
                  : HOLDING_TAX_MESSAGES.assumptionsChange}
              </button>
            </div>
          </section>
        )}
      </header>

      <main className="holding-overlay__content">

        {comparison.status === 'empty' && (
          <section className="holding-overlay__status">
            <h2>{HOLDING_TAX_MESSAGES.emptyTitle}</h2>
            <p>{HOLDING_TAX_MESSAGES.emptyDescription}</p>
          </section>
        )}
        {comparison.status === 'noTaxedItems' && (
          <section className="holding-overlay__status">
            <h2>{HOLDING_TAX_MESSAGES.noTaxedItemsTitle}</h2>
            <p>{HOLDING_TAX_MESSAGES.noTaxedItemsDescription}</p>
          </section>
        )}
        {comparison.status === 'missingOfficialPrices' && (
          <section className="holding-overlay__status holding-overlay__status--warning">
            <h2>{HOLDING_TAX_MESSAGES.missingPriceTitle}</h2>
            <ul>
              {comparison.missingItems.map((item) => (
                <li key={item.id}>
                  {HOLDING_TAX_MESSAGES.missingPriceReason(item.complexName)}
                </li>
              ))}
            </ul>
          </section>
        )}
        {/*
          조건 모달이 열려도 결과는 그대로 둔다. 시안이 그렇게 한다 —
          숨기면 카드가 헤더 높이로 쪼그라들고, 그 안에 뜬 모달까지 같이 작아진다.
          바꾼 조건이 뒤에서 어떤 숫자를 움직이는지도 보이지 않는다.
        */}
        {comparison.status === 'calculated' && (
          <>
            {/*
              시안(shell-v2)의 결과 화면은 개편 전후 비교가 아니라 연도별 추이다.
              "개편안이 얼마를 물리나"가 아니라 "내 보유세가 어떻게 움직이나"에
              답한다. 그래서 변경 이유·비교표를 앞에 세우지 않는다.
            */}
            <TaxTrend
              annualOfficialPriceGrowthRate={
                conditions.annualOfficialPriceGrowthRate
              }
              calculations={comparison.calculations}
              focusYear={comparison.calculations[0].year}
              series={buildHoldingTaxTrend(
                comparison.calculations,
                comparison.priorYearCalculation,
              )}
              taxedItems={comparison.taxedItems}
            />
            {/*
              시안에는 유의사항이 없다. 그건 목업이라 법적 의무가 없었기 때문이고,
              우리는 세무서가 아니며 개편안은 아직 국회를 통과하지 않았다.
              이 두 문장은 화면 구성 요소가 아니라 고지 의무라서 남긴다.
            */}
            <section className="holding-overlay__cautions">
              <h2>{HOLDING_TAX_MESSAGES.cautionsTitle}</h2>
              {HOLDING_TAX_MESSAGES.cautions.map((caution) => (
                <p key={caution}>{caution}</p>
              ))}
            </section>
          </>
        )}
      </main>

      {/*
        조건은 시안대로 모달로 묻는다. 본문에 펼쳐 두면 결과를 보러 온 화면에
        입력 폼이 먼저 서고, 그러면 이 화면이 무엇을 보여주는 곳인지 흐려진다.
      */}
      {conditionsOpen && controller.items.length > 0 && (
        <HoldingTaxConditionsModal
          controller={controller}
          onCancel={() => setConditionsOpen(false)}
          onSubmit={() => {
            // 모달이 저장까지 마쳤다. 저장된 값을 다시 읽어 계산에 반영한다.
            setConditions(restoreHoldingTaxConditionValues(controller.items))
            setConditionsOpen(false)
          }}
          variant="edit"
        />
      )}
    </div>
  )
}
