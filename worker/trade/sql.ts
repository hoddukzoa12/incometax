export const sqlString = (value: string): string =>
  `'${value.replaceAll("'", "''")}'`

export const sqlNullableNumber = (value: number | null): string =>
  value === null ? 'NULL' : String(value)
