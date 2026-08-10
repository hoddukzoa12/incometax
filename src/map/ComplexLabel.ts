import type { ComplexSummary } from '../../shared/complex'
import { MAP_MESSAGES } from '../messages/map'

const LABEL_Y_ANCHOR = 1
const LABEL_Z_INDEX = 2
const EXPANDED_Z_INDEX = 30
const SINGLE = 1

export interface ComplexLabelState {
  readonly ownedComplexIds: readonly string[]
  readonly selectedComplexId: string | null
}

export interface ComplexLabelHandlers {
  readonly onSelect: (complexId: string) => void
  readonly onAdd: (complexId: string) => void
  readonly onRemove: (complexId: string) => void
}

/**
 * 지도 라벨 — claude.ai/design 시안(shell-v2.html, `.pin`).
 *
 * 한 좌표에 단지가 여럿 있을 수 있다. 적재된 22,260개 중 500개가 245개 지점에
 * 겹쳐 있는데(자양현대와 자양현대3차가 소수점까지 같은 좌표다), 지오코딩이 같은
 * 지번으로 풀었기 때문이다. 라벨을 밀어서 펼치면 지도에서의 위치가 거짓이 되므로,
 * 겹친 것은 겹친 대로 하나로 묶어 보이고 눌러서 고르게 한다.
 */
export class ComplexLabel {
  readonly overlay: kakao.maps.CustomOverlay

  private readonly root: HTMLDivElement
  private readonly group: readonly ComplexSummary[]
  private readonly listeners: (() => void)[] = []
  private expanded = false

  constructor(
    map: kakao.maps.Map,
    /** 같은 좌표에 있는 단지들. 세대 수가 큰 것이 앞에 온다. */
    group: readonly ComplexSummary[],
    /** 스냅샷이 아니라 읽기 함수다 — 담기/빼기가 즉시 라벨에 반영되어야 한다. */
    private readonly readState: () => ComplexLabelState,
    private readonly handlers: ComplexLabelHandlers,
  ) {
    this.root = document.createElement('div')
    this.group = group
    this.render()

    this.overlay = new kakao.maps.CustomOverlay({
      map,
      position: new kakao.maps.LatLng(group[0].lat, group[0].lng),
      content: this.root,
      clickable: true,
      yAnchor: LABEL_Y_ANCHOR,
      zIndex: LABEL_Z_INDEX,
    })
  }

  private isOwned(complex: ComplexSummary): boolean {
    return this.readState().ownedComplexIds.includes(complex.complexId)
  }

  /** 담김·선택이 바뀌면 다시 그린다. 오버레이는 그대로 두고 내용만 갈아 끼운다. */
  refresh(): void {
    this.render()
  }

  private on(
    element: HTMLElement,
    type: string,
    handler: (event: Event) => void,
  ): void {
    element.addEventListener(type, handler)
    this.listeners.push(() => element.removeEventListener(type, handler))
  }

  /** 지도가 라벨 위 클릭을 드래그로 먹지 않게 한다. */
  private guard(element: HTMLElement): void {
    const stop = () => kakao.maps.event.preventMap()
    this.on(element, 'mousedown', stop)
    this.on(element, 'touchstart', stop)
  }

  private addButton(complex: ComplexSummary): HTMLButtonElement {
    const owned = this.isOwned(complex)
    const button = document.createElement('button')
    button.type = 'button'
    button.className = owned ? 'pin__add pin__add--owned' : 'pin__add'
    button.textContent = owned
      ? MAP_MESSAGES.removeSymbol
      : MAP_MESSAGES.addSymbol
    button.setAttribute(
      'aria-label',
      owned
        ? MAP_MESSAGES.removeFromPortfolio(complex.name)
        : MAP_MESSAGES.addToPortfolio(complex.name),
    )
    this.on(button, 'click', () => {
      if (this.isOwned(complex)) this.handlers.onRemove(complex.complexId)
      else this.handlers.onAdd(complex.complexId)
    })
    this.guard(button)
    return button
  }

  private labelButton(
    name: string,
    caption: string | null,
    onClick: () => void,
    ariaLabel: string,
  ): HTMLButtonElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'pin__label'
    button.setAttribute('aria-label', ariaLabel)

    const nameNode = document.createElement('span')
    nameNode.className = 'pin__name'
    nameNode.textContent = name
    button.appendChild(nameNode)

    if (caption !== null) {
      const captionNode = document.createElement('span')
      captionNode.className = 'pin__units'
      captionNode.textContent = caption
      button.appendChild(captionNode)
    }

    this.on(button, 'click', onClick)
    this.guard(button)
    return button
  }

  private row(complex: ComplexSummary): HTMLSpanElement {
    const row = document.createElement('span')
    row.className = 'pin__row'
    row.appendChild(
      this.labelButton(
        complex.name,
        complex.householdCount === null
          ? null
          : MAP_MESSAGES.householdCount(complex.householdCount),
        () => this.handlers.onSelect(complex.complexId),
        complex.name,
      ),
    )
    row.appendChild(this.addButton(complex))
    return row
  }

  private render(): void {
    // 다시 그리기 전에 이전 노드의 리스너를 떼어 낸다 — 안 그러면 매번 쌓인다.
    for (const off of this.listeners) off()
    this.listeners.length = 0
    this.root.replaceChildren()
    const [first] = this.group
    const stacked = this.group.length > SINGLE
    const { selectedComplexId } = this.readState()
    const active = this.group.some(
      (complex) => complex.complexId === selectedComplexId,
    )
    const owned = this.group.some((complex) => this.isOwned(complex))

    this.root.className = [
      'pin',
      active ? 'pin--active' : '',
      owned ? 'pin--owned' : '',
      stacked ? 'pin--stacked' : '',
    ].filter(Boolean).join(' ')

    if (!stacked) {
      this.root.appendChild(this.row(first))
    } else if (this.expanded) {
      const list = document.createElement('span')
      list.className = 'pin__list'
      for (const complex of this.group) list.appendChild(this.row(complex))
      this.root.appendChild(list)
    } else {
      const row = document.createElement('span')
      row.className = 'pin__row'
      row.appendChild(
        this.labelButton(
          MAP_MESSAGES.stackedName(first.name, this.group.length - SINGLE),
          MAP_MESSAGES.stackedCount(this.group.length),
          () => {
            this.expanded = true
            this.overlay.setZIndex(EXPANDED_Z_INDEX)
            this.render()
          },
          MAP_MESSAGES.stackedOpen(this.group.length),
        ),
      )
      this.root.appendChild(row)
    }

    const dot = document.createElement('span')
    dot.className = 'pin__dot'
    this.root.appendChild(dot)
  }

  dispose(): void {
    this.overlay.setMap(null)
    for (const off of this.listeners) off()
    this.listeners.length = 0
  }
}
