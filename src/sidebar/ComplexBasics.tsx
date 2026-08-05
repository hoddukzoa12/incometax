import type { ReactNode } from 'react'

import type { ComplexStagingRecord } from '../../shared/complex'
import { SIDEBAR_MESSAGES } from '../messages/sidebar'
import { formatCount } from './format'

const fact = (value: string | null): string => value ?? SIDEBAR_MESSAGES.unknown

export function ComplexBasics({
  complex,
  children,
}: {
  readonly complex: ComplexStagingRecord
  readonly children?: ReactNode
}) {
  const buildingCount = formatCount(complex.buildingCount)
  const householdCount = formatCount(complex.householdCount)

  return (
    <header className="complex-sidebar__header">
      <p className="complex-sidebar__eyebrow">
        {SIDEBAR_MESSAGES.apartmentComplexLabel}
      </p>
      <h2>{complex.name}</h2>
      <address>{complex.roadAddress ?? complex.legalAddress}</address>
      <details className="complex-sidebar__details">
        <summary>{SIDEBAR_MESSAGES.detailsSummary}</summary>
        {complex.roadAddress && (
          <p className="complex-sidebar__legal-address">
            {SIDEBAR_MESSAGES.lotAddressLabel} {complex.legalAddress}
          </p>
        )}
        <dl className="complex-sidebar__facts">
          <div>
            <dt>{SIDEBAR_MESSAGES.approvalDateLabel}</dt>
            <dd>{fact(complex.approvalDate)}</dd>
          </div>
          <div>
            <dt>{SIDEBAR_MESSAGES.buildingCountLabel}</dt>
            <dd>
              {buildingCount
                ? `${buildingCount}${SIDEBAR_MESSAGES.buildingCountSuffix}`
                : SIDEBAR_MESSAGES.unknown}
            </dd>
          </div>
          <div>
            <dt>{SIDEBAR_MESSAGES.householdCountLabel}</dt>
            <dd>
              {householdCount
                ? `${householdCount}${SIDEBAR_MESSAGES.householdCountSuffix}`
                : SIDEBAR_MESSAGES.unknown}
            </dd>
          </div>
        </dl>
      </details>
      {children}
    </header>
  )
}
