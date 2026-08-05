import type { ComplexSummary } from '../../shared/complex'

const LABEL_Y_ANCHOR = 1
const LABEL_Z_INDEX = 2

export class ComplexLabel {
  readonly overlay: kakao.maps.CustomOverlay

  private readonly button: HTMLButtonElement
  private readonly content: HTMLDivElement
  private readonly handleClick: () => void
  private readonly preventMapInteraction = (): void => {
    kakao.maps.event.preventMap()
  }

  constructor(
    map: kakao.maps.Map,
    complex: ComplexSummary,
    onComplexSelect: (complexId: string) => void,
  ) {
    this.content = document.createElement('div')
    this.content.className = 'complex-label-anchor'
    this.button = document.createElement('button')
    this.button.type = 'button'
    this.button.className = 'complex-label'
    this.button.textContent = complex.name
    this.button.setAttribute('aria-label', complex.name)
    this.content.appendChild(this.button)

    this.handleClick = () => onComplexSelect(complex.complexId)
    this.button.addEventListener('click', this.handleClick)
    this.button.addEventListener('mousedown', this.preventMapInteraction)
    this.button.addEventListener('touchstart', this.preventMapInteraction)

    this.overlay = new kakao.maps.CustomOverlay({
      map,
      position: new kakao.maps.LatLng(complex.lat, complex.lng),
      content: this.content,
      clickable: true,
      yAnchor: LABEL_Y_ANCHOR,
      zIndex: LABEL_Z_INDEX,
    })
  }

  dispose(): void {
    this.overlay.setMap(null)
    this.button.removeEventListener('click', this.handleClick)
    this.button.removeEventListener('mousedown', this.preventMapInteraction)
    this.button.removeEventListener('touchstart', this.preventMapInteraction)
  }
}
