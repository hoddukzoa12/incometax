export const EXTERNAL_API_URLS = {
  moisRegionCodes:
    'https://apis.data.go.kr/1741000/StanReginCd/getStanReginCdList',
  kaptComplexList:
    'https://apis.data.go.kr/1613000/AptListService3/getTotalAptList3',
  kaptComplexBasis:
    'https://apis.data.go.kr/1613000/AptBasisInfoServiceV4/getAphusBassInfoV4',
  rebComplexInfo:
    'https://api.odcloud.kr/api/AptIdInfoSvc/v1/getAptInfo',
  kakaoAddressSearch:
    'https://dapi.kakao.com/v2/local/search/address.json',
  kakaoKeywordSearch:
    'https://dapi.kakao.com/v2/local/search/keyword.json',
  kakaoCoordinateRegionCode:
    'https://dapi.kakao.com/v2/local/geo/coord2regioncode.json',
  apartmentTrades:
    'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade',
  rowhouseTrades:
    'https://apis.data.go.kr/1613000/RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade',
  officetelTrades:
    'https://apis.data.go.kr/1613000/RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade',
} as const

export const TRADE_SOURCE_URLS = {
  apt: EXTERNAL_API_URLS.apartmentTrades,
  rowhouse: EXTERNAL_API_URLS.rowhouseTrades,
  officetel: EXTERNAL_API_URLS.officetelTrades,
} as const

export const MOIS_REGION_CODE_URL = EXTERNAL_API_URLS.moisRegionCodes

export const REALTY_PRICE_ORIGIN = 'https://www.realtyprice.kr'

export const REALTY_PRICE_APARTMENT_REFERER =
  `${REALTY_PRICE_ORIGIN}/notice/town/nfSiteLink.htm`

export const REALTY_PRICE_DETACHED_HOUSE_REFERER =
  `${REALTY_PRICE_ORIGIN}/notice/hpindividual/search.htm`

export const REALTY_PRICE_PATHS = {
  noticeDates: '/notice/town/searchNoticeDate.search',
  apartmentSearch: '/notice/search/searchApt.search',
  apartmentPrices: '/notice/search/townPriceListPastYearMap.search',
  detachedHousePrices: '/notice/search/hpiSearchListApi.search',
} as const
