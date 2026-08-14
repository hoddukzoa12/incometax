import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { SEARCH_MESSAGES } from '../src/messages/search'
import { SearchResults } from '../src/search/SearchResults'

const result = (address: string) => ({
  address,
  lat: 37.5,
  lng: 127,
})

describe('search result housing status', () => {
  it('disables only confirmed non-housing Kakao results', () => {
    const html = renderToStaticMarkup(
      <SearchResults
        listId="search"
        complexItems={[]}
        addressResults={[
          {
            kind: 'address',
            item: result('서울 송파구 석촌동 265'),
            housingCheckStatus: 'notHousing',
          },
          {
            kind: 'address',
            item: result('서울 강남구 역삼동 795-10'),
            housingCheckStatus: 'pending',
          },
          {
            kind: 'place',
            item: result('서울 강남구 역삼동 1'),
            housingCheckStatus: 'error',
          },
        ]}
        complexStatus="success"
        addressStatus="success"
        placeStatus="success"
        activeIndex={-1}
        onSelect={vi.fn()}
      />,
    )

    expect(html.match(/disabled=""/gu)).toHaveLength(1)
    expect(html.match(/aria-disabled="true"/gu)).toHaveLength(1)
    expect(html).toContain(SEARCH_MESSAGES.notHousing)
    expect(html).toContain(SEARCH_MESSAGES.housingCheckPending)
  })
})
