import type { TableRow } from './comparison-table-values'
import { TaxTermHelp } from './TaxTermHelp'

export function ComparisonTableRow({ row }: { readonly row: TableRow }) {
  const classNames = [
    row.strong ? 'holding-tax-table__row--strong' : '',
    row.subRow ? 'holding-tax-table__row--sub' : '',
  ].filter(Boolean).join(' ')

  return (
    <tr className={classNames || undefined}>
      <th scope="row">
        {row.label}
        {row.helpTerm !== undefined && <TaxTermHelp term={row.helpTerm} />}
      </th>
      {row.values.map((value, valueIndex) => (
        <td key={valueIndex}>{value}</td>
      ))}
      <td className="holding-tax-table__basis">{row.basis}</td>
    </tr>
  )
}
