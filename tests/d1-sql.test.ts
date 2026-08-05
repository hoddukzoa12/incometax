import { DatabaseSync } from 'node:sqlite'

import { describe, expect, it } from 'vitest'

import {
  sqlNullableNumber,
  sqlNullableString,
  sqlString,
} from '../worker/d1/sql.ts'

describe('D1 SQL literals', () => {
  it('quotes strings and represents nullable values', () => {
    expect(sqlString("O'Brien")).toBe("'O''Brien'")
    expect(sqlString('')).toBe("''")
    expect(sqlNullableString(null)).toBe('NULL')
    expect(sqlNullableNumber(null)).toBe('NULL')
  })

  it('keeps an embedded quote inside the SQL literal', () => {
    const database = new DatabaseSync(':memory:')
    const value = "Robert'); DROP TABLE sentinel; --"
    database.exec(`CREATE TABLE values_under_test (value TEXT NOT NULL);
      CREATE TABLE sentinel (id INTEGER PRIMARY KEY);
      INSERT INTO values_under_test (value) VALUES (${sqlString(value)});`)

    expect(
      database.prepare('SELECT value FROM values_under_test').get(),
    ).toEqual({ value })
    expect(
      database
        .prepare("SELECT name FROM sqlite_master WHERE name = 'sentinel'")
        .get(),
    ).toEqual({ name: 'sentinel' })
    database.close()
  })
})
