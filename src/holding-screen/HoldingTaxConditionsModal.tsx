import { useState } from 'react'

import type { StoredPortfolioItem } from '../../shared/portfolio'
import { formatArea } from '../format/property'
import { HOLDING_TAX_MESSAGES } from '../messages/holding-tax'
import type { PortfolioController } from '../portfolio'
import {
  type HoldingTaxConditionValues,
  type HoldingTaxItemConditionValues,
  persistHoldingTaxConditionValues,
  restoreHoldingTaxConditionValues,
} from './condition-values'

const ZERO_YEARS = 0
const ZERO_SHARE = 0
const ONE_HOUSE = 1

/*
 * 칩이 고르는 값은 구간의 최솟값이다. 세액공제는 구간별 정액이라
 * 「65—69세」와 「정확히 67세」가 같은 공제율을 낳는다 — 그래서 나이를
 * 한 살 단위로 묻지 않는다. 시안이 칩을 쓴 이유가 이것이다.
 */
const AGE_BANDS = [
  { value: 0, label: HOLDING_TAX_MESSAGES.ageBandUnder(60) },
  { value: 60, label: HOLDING_TAX_MESSAGES.ageBandRange(60, 64) },
  { value: 65, label: HOLDING_TAX_MESSAGES.ageBandRange(65, 69) },
  { value: 70, label: HOLDING_TAX_MESSAGES.ageBandOver(70) },
] as const

const PERIOD_BANDS = [
  { value: 0, label: HOLDING_TAX_MESSAGES.periodBandUnder(5) },
  { value: 5, label: HOLDING_TAX_MESSAGES.periodBandRange(5, 9) },
  { value: 10, label: HOLDING_TAX_MESSAGES.periodBandRange(10, 14) },
  { value: 15, label: HOLDING_TAX_MESSAGES.periodBandOver(15) },
] as const

type Band = { readonly value: number; readonly label: string }

const LONGEST_PERIOD_BAND = PERIOD_BANDS[PERIOD_BANDS.length - 1].value

const bandValue = (bands: readonly Band[], years: number): number =>
  [...bands].reverse().find(({ value }) => years >= value)?.value ?? ZERO_YEARS

/** 계산 전에 묻는 모달과 결과에서 여는 모달은 제목과 버튼만 다르다. */
export type HoldingTaxConditionsVariant = 'beforeCalculation' | 'edit'

