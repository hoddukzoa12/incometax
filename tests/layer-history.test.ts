import { describe, expect, it, vi } from 'vitest'

import {
  createLayerHistory,
  type LayerHistoryHost,
} from '../src/shell/layer-history'

/**
 * 브라우저 히스토리를 흉내 낸다.
 *
 * 핵심은 `back()` 이 **즉시 일어나지 않는다**는 것이다. 실제 브라우저에서도
 * 뒤로가기는 예약됐다가 나중에 도착하고, 그 사이에 다른 층이 칸을 쌓으면
 * 엉뚱한 칸이 빠진다 — 조건 모달이 뜨자마자 사라진 원인이 이것이었다.
 * 그래서 예약된 일을 `flush()` 로 손수 흘려보내며 그 틈을 재현한다.
 */
const fakeBrowser = ({ backLandsAtOnce = false } = {}) => {
  const entries: unknown[] = [null]
  const queue: (() => void)[] = []
  let onPop = (): void => {}

  const pop = (): void => {
    if (entries.length > 1) entries.pop()
    onPop()
  }

  const calls = { push: 0, back: 0 }

  const host: LayerHistoryHost = {
    state: () => entries[entries.length - 1],
    push: (state) => {
      calls.push += 1
      entries.push(state)
    },
    /*
     * 뒤로가기가 언제 도착하는지는 브라우저마다 다르다. 늦게 오면 그 사이에
     * 쌓인 칸을 먹고, 곧바로 오면 아직 안 쌓인 칸을 먼저 뺀다 — 어느 쪽이든
     * 층 하나가 억울하게 닫힐 수 있다. 두 경우를 다 재현한다.
     */
    back: () => {
      calls.back += 1
      if (backLandsAtOnce) pop()
      else queue.push(pop)
    },
    schedule: (run) => {
      queue.push(run)
    },
  }

  return {
    host,
    /** 예약된 일을 전부 흘려보낸다 — 그 사이 새로 예약된 것까지. */
    flush: () => {
      while (queue.length > 0) queue.shift()?.()
    },
    listen: (handler: () => void) => {
      onPop = handler
    },
    /** 사용자가 뒤로가기를 눌렀다. */
    pressBack: () => {
      if (entries.length > 1) entries.pop()
      onPop()
    },
    /** 이 코드 말고 다른 것이 칸을 쌓았다 — 앵커 이동 같은 것. */
    pushOutside: () => {
      entries.push({ 남의칸: true })
    },
    entryCount: () => entries.length,
    calls,
  }
}

const setUp = (options?: { backLandsAtOnce?: boolean }) => {
  const browser = fakeBrowser(options)
  const layers = createLayerHistory(browser.host)
  browser.listen(() => layers.popped())
  return { browser, layers }
}

