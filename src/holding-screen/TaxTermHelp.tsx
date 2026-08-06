import { useId, useState } from 'react'

import {
  HOLDING_TAX_MESSAGES,
  HOLDING_TAX_TERM_HELP,
  type HoldingTaxHelpTerm,
} from '../messages/holding-tax'

export function TaxTermHelp({ term }: { readonly term: HoldingTaxHelpTerm }) {
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const content = HOLDING_TAX_TERM_HELP[term]

  return (
    <>
      <button
        className="tax-term-help__trigger"
        type="button"
        aria-label={HOLDING_TAX_MESSAGES.helpOpen(content.title)}
        onClick={() => setOpen(true)}
      >
        {HOLDING_TAX_MESSAGES.helpSymbol}
      </button>
      {open && (
        <div
          className="tax-term-help"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <div className="tax-term-help__card">
            <h2 id={titleId}>{content.title}</h2>
            <p>{content.description}</p>
            <button type="button" onClick={() => setOpen(false)}>
              {HOLDING_TAX_MESSAGES.helpClose}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
