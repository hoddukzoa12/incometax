import { describe, expect, it } from 'vitest'

import {
  persistConsultIntroDismissal,
  shouldShowConsultIntro,
} from '../src/shell/consult-intro-dismissal'

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()

  get length(): number {
    return this.values.size
  }

  clear(): void {
    this.values.clear()
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

class ThrowingStorage extends MemoryStorage {
  override getItem(): string | null {
    throw new Error('unavailable')
  }

  override setItem(): void {
    throw new Error('unavailable')
  }
}

const TODAY_MORNING = new Date(2026, 7, 11, 9)
const TODAY_NIGHT = new Date(2026, 7, 11, 23, 59)
const NEXT_MIDNIGHT = new Date(2026, 7, 12)

describe('consult intro dismissal', () => {
  it('does not show again on the same day after dismissal', () => {
    const storage = new MemoryStorage()

    persistConsultIntroDismissal(storage, TODAY_MORNING)

    expect(shouldShowConsultIntro(storage, TODAY_NIGHT)).toBe(false)
  })

  it('shows again after local midnight', () => {
    const storage = new MemoryStorage()
    persistConsultIntroDismissal(storage, TODAY_MORNING)

    expect(shouldShowConsultIntro(storage, NEXT_MIDNIGHT)).toBe(true)
  })

  it('stays usable when localStorage access throws', () => {
    const storage = new ThrowingStorage()

    expect(shouldShowConsultIntro(storage, TODAY_MORNING)).toBe(true)
    expect(() => persistConsultIntroDismissal(storage, TODAY_MORNING))
      .not.toThrow()
  })
})
