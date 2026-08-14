import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { SIDEBAR_MESSAGES } from '../src/messages/sidebar'
import { UnitSelectionFields } from '../src/sidebar/UnitSelectionFields'

const callbacks = {
  onDongChange: vi.fn(),
  onRoomChange: vi.fn(),
  onRoomSelect: vi.fn(),
  onLookup: vi.fn(),
}

describe('UnitSelectionFields', () => {
  it('renders separate dong and room loading states around dependent selects', () => {
    const html = renderToStaticMarkup(
      <UnitSelectionFields
        dongs={[{ code: '1', name: '1' }]}
        rooms={[]}
        selectedDong="1"
        selectedRoom=""
        dongLoading={false}
        roomLoading
        dongError={null}
        roomError={null}
        dongNoData={null}
        roomNoData={null}
        manualDong={false}
        manualRoom={false}
        lookupLoading={false}
        {...callbacks}
      />,
    )

    expect(html).toContain(SIDEBAR_MESSAGES.roomLoading)
    expect(html).not.toContain(SIDEBAR_MESSAGES.dongLoading)
    expect(html.match(/<select/g)).toHaveLength(2)
    expect(html).not.toContain('<input')
  })

  it('keeps direct dong and room inputs reachable after a list failure', () => {
    const html = renderToStaticMarkup(
      <UnitSelectionFields
        dongs={[]}
        rooms={[]}
        selectedDong="1동"
        selectedRoom="101호"
        dongLoading={false}
        roomLoading={false}
        dongError={SIDEBAR_MESSAGES.unitSourceUnavailable}
        roomError={null}
        dongNoData={null}
        roomNoData={null}
        manualDong
        manualRoom
        lookupLoading={false}
        {...callbacks}
      />,
    )

    expect(html).toContain(SIDEBAR_MESSAGES.unitSourceUnavailable)
    expect(html).toContain(SIDEBAR_MESSAGES.manualUnitGuide)
    expect(html.match(/<input/g)).toHaveLength(2)
    expect(html).not.toContain('<select')
    expect(html).not.toContain('disabled=""')
  })

  it('skips the dong field when the only dong was selected automatically', () => {
    const html = renderToStaticMarkup(
      <UnitSelectionFields
        dongs={[{ code: '1', name: '동명없음' }]}
        rooms={[{ code: '101', name: '101호' }]}
        hideDongField
        selectedDong="동명없음"
        selectedRoom=""
        dongLoading={false}
        roomLoading={false}
        dongError={null}
        roomError={null}
        dongNoData={null}
        roomNoData={null}
        manualDong={false}
        manualRoom={false}
        lookupLoading={false}
        {...callbacks}
      />,
    )

    expect(html).not.toContain(SIDEBAR_MESSAGES.dongLabel)
    expect(html).toContain(SIDEBAR_MESSAGES.roomLabel)
    expect(html.match(/<select/g)).toHaveLength(1)
  })
})
