import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { RecentTrade } from '../../shared/trade'
import { formatWon } from '../format/won'
import { SIDEBAR_MESSAGES } from '../messages/sidebar'
import { yearlyTradeAverages } from './trade-chart-data'

const WON_PER_EOK = 100_000_000
const CHART_HEIGHT_PX = 180
const CHART_Y_AXIS_WIDTH_PX = 48
const CHART_GRID_DASH_PATTERN = '3 3'
const CHART_ACCENT_COLOR = 'var(--color-accent)'
const CHART_RADIUS_TOKEN = '--radius-sm'
const CHART_SPACING_TOKEN = '--space-1'

const readPixelToken = (token: string): number =>
  Number.parseFloat(
    window.getComputedStyle(document.documentElement).getPropertyValue(token),
  )

export function YearlyTradeChart({
  trades,
  areaLabel,
}: {
  readonly trades: readonly RecentTrade[]
  readonly areaLabel: string
}) {
  const data = yearlyTradeAverages(trades)
  if (!data.length) return null
  const chartBarRadius = readPixelToken(CHART_RADIUS_TOKEN)
  const chartMargin = readPixelToken(CHART_SPACING_TOKEN)

  return (
    <section className="yearly-trade-chart">
      <h3>
        {SIDEBAR_MESSAGES.yearlyAverageTitle}
        <small>{areaLabel}</small>
      </h3>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT_PX}>
        <BarChart
          data={data}
          accessibilityLayer
          margin={{ left: chartMargin, right: chartMargin }}
        >
          <CartesianGrid
            strokeDasharray={CHART_GRID_DASH_PATTERN}
            vertical={false}
          />
          <XAxis dataKey="year" tickLine={false} axisLine={false} />
          <YAxis
            width={CHART_Y_AXIS_WIDTH_PX}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) =>
              `${Math.round(value / WON_PER_EOK)}${SIDEBAR_MESSAGES.eokSuffix}`}
          />
          <Tooltip
            formatter={(value) => [
              formatWon(Number(value)),
              SIDEBAR_MESSAGES.averageTradePrice,
            ]}
            labelFormatter={(year) =>
              `${String(year)}${SIDEBAR_MESSAGES.yearSuffix}`}
          />
          <Bar
            dataKey="averageAmount"
            name={SIDEBAR_MESSAGES.averageTradePrice}
            fill={CHART_ACCENT_COLOR}
            radius={[chartBarRadius, chartBarRadius, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </section>
  )
}