function ChipGroup({
  bands,
  disabledAbove,
  onSelect,
  selected,
  title,
}: {
  readonly bands: readonly Band[]
  /** 이 값을 넘는 구간은 고를 수 없다. 없으면 전부 고를 수 있다. */
  readonly disabledAbove?: number
  readonly onSelect: (value: number) => void
  readonly selected: number
  readonly title: string
}) {
  return (
    <div>
      <h3>{title}</h3>
      <div className="chips">
        {bands.map(({ value, label }) => (
          <button
            key={label}
            type="button"
            aria-pressed={selected === value}
            disabled={disabledAbove !== undefined && value > disabledAbove}
            onClick={() => onSelect(value)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * 세액을 가르는 조건 — 시안 shell-v2.html 의 조건 모달.
 *
 * 세대의 주택 수는 묻지 않는다. 내 부동산 목록에서 세면 되는 값을 다시 물으면
 * 두 곳이 어긋날 수 있다 — 그래서 파생값으로 보여주기만 한다.
 *
 * **거주는 담은 집 가운데 한 곳이다.** 사람은 한 곳에 살고, 엑셀도 그렇게 본다 —
 * 행 24 `소유자1 거주지`에 `거주` 표시가 한 칸뿐이고 공제 수식이
 * `MATCH("거주", $K24:$N24, 0)` 으로 첫 하나를 찾는다. 그래서 1주택이면 아예 묻지
 * 않고 그 집에 산다고 보며, 다주택이면 어느 집인지만 고르게 한다.
 *
 * **1세대1주택**: 나이·보유기간·거주기간.
 *
 * **다주택**: 「어느 집에 살고 계신가요」 하나. 나이·보유·거주기간 공제는 다주택이
 * 받을 수 없어 답이 세액에 닿지 않는다 — 시안이 그 넷을 감춘 것이 맞다.
 * 다만 거주는 다르다. 개편안의 다주택 기본공제가
 * `4억 + 5억 × 거주주택 공시가격 비중` 이라 세액을 직접 가르는데
 * (docs/holding-tax-v3-spec.md §3.2), 시안의 목업 엔진은 다주택 공제를
 * 9억 고정으로 두고 있어 그 차이를 몰랐다.
 */
export function HoldingTaxConditionsModal({
  controller,
  onCancel,
  onSubmit,
  variant,
}: {
  readonly controller: PortfolioController
  readonly onCancel: () => void
  readonly onSubmit: () => void
  readonly variant: HoldingTaxConditionsVariant
}) {
  const [conditions, setConditions] = useState<HoldingTaxConditionValues>(
    () => restoreHoldingTaxConditionValues(controller.items),
  )
  const taxedItems = controller.items.filter(
    ({ ownershipShare }) => ownershipShare > ZERO_SHARE,
  )
  const householdHomeCount = controller.items.length
  const isOneHouse = householdHomeCount === ONE_HOUSE
  const item: StoredPortfolioItem | undefined = taxedItems[0]
  const itemConditions: HoldingTaxItemConditionValues | undefined =
    item === undefined ? undefined : conditions.items[item.id]

  /*
   * 다주택은 담은 집 가운데 한 곳이 거주지다 — 「어디에도 안 산다」는 선택지가 없다.
   * 아직 안 골랐으면 첫 집으로 본다.
   *
   * 1주택은 다르다. 안 사는 경우가 실제로 있고(전세 살면서 한 채 보유),
   * 엑셀이 거주 14억 / 비거주 9억으로 가른다(`K37`). 그래서 물어본다.
   */
  const residingItem =
    taxedItems.find(({ residency }) => residency === 'residing') ?? item
  const oneHouseResiding = item?.residency !== 'nonResiding'

  const withItem = (
    current: HoldingTaxConditionValues,
    itemId: string,
    update: Partial<HoldingTaxItemConditionValues>,
  ): HoldingTaxConditionValues => {
    const existing = current.items[itemId]
    if (existing === undefined) return current
    return {
      ...current,
      items: { ...current.items, [itemId]: { ...existing, ...update } },
    }
  }

  /** 고른 집만 거주로 두고 나머지는 비거주로 되돌린다. */
  const applyResidingHome = (
    current: HoldingTaxConditionValues,
    residingItemId: string,
  ): HoldingTaxConditionValues => {
    let next = current
    for (const target of taxedItems) {
      const residing = target.id === residingItemId
      controller.update(target.id, {
        residency: residing ? 'residing' : 'nonResiding',
      })
      // 살고 있다고 보면 계속 산다고 본다. 시안은 이후 계획을 따로 묻지 않는다.
      next = withItem(next, target.id, {
        continuesResidence: residing,
        qualifyingRelocation: residing ? null : false,
      })
    }
    return next
  }

  const holdingBand = itemConditions === undefined
    ? ZERO_YEARS
    : bandValue(PERIOD_BANDS, itemConditions.holdingYears)
  const residenceBand = itemConditions === undefined
    ? ZERO_YEARS
    : bandValue(PERIOD_BANDS, itemConditions.residenceYears)
  const ready = item !== undefined &&
    (!isOneHouse || itemConditions !== undefined)

  return (
    <div
      className={variant === 'edit' ? 'mbox mbox--fixed' : 'mbox'}
      role="dialog"
      aria-modal="true"
      aria-label={HOLDING_TAX_MESSAGES.conditionsModalTitle[variant]}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div className="mbox__card">
        <div className="mbox__head">
          {item !== undefined && (
            <p>
              {HOLDING_TAX_MESSAGES.conditionsModalItemLabel(
                item.complexName,
                item.exclusiveArea === null
                  ? null
                  : formatArea(item.exclusiveArea),
              )}
            </p>
          )}
          <h2>{HOLDING_TAX_MESSAGES.conditionsModalTitle[variant]}</h2>
        </div>

        <div className="mbox__body">
          <div className="basisrow">
            <div className="basisrow__label">
              <strong>
                {HOLDING_TAX_MESSAGES.conditionsModalHomeCountLabel}
              </strong>
              <span>{HOLDING_TAX_MESSAGES.conditionsModalHomeCountHint}</span>
            </div>
            <p className="basisderived">
              {HOLDING_TAX_MESSAGES.conditionsModalHomeCountValue(
                isOneHouse
                  ? HOLDING_TAX_MESSAGES.conditionsModalOneHouse
                  : HOLDING_TAX_MESSAGES.conditionsModalMultiHouse(
                      householdHomeCount,
                    ),
                householdHomeCount,
              )}
            </p>
          </div>

          {!isOneHouse && (
            <div>
              <h3>{HOLDING_TAX_MESSAGES.conditionsModalWhichHome}</h3>
              <div className="chips">
                {taxedItems.map((taxedItem) => (
                  <button
                    key={taxedItem.id}
                    type="button"
                    aria-pressed={residingItem?.id === taxedItem.id}
                    onClick={() =>
                      setConditions(applyResidingHome(conditions, taxedItem.id))}
                  >
                    {taxedItem.complexName}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isOneHouse && (
            <ChipGroup
              bands={AGE_BANDS}
              onSelect={(ownerAge) => setConditions({ ...conditions, ownerAge })}
              selected={bandValue(AGE_BANDS, conditions.ownerAge)}
              title={HOLDING_TAX_MESSAGES.conditionsModalAge}
            />
          )}

          {isOneHouse && item !== undefined && itemConditions !== undefined && (
            <ChipGroup
              bands={PERIOD_BANDS}
              onSelect={(holdingYears) => {
                /*
                 * 거주기간은 보유기간을 넘을 수 없다 — 사기 전에 살 수는 없다.
                 * 보유를 줄이면 거주도 같이 내려앉힌다. 안 그러면 화면에
                 * 「5—9년 보유 / 10—14년 거주」 같은 값이 남는다.
                 */
                const next = withItem(conditions, item.id, { holdingYears })
                setConditions(
                  itemConditions.residenceYears > holdingYears
                    ? withItem(next, item.id, { residenceYears: holdingYears })
                    : next,
                )
              }}
              selected={holdingBand}
              title={HOLDING_TAX_MESSAGES.conditionsModalHolding}
            />
          )}

          {isOneHouse && item !== undefined && (
            <div>
              <h3>{HOLDING_TAX_MESSAGES.conditionsModalResidency}</h3>
              <div className="chips">
                <button
                  type="button"
                  aria-pressed={oneHouseResiding}
                  onClick={() =>
                    setConditions(applyResidingHome(conditions, item.id))}
                >
                  {HOLDING_TAX_MESSAGES.residencyResiding}
                </button>
                <button
                  type="button"
                  aria-pressed={!oneHouseResiding}
                  onClick={() => setConditions(applyResidingHome(conditions, ''))}
                >
                  {HOLDING_TAX_MESSAGES.residencyNonResiding}
                </button>
              </div>
            </div>
          )}

          {isOneHouse && oneHouseResiding && item !== undefined &&
            itemConditions !== undefined && (
              <div>
                <ChipGroup
                  bands={PERIOD_BANDS}
                  disabledAbove={holdingBand}
                  onSelect={(residenceYears) =>
                    setConditions(
                      withItem(conditions, item.id, { residenceYears }),
                    )}
                  selected={residenceBand}
                  title={HOLDING_TAX_MESSAGES.conditionsModalResidence}
                />
                {/* 왜 잠겼는지 말해 준다. 잠긴 모양만으로는 이유가 안 보인다. */}
                {holdingBand < LONGEST_PERIOD_BAND && (
                  <p className="chips__note">
                    {HOLDING_TAX_MESSAGES.conditionsModalResidenceCappedByHolding(
                      PERIOD_BANDS.find(({ value }) => value === holdingBand)
                        ?.label ?? '',
                    )}
                  </p>
                )}
              </div>
            )}

          <p className="mbox__note">
            {isOneHouse
              ? HOLDING_TAX_MESSAGES.conditionsModalOneHouseNote
              : HOLDING_TAX_MESSAGES.conditionsModalMultiHouseNote}
          </p>
        </div>

        <div className="mbox__foot">
          <button
            className="cta"
            type="button"
            disabled={!ready}
            onClick={() => {
              if (!ready || item === undefined) return
              /*
               * 안 고른 채 넘어가면 거주지를 확정한다 — 다주택은 첫 집,
               * 1주택은 그 집. 「안 살아요」를 고른 1주택은 그대로 둔다.
               */
              const allAnswered = taxedItems.every(
                ({ residency }) => residency !== null,
              )
              const next = allAnswered
                ? conditions
                : applyResidingHome(conditions, (residingItem ?? item).id)
              setConditions(next)
              try {
                persistHoldingTaxConditionValues(next)
              } catch {
                // 저장에 실패해도 이번 세션의 계산은 그대로 쓸 수 있다.
              }
              onSubmit()
            }}
          >
            <span>{HOLDING_TAX_MESSAGES.conditionsModalSubmit[variant]}</span>
            <span className="cta__badge" aria-hidden="true">›</span>
          </button>
          <button className="ghost" type="button" onClick={onCancel}>
            {HOLDING_TAX_MESSAGES.conditionsModalCancel[variant]}
          </button>
        </div>
      </div>
    </div>
  )
}
