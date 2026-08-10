import { useEffect, useRef, useState } from 'react'

import type { PortfolioController } from '../portfolio'
import { PortfolioItemEditor } from '../portfolio'
import { SHELL_MESSAGES } from '../messages/shell'

/**
 * 지도 모서리의 「내 부동산 N건」과 그 팝오버.
 *
 * 헤더에 있던 것을 지도 모서리로 내렸다. 담는 행동(단지 사이드바)과 보는 자리를
 * 가깝게 두면 담은 것이 늘어나는 흐름이 한 화면에서 이어진다.
 */
export function PortfolioMenu({
  controller,
  onCalculateHoldingTax,
}: {
  readonly controller: PortfolioController
  readonly onCalculateHoldingTax: () => void
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const { items } = controller

  // 바깥을 누르거나 Esc 를 누르면 닫는다 — 지도를 가리는 요소이므로 쉽게 치울 수 있어야 한다.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="pfmenu" ref={root}>
      <button
        className="chip"
        type="button"
        aria-expanded={open}
        aria-label={open ? SHELL_MESSAGES.portfolioClose : SHELL_MESSAGES.portfolioOpen}
        onClick={() => setOpen((value) => !value)}
      >
        내 부동산 <span className="chip__n">{items.length}</span>건
      </button>

      {open && (
        <div className="pfmenu__panel">
          <div className="pfmenu__head">
            <h2>{SHELL_MESSAGES.portfolioTitle}</h2>
            <button type="button" onClick={() => setOpen(false)}>
              {SHELL_MESSAGES.portfolioClose}
            </button>
          </div>

          {items.length === 0 ? (
            <p className="pfmenu__empty">{SHELL_MESSAGES.portfolioEmpty}</p>
          ) : (
            <ol className="pfmenu__list">
              {items.map((item) => (
                <PortfolioItemEditor
                  key={item.id}
                  item={item}
                  onRemove={() => controller.remove(item.id)}
                />
              ))}
            </ol>
          )}

          <button
            className="cta"
            type="button"
            disabled={items.length === 0}
            onClick={() => {
              setOpen(false)
              onCalculateHoldingTax()
            }}
          >
            <span>{SHELL_MESSAGES.calculateHousehold}</span>
            <span className="cta__badge" aria-hidden="true">
              {SHELL_MESSAGES.ctaChevron}
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
