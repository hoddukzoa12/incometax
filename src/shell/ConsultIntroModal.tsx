import { Fragment, useEffect, useRef, useState } from 'react'

import {
  CONSULT_MESSAGES,
  CONSULT_REQUEST_URL,
} from '../messages/consult'

const TITLE_ID = 'consult-intro-title'
const DESCRIPTION_ID = 'consult-intro-description'

const renderLines = (lines: readonly string[]) => lines.map((line, index) => (
  <Fragment key={line}>
    {line}
    {index < lines.length - 1 && <br />}
  </Fragment>
))

export function ConsultIntroModal({
  onDismiss,
}: {
  readonly onDismiss: (dismissToday: boolean) => void
}) {
  const [dismissToday, setDismissToday] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const firstControlRef = useRef<HTMLAnchorElement>(null)
  const lastControlRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss(dismissToday)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dismissToday, onDismiss])

  const dismiss = () => onDismiss(dismissToday)
  const leadSlide = CONSULT_MESSAGES.introSlides[0]

  return (
    <div
      ref={dialogRef}
      className="mbox consult-intro"
      role="dialog"
      tabIndex={-1}
      aria-modal="true"
      aria-labelledby={TITLE_ID}
      aria-describedby={DESCRIPTION_ID}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return

        const firstControl = firstControlRef.current
        const lastControl = lastControlRef.current
        if (firstControl === null || lastControl === null) return

        if (
          event.shiftKey
          && (event.target === firstControl || event.target === event.currentTarget)
        ) {
          event.preventDefault()
          lastControl.focus()
          return
        }

        if (!event.shiftKey && event.target === lastControl) {
          event.preventDefault()
          firstControl.focus()
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss()
      }}
    >
      <div className="consult-intro__panel">
        <h2 id={TITLE_ID} className="consult-intro__sr-only">
          {CONSULT_MESSAGES.operatorName}{' '}
          {leadSlide.badge}{' '}
          {leadSlide.titleLines.join(' ')}
        </h2>
        <p id={DESCRIPTION_ID} className="consult-intro__sr-only">
          {leadSlide.descriptionPcLines.join(' ')}
        </p>

        <div className="rich-main-hero">
          <div className="rich-hero-slides" aria-hidden="true">
            {CONSULT_MESSAGES.introSlides.map((slide, index) => (
              <div
                className={`rich-hero-slide rich-slide-0${index + 1}`}
                key={slide.badge}
              >
                <div className="rich-hero-bg" />
                <div className="rich-hero-overlay" />
                <div className="rich-hero-inner">
                  <div className="rich-hero-copy">
                    <span className="rich-hero-badge">{slide.badge}</span>
                    <h3 className="rich-hero-title">
                      {renderLines(slide.titleLines)}
                    </h3>
                    <p className="rich-hero-desc rich-desc-pc">
                      {renderLines(slide.descriptionPcLines)}
                    </p>
                    <p className="rich-hero-desc rich-desc-mobile">
                      {renderLines(slide.descriptionMobileLines)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="rich-hero-progress" aria-hidden="true">
            <span />
          </div>
          <a
            ref={firstControlRef}
            className="rich-hero-cta"
            href={CONSULT_REQUEST_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={dismiss}
          >
            <span>{CONSULT_MESSAGES.introCta}</span>
            <span className="cta__badge" aria-hidden="true">→</span>
          </a>
        </div>

        <div className="consult-intro__controls">
          <label className="consult-intro__dismissal">
            <input
              type="checkbox"
              checked={dismissToday}
              onChange={(event) => setDismissToday(event.target.checked)}
            />
            <span>{CONSULT_MESSAGES.dismissToday}</span>
          </label>
          <button
            ref={lastControlRef}
            type="button"
            onClick={dismiss}
          >
            {CONSULT_MESSAGES.close}
          </button>
        </div>
      </div>
    </div>
  )
}
