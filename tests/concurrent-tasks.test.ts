import { setImmediate } from 'node:timers/promises'

import { describe, expect, it } from 'vitest'

import { runConcurrentTasks } from '../scripts/lib/concurrent-tasks.ts'

describe('runConcurrentTasks', () => {
  it('processes every task without exceeding the configured concurrency', async () => {
    const inputs = Array.from({ length: 40 }, (_, index) => index)
    let active = 0
    let maximumActive = 0

    const results = await runConcurrentTasks({
      inputs,
      concurrency: 8,
      task: async (input) => {
        active += 1
        maximumActive = Math.max(maximumActive, active)
        await setImmediate()
        active -= 1
        return input * 2
      },
    })

    expect(results).toHaveLength(inputs.length)
    expect(maximumActive).toBe(8)
    expect(
      results
        .flatMap((result) =>
          result.status === 'fulfilled' ? [result.value] : [],
        )
        .sort((left, right) => left - right),
    ).toEqual(inputs.map((input) => input * 2))
  })

  it('stops scheduling new work after the stop condition is reached', async () => {
    const results = await runConcurrentTasks({
      inputs: Array.from({ length: 100 }, (_, index) => index),
      concurrency: 4,
      task: async (input) => input,
      shouldStop: (result) =>
        result.status === 'fulfilled' && result.value === 5,
    })

    expect(results.length).toBeLessThan(100)
    expect(results.some((result) => result.status === 'fulfilled' && result.value === 5)).toBe(true)
  })
})
