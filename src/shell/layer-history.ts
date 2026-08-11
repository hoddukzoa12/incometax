import { useEffect, useRef } from 'react'

/**
 * 덮인 층을 뒤로가기로 벗긴다.
 *
 * 지도 위에 덮이는 층들 — 첫 화면 안내·단지 패널·동호 모달·조건 모달·결과 화면 —
 * 은 화면을 가리므로 사람은 그것을 「페이지」로 읽는다. 히스토리에 아무것도
 * 쌓지 않으면 뒤로가기가 층이 아니라 사이트를 벗어난다. 좁은 화면에서는 층이
 * 화면을 통째로 덮으니 특히 그렇다 — 닫으려던 사람이 밖으로 튕겨 나간다.
 *
 * ── 왜 층마다 한 칸씩 쌓지 않는가
 *
 * 층이 겹칠 때마다 칸을 쌓으면, 한 층이 닫히고 다른 층이 열리는 순간
 * 두 층이 같은 시점에 히스토리를 서로 반대로 민다. 동·호 모달에서 「이 공시가격으로
 * 계산하기」를 누르면 그 모달이 닫히면서 `back()`, 조건 모달이 열리면서 `push()` 를
 * 부르는데, `back()` 은 비동기라 나중에 도착해 방금 쌓인 조건 모달의 칸을 먹는다.
 * 그러면 조건 모달이 뜨자마자 사라진다.
 *
 * 그래서 칸의 주인을 하나로 둔다. 「층이 하나라도 열려 있다」는 사실에만 칸 하나를
 * 쓰고, 층이 바뀌는 것은 칸을 건드리지 않는다. 여닫힘을 한 묶음으로 모아 처리하므로
 * 위의 경우처럼 하나가 닫히고 하나가 열리면 히스토리는 아무 일도 하지 않는다.
 */
const LAYER_STATE_KEY = 'layerOpen'
const NOT_FOUND = -1

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/**
 * 히스토리를 다루는 데 필요한 것만 추린 것.
 *
 * 브라우저를 직접 부르지 않고 이것을 통해 부른다 — `back()` 이 비동기라는 점이
 * 이 코드의 핵심인데, 그 시점을 테스트에서 손으로 잡을 수 있어야 한다.
 */
export type LayerHistoryHost = {
  readonly state: () => unknown
  readonly push: (state: unknown) => void
  readonly back: () => void
  /** 같은 순간에 일어난 여닫힘을 한 번에 보기 위해 한 박자 미룬다. */
  readonly schedule: (run: () => void) => void
}

export const createLayerHistory = (host: LayerHistoryHost) => {
  /** 열린 순서대로 쌓인다. 맨 뒤가 가장 위에 덮인 층이다. */
  const openLayers: string[] = []
  const dismissals = new Map<string, () => void>()
  let pushed = false
  let scheduled = false

  const marked = (): boolean => {
    const state = host.state()
    return isRecord(state) && state[LAYER_STATE_KEY] === true
  }

  const sync = (): void => {
    const anyOpen = openLayers.length > 0
    if (anyOpen && !pushed) {
      pushed = true
      const state = host.state()
      host.push({
        ...(isRecord(state) ? state : {}),
        [LAYER_STATE_KEY]: true,
      })
      return
    }
    if (!anyOpen && pushed) {
      pushed = false
      host.back()
    }
  }

  const schedule = (): void => {
    if (scheduled) return
    scheduled = true
    host.schedule(() => {
      scheduled = false
      sync()
    })
  }

  return {
    open(id: string, dismiss: () => void): void {
      openLayers.push(id)
      dismissals.set(id, dismiss)
      schedule()
    },

    close(id: string): void {
      const at = openLayers.lastIndexOf(id)
      if (at !== NOT_FOUND) openLayers.splice(at, 1)
      dismissals.delete(id)
      schedule()
    },

    /** 뒤로가기가 눌렸다. 우리 칸이 빠졌으면 가장 위의 층 하나만 벗긴다. */
    popped(): void {
      if (!pushed || marked()) return
      pushed = false
      const top = openLayers[openLayers.length - 1]
      if (top !== undefined) dismissals.get(top)?.()
      // 아래에 층이 남아 있으면 `sync` 가 칸을 다시 쌓는다.
      schedule()
    },

    /** 테스트가 들여다보는 창. */
    inspect: () => ({
      openLayers: [...openLayers],
      hasEntry: pushed,
    }),
  }
}

const browserHost: LayerHistoryHost = {
  state: () => window.history.state,
  push: (state) => window.history.pushState(state, ''),
  back: () => window.history.back(),
  schedule: (run) => queueMicrotask(run),
}

const layerHistory = createLayerHistory(browserHost)

let listening = false

/**
 * 이 층이 열려 있는 동안 뒤로가기의 대상이 된다.
 *
 * `dismiss` 는 이 층만 닫아야 한다 — 아래에 깔린 층까지 닫으면 뒤로가기 한 번에
 * 두 겹이 벗겨진다.
 */
export const useLayerHistory = (
  id: string,
  open: boolean,
  dismiss: () => void,
): void => {
  // 닫는 방법이 바뀌어도 등록을 다시 하지 않는다.
  const dismissRef = useRef(dismiss)
  useEffect(() => {
    dismissRef.current = dismiss
  }, [dismiss])

  useEffect(() => {
    if (listening) return
    listening = true
    window.addEventListener('popstate', () => layerHistory.popped())
  }, [])

  useEffect(() => {
    if (!open) return
    layerHistory.open(id, () => dismissRef.current())
    return () => layerHistory.close(id)
  }, [id, open])
}
