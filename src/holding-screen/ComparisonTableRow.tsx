import type { TableRow } from './comparison-table-values'
import { TaxTermHelp } from './TaxTermHelp'

export function ComparisonTableRow({ row }: { readonly row: TableRow }) {
  return (
    <tr className={row.strong ? 'holding-tax-table__row--strong' : undefined}>
      <th scope="row">
        {row.label}
        {row.helpTerm !== undefined && <TaxTermHelp term={row.helpTerm} />}
      </th>
      <td>{row.amount}</td>
      <td className="holding-tax-table__basis">{row.basis}</td>
    </tr>
  )
}
