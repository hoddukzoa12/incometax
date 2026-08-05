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
import { SIDEBAR_MESSAGES } from '../messages/sidebar'
import { formatWon } from './format'
import { yearlyTradeAverages } from './trade-chart-data'

const WON_PER_EOK = 100_000_000
const CHART_HEIGHT_PX = 180

export function YearlyTradeChart({
  trades,
  areaLabel,
}: {
  readonly trades: readonly RecentTrade[]
  readonly areaLabel: string
}) {
  const data = yearlyTradeAverages(trades)
  if (!data.length) return null

  return (
    <section className="yearly-trade-chart">
      <h3>
        {SIDEBAR_MESSAGES.yearlyAverageTitle}
        <small>{areaLabel}</small>
      </h3>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT_PX}>
        <BarChart data={data} accessibilityLayer margin={{ left: 4, right: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="year" tickLine={false} axisLine={false} />
          <YAxis
            width={48}
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
            fill="#315bea"
            radius={[7, 7, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </section>
  )
}