describe('덮인 층과 뒤로가기', () => {
  it('층이 열리면 히스토리에 칸 하나를 쌓는다', () => {
    const { browser, layers } = setUp()

    layers.open('complexPanel', vi.fn())
    browser.flush()

    expect(browser.entryCount()).toBe(2)
    expect(layers.inspect().hasEntry).toBe(true)
  })

  /* 칸은 「무언가 덮여 있다」는 사실 하나에만 쓴다. 층 수를 세지 않는다. */
  it('층이 겹쳐도 칸은 하나뿐이다', () => {
    const { browser, layers } = setUp()

    layers.open('complexPanel', vi.fn())
    layers.open('unitLookup', vi.fn())
    browser.flush()

    expect(browser.entryCount()).toBe(2)
  })

  it('뒤로가기는 가장 위의 층 하나만 벗긴다', () => {
    const { browser, layers } = setUp()
    const closePanel = vi.fn()
    const closeUnit = vi.fn()

    layers.open('complexPanel', closePanel)
    layers.open('unitLookup', closeUnit)
    browser.flush()

    browser.pressBack()
    browser.flush()

    expect(closeUnit).toHaveBeenCalledTimes(1)
    expect(closePanel).not.toHaveBeenCalled()
  })

  /* 위층이 벗겨져도 아래층이 남아 있으면 뒤로가기는 아직 사이트를 벗어나면 안 된다. */
  it('아래 층이 남으면 칸을 다시 쌓는다', () => {
    const { browser, layers } = setUp()

    layers.open('complexPanel', vi.fn())
    layers.open('unitLookup', () => layers.close('unitLookup'))
    browser.flush()

    browser.pressBack()
    browser.flush()

    expect(layers.inspect().openLayers).toEqual(['complexPanel'])
    expect(layers.inspect().hasEntry).toBe(true)
    expect(browser.entryCount()).toBe(2)
  })

  it('마지막 층까지 벗겨지면 칸을 내려놓는다', () => {
    const { browser, layers } = setUp()

    layers.open('complexPanel', () => layers.close('complexPanel'))
    browser.flush()

    browser.pressBack()
    browser.flush()

    expect(layers.inspect().openLayers).toEqual([])
    expect(layers.inspect().hasEntry).toBe(false)
    expect(browser.entryCount()).toBe(1)
  })

  /*
   * 회귀 방지 — 동·호 모달에서 「이 공시가격으로 계산하기」를 누르면 그 모달이
   * 닫히는 동시에 조건 모달이 열린다. 층마다 칸을 쌓던 때는 닫히는 쪽의 `back()`
   * 이 늦게 도착해 방금 열린 조건 모달의 칸을 먹었고, 모달이 뜨자마자 사라졌다.
   */
  it('한 층이 닫히며 다른 층이 열려도 열린 층이 살아남는다', () => {
    const { browser, layers } = setUp()
    const closeConditions = vi.fn()

    layers.open('complexPanel', vi.fn())
    layers.open('unitLookup', vi.fn())
    browser.flush()
    const before = browser.entryCount()

    // 같은 순간에 일어나는 일이다 — 사이에 flush 가 없다.
    layers.close('unitLookup')
    layers.open('conditions', closeConditions)
    browser.flush()

    expect(closeConditions).not.toHaveBeenCalled()
    expect(layers.inspect().openLayers).toEqual(['complexPanel', 'conditions'])
    expect(browser.entryCount()).toBe(before)
  })

  /*
   * 결과 화면도 같은 자리에서 갈린다 — 조건 모달이 닫히면서 결과가 열린다.
   * 이때는 마지막 한 겹이 벗겨졌다 다시 덮이는 것이라, 여닫힘을 모아 보지 않으면
   * 실제로 `back()` 이 나간다. 뒤로가기가 언제 도착하든 결과가 살아 있어야 한다.
   */
  it.each([
    { 도착: '늦게', backLandsAtOnce: false },
    { 도착: '곧바로', backLandsAtOnce: true },
  ])('조건 모달이 닫히며 결과가 열릴 때 뒤로가기가 $도착 와도 결과가 남는다', ({
    backLandsAtOnce,
  }) => {
    const { browser, layers } = setUp({ backLandsAtOnce })
    const closeResult = vi.fn()

    layers.open('conditions', vi.fn())
    browser.flush()

    layers.close('conditions')
    layers.open('holdingTax', closeResult)
    browser.flush()

    expect(closeResult).not.toHaveBeenCalled()
    expect(layers.inspect().openLayers).toEqual(['holdingTax'])
    expect(layers.inspect().hasEntry).toBe(true)
    expect(browser.entryCount()).toBe(2)
  })

  /*
   * 층이 갈릴 때는 히스토리를 아예 건드리지 않아야 한다. 덮여 있다는 사실이
   * 변하지 않았는데 `back()` 을 내보내면 진짜 이동이 한 번 일어난다 —
   * 화면이 깜빡이고, 도착 시점에 따라 엉뚱한 칸이 빠질 여지도 생긴다.
   */
  it('층이 갈릴 때는 히스토리를 건드리지 않는다', () => {
    const { browser, layers } = setUp()

    layers.open('conditions', vi.fn())
    browser.flush()
    const after = { ...browser.calls }

    layers.close('conditions')
    layers.open('holdingTax', vi.fn())
    browser.flush()

    expect(browser.calls.push - after.push).toBe(0)
    expect(browser.calls.back - after.back).toBe(0)
  })

  /*
   * 앱이 스스로 닫았을 때 쌓아 둔 칸을 되돌리지 않으면, 여닫을 때마다 히스토리가
   * 길어져 나중에는 뒤로가기를 눌러도 아무 일이 없는 것처럼 보인다.
   */
  it('여닫기를 되풀이해도 히스토리가 길어지지 않는다', () => {
    const { browser, layers } = setUp()

    for (const round of [1, 2, 3]) {
      layers.open(`complexPanel${round}`, vi.fn())
      browser.flush()
      layers.close(`complexPanel${round}`)
      browser.flush()
    }

    expect(browser.entryCount()).toBe(1)
    expect(layers.inspect().hasEntry).toBe(false)
  })

  /*
   * 뒤로가기가 늘 우리 칸을 뺀 것은 아니다. 다른 것이 위에 쌓은 칸이 빠진 것이라면
   * 우리 칸은 그대로 있다 — 그때 층을 닫으면 사람은 건드리지도 않은 화면이
   * 사라지는 것을 본다. 그래서 칸에 남긴 표식을 확인하고 움직인다.
   */
  it('빠진 칸이 우리 것이 아니면 층을 닫지 않는다', () => {
    const { browser, layers } = setUp()
    const closePanel = vi.fn()

    layers.open('complexPanel', closePanel)
    browser.flush()

    browser.pushOutside()
    browser.pressBack()
    browser.flush()

    expect(closePanel).not.toHaveBeenCalled()
    expect(layers.inspect().hasEntry).toBe(true)
  })

  /* 덮인 것이 없으면 뒤로가기는 우리 몫이 아니다 — 사이트를 벗어나는 게 맞다. */
  it('열린 층이 없으면 뒤로가기에 끼어들지 않는다', () => {
    const { browser, layers } = setUp()

    browser.pressBack()
    browser.flush()

    expect(layers.inspect().hasEntry).toBe(false)
    expect(browser.entryCount()).toBe(1)
  })
})
