import type {
  DetachedHouseOfficialPriceRequest,
  OfficialPriceLookupResult,
} from '../../shared/official-price'
import {
  REALTY_PRICE_DETACHED_HOUSE_REFERER,
  REALTY_PRICE_PATHS,
} from '../config/external-apis'
import { RealtyPriceClient, responseList } from './client'
import { noData, normalizeHistory, text } from './normalize'
import { detachedHouseParams, type ParsedPnu } from './params'

export async function lookupDetachedHouseOfficialPrice(
  request: DetachedHouseOfficialPriceRequest,
  pnu: string,
  parsedPnu: ParsedPnu,
  client: RealtyPriceClient,
): Promise<OfficialPriceLookupResult> {
  const rows = responseList(await client.request(
    REALTY_PRICE_PATHS.detachedHousePrices,
    detachedHouseParams(parsedPnu),
    REALTY_PRICE_DETACHED_HOUSE_REFERER,
  ))
  if (!rows.length) return noData(request.key, 'priceNotFound')

  return {
    key: request.key,
    status: 'found',
    value: {
      assetKind: request.assetKind,
      pnu,
      detailAddress: text(rows[0].full_addr_name) ||
        text(rows[0].addr) || request.address,
      items: normalizeHistory(rows, {
        date: 'base_ymd',
        price: 'hprice_w',
      }),
    },
  }
}
