export type ConcurrentTaskResult<Input, Output> =
  | {
      readonly status: 'fulfilled'
      readonly input: Input
      readonly value: Output
    }
  | {
      readonly status: 'rejected'
      readonly input: Input
      readonly reason: unknown
    }

interface ConcurrentTaskOptions<Input, Output> {
  readonly inputs: readonly Input[]
  readonly concurrency: number
  readonly task: (input: Input) => Promise<Output>
  readonly shouldStop?: (result: ConcurrentTaskResult<Input, Output>) => boolean
}

export const runConcurrentTasks = async <Input, Output>({
  inputs,
  concurrency,
  task,
  shouldStop = () => false,
}: ConcurrentTaskOptions<Input, Output>): Promise<
  readonly ConcurrentTaskResult<Input, Output>[]
> => {
  if (!Number.isInteger(concurrency) || concurrency <= 0) {
    throw new TypeError('concurrency must be a positive integer')
  }

  const results: ConcurrentTaskResult<Input, Output>[] = []
  let nextIndex = 0
  let stopped = false

  const runWorker = async (): Promise<void> => {
    while (!stopped) {
      const index = nextIndex
      if (index >= inputs.length) return
      nextIndex += 1
      const input = inputs[index] as Input
      let result: ConcurrentTaskResult<Input, Output>
      try {
        result = { status: 'fulfilled', input, value: await task(input) }
      } catch (reason) {
        result = { status: 'rejected', input, reason }
      }
      results.push(result)
      if (shouldStop(result)) stopped = true
    }
  }

  const workerCount = Math.min(concurrency, inputs.length)
  await Promise.all(Array.from({ length: workerCount }, runWorker))
  return results
}
