import type { StoredPortfolioItem } from '../../shared/portfolio'
import { formatInlineWon, formatManwon } from '../format/won'
import { HOLDING_TAX_MESSAGES } from '../messages/holding-tax'
import type { HoldingTaxYearCalculation } from './calculation'
import { formatRate } from './format'
import type { HoldingTaxTrendPoint } from './trend-series'

const ZERO_AMOUNT = 0
const FULL_HEIGHT_PERCENT = 100
const SINGLE_ITEM = 1
const MIN_BAR_PERCENT = 2

/**
 * 연도별 보유세 추이 — claude.ai/design 시안(shell-v2.html, `TaxTrend`).
 *
 * 이 화면이 답하는 질문은 "개편안이 나에게 얼마를 물리나"가 아니라
 * "내 보유세가 앞으로 어떻게 움직이나"다. 그래서 개편 전후 비교가 아니라
 * 해마다 한 막대씩 세운다.
 *
 * 금액은 만원 단위다. 원 단위 아홉 자리를 막대 여섯 개에 얹으면
 * 자릿수만 읽히고 크기 차이가 안 읽힌다.
 */
export function TaxTrend({
  series,
  focusYear,
  calculations,
  taxedItems,
  annualOfficialPriceGrowthRate,
}: {
  readonly series: readonly HoldingTaxTrendPoint[]
  readonly focusYear: number
  readonly calculations: readonly HoldingTaxYearCalculation[]
  readonly taxedItems: readonly StoredPortfolioItem[]
  readonly annualOfficialPriceGrowthRate: number
}) {
  const focusIndex = series.findIndex(({ year }) => year === focusYear)
  const current = series[focusIndex]
  if (current === undefined) return null

  const previous = focusIndex > 0 ? series[focusIndex - 1] : undefined
  const next = series[focusIndex + 1]
  const focusCalculation = calculations.find(({ year }) => year === focusYear)
  const maximum = Math.max(
    ...series.map(({ totalTax }) => totalTax ?? ZERO_AMOUNT),
  )
  const difference = current.totalTax !== null && previous?.totalTax != null
    ? current.totalTax - previous.totalTax
    : null
  const nextDifference = current.totalTax !== null && next?.totalTax != null
    ? next.totalTax - current.totalTax
    : null
  const publishedYears = series
    .filter(({ basis }) => basis === 'published')
    .map(({ year }) => year)
  const comprehensive = focusCalculation?.result.comprehensiveTax
  const taxCredit = comprehensive?.taxCredit
  const creditRates = taxCredit?.status === 'computed' ? taxCredit : null
  const credits = [
    creditRates !== null && creditRates.ageRate > ZERO_AMOUNT
      ? HOLDING_TAX_MESSAGES.trendCreditAge(formatRate(creditRates.ageRate))
      : null,
    creditRates !== null && creditRates.holdingPeriodRate > ZERO_AMOUNT
      ? HOLDING_TAX_MESSAGES.trendCreditHolding(
          formatRate(creditRates.holdingPeriodRate),
        )
      : null,
    creditRates !== null && creditRates.residencePeriodRate > ZERO_AMOUNT
      ? HOLDING_TAX_MESSAGES.trendCreditResidence(
          formatRate(creditRates.residencePeriodRate),
        )
      : null,
  ].filter((part): part is string => part !== null)
  const burdenCapRate = comprehensive?.taxBurdenCap.status === 'computed'
    ? comprehensive.taxBurdenCap.rate
    : null

  return (
    <section className="trend">
      <div className="trend__head">
        <p className="trend__eyebrow">
          {HOLDING_TAX_MESSAGES.headlineTitle(current.year)}
        </p>
        <h2>
          {HOLDING_TAX_MESSAGES.trendApproximate}{' '}
          <strong>
            {current.totalTax === null
              ? HOLDING_TAX_MESSAGES.headlineUnavailable
              : formatManwon(current.totalTax)}
          </strong>
        </h2>
        {previous !== undefined && (
          <p className="trend__diff">
            {difference === null
              ? HOLDING_TAX_MESSAGES.trendDiffUnavailable
              : HOLDING_TAX_MESSAGES.trendDiff(
                  formatManwon(Math.abs(difference)),
                  difference > ZERO_AMOUNT,
                )}
          </p>
        )}
        <div className="trend__split">
          <span>
            {HOLDING_TAX_MESSAGES.trendPropertyTax}{' '}
            <b>{formatManwon(current.propertyTax)}</b>
          </span>
          <span>
            {HOLDING_TAX_MESSAGES.trendComprehensiveTax}{' '}
            <b>
              {current.comprehensiveTax !== null &&
                current.comprehensiveTax > ZERO_AMOUNT
                ? formatManwon(current.comprehensiveTax)
                : HOLDING_TAX_MESSAGES.trendNoComprehensiveTax}
            </b>
          </span>
          {current.burdenCapRelief > ZERO_AMOUNT && (
            <span>
              {HOLDING_TAX_MESSAGES.trendBurdenCapRelief}{' '}
              <b>−{formatManwon(current.burdenCapRelief)}</b>
            </span>
          )}
        </div>
        {next !== undefined && nextDifference !== null &&
          next.totalTax !== null && (
            <p className="trend__next">
              <span>
                {HOLDING_TAX_MESSAGES.trendNextLead(next.year)}
              </span>
              <strong>{formatManwon(next.totalTax)}</strong>
              <em>
                {HOLDING_TAX_MESSAGES.trendNextDelta(
                  formatManwon(Math.abs(nextDifference)),
                  nextDifference > ZERO_AMOUNT,
                )}
              </em>
            </p>
          )}
      </div>

      <div
        className="trend__chart"
        role="img"
        aria-label={HOLDING_TAX_MESSAGES.trendChartLabel}
      >
        {series.map((point) => {
          const amount = point.totalTax ?? ZERO_AMOUNT
          const height = maximum > ZERO_AMOUNT
            ? Math.max(
                MIN_BAR_PERCENT,
                Math.round(amount / maximum * FULL_HEIGHT_PERCENT),
              )
            : ZERO_AMOUNT
          return (
            <div
              key={point.year}
              className={[
                'trend__col',
                point.year === focusYear ? 'is-focus' : '',
                point.basis === 'projected' ? 'is-est' : '',
              ].filter(Boolean).join(' ')}
              title={HOLDING_TAX_MESSAGES.trendBarLabel(
                point.year,
                formatManwon(amount),
                point.basis === 'projected',
              )}
            >
              <b>{formatManwon(amount)}</b>
              <i style={{ height: `${height}%` }} />
              <span>{String(point.year).slice(2)}</span>
            </div>
          )
        })}
      </div>

      {taxedItems.length > SINGLE_ITEM && focusCalculation !== undefined && (
        <div className="perprop">
          <table>
            <thead>
              <tr>
                <th>{HOLDING_TAX_MESSAGES.trendPerPropertyHeaders.name}</th>
                <th>
                  {HOLDING_TAX_MESSAGES.trendPerPropertyHeaders.officialPrice}
                </th>
                <th>
                  {HOLDING_TAX_MESSAGES.trendPerPropertyHeaders.propertyTax}
                </th>
                <th>
                  {
                    HOLDING_TAX_MESSAGES.trendPerPropertyHeaders
                      .comprehensiveShare
                  }
                </th>
                <th>{HOLDING_TAX_MESSAGES.trendPerPropertyHeaders.total}</th>
              </tr>
            </thead>
            <tbody>
              {taxedItems.map((item, itemIndex) => {
                const propertyTax =
                  focusCalculation.result.propertyTaxes[itemIndex]
                if (propertyTax === undefined) return null
                // 종부세는 세대 합산이라 물건별 값이 없다. 공시가격 비율로 나눈다.
                const share = current.officialPriceTotal > ZERO_AMOUNT
                  ? propertyTax.fullOfficialPrice / current.officialPriceTotal
                  : ZERO_AMOUNT
                const comprehensiveShare =
                  (current.comprehensiveTax ?? ZERO_AMOUNT) * share
                return (
                  <tr key={item.id}>
                    <th>{item.complexName}</th>
                    <td>{formatInlineWon(propertyTax.fullOfficialPrice)}</td>
                    <td>{formatManwon(propertyTax.totalTax)}</td>
                    <td>
                      {comprehensiveShare > ZERO_AMOUNT
                        ? formatManwon(comprehensiveShare)
                        : '—'}
                    </td>
                    <td>
                      {formatManwon(propertyTax.totalTax + comprehensiveShare)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="trend__note">
            {HOLDING_TAX_MESSAGES.trendPerPropertyNote}
          </p>
        </div>
      )}

      {taxedItems.length > SINGLE_ITEM
        ? (
          <p className="trend__note">
            {HOLDING_TAX_MESSAGES.trendMultiHouseNote}
          </p>
        )
        : (
          <p className="trend__note">
            {HOLDING_TAX_MESSAGES.trendResidenceCreditNote(focusYear)}
          </p>
        )}

      {publishedYears.length > 0 && (
        <p className="trend__note">
          {HOLDING_TAX_MESSAGES.trendPriceBasisNote(
            publishedYears,
            formatRate(annualOfficialPriceGrowthRate),
            annualOfficialPriceGrowthRate === ZERO_AMOUNT,
          )}
        </p>
      )}

      {comprehensive !== undefined && burdenCapRate !== null && (
        <p className="trend__note">
          {HOLDING_TAX_MESSAGES.trendCoverageNote(
            formatInlineWon(comprehensive.basicDeduction),
            credits,
            taxedItems.length,
            String(burdenCapRate),
          )}
        </p>
      )}
    </section>
  )
}
