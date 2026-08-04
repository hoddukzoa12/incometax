import type { ApartmentOfficialPriceRequest } from '../../shared/official-price'

const PNU_LENGTH = 19

export interface ParsedPnu {
  readonly legalDongCode: string
  readonly landKind: string
  readonly mainNumber: string
  readonly subNumber: string
  readonly paddedMainNumber: string
  readonly paddedSubNumber: string
}

export interface NoticeDate {
  readonly code: string
  readonly year: string
  readonly publishedDate: string
}

export function parsePnu(pnu: string): ParsedPnu | null {
  if (!/^\d{19}$/.test(pnu) || pnu.length !== PNU_LENGTH) return null

  const paddedMainNumber = pnu.slice(11, 15)
  const paddedSubNumber = pnu.slice(15, 19)
  return {
    legalDongCode: pnu.slice(0, 10),
    landKind: pnu.slice(10, 11),
    mainNumber: String(Number(paddedMainNumber)),
    subNumber: String(Number(paddedSubNumber)),
    paddedMainNumber,
    paddedSubNumber,
  }
}

export function apartmentParams(
  request: ApartmentOfficialPriceRequest,
  pnu: ParsedPnu,
  notice: NoticeDate,
): Record<string, string> {
  return {
    page_no: '1',
    reg_name: '',
    sreg: '',
    seub: '',
    old_reg: '',
    old_eub: '',
    gbn: '1',
    year: notice.year,
    notice_date: '',
    notice_date_year: notice.publishedDate,
    reg: pnu.legalDongCode.slice(0, 5),
    eub: pnu.legalDongCode.slice(5),
    apt_name: request.complexName,
    bun1: pnu.mainNumber,
    bun2: pnu.subNumber,
    road_code: '',
    initialword: '',
    build_bun1: '',
    build_bun2: '',
    gbnApt: '',
    apt_code: '',
    dong_code: '',
    ho_code: '',
    tabGbn: 'Text',
    full_addr_name: '',
    dong_name: '',
    ho_name: '',
    notice_amt: '',
    ktown_ho_seq: '',
    print_yn: '0',
    past_yn: '1',
    searchGbnRoad: '',
    searchGbnBunji: '1',
    searchGbnBunjiYear: '',
    capcha: '',
    capcha_chk_yn: '',
    recaptcha_token: '',
    init_gbn: 'N',
  }
}

export function detachedHouseParams(pnu: ParsedPnu): Record<string, string> {
  return {
    page_no: '1',
    gbn: '1',
    year: '',
    reg: pnu.legalDongCode.slice(0, 5),
    eub: pnu.legalDongCode.slice(5),
    san: pnu.landKind === '2' ? '2' : '1',
    bun1: pnu.paddedMainNumber,
    bun2: pnu.paddedSubNumber,
    road_code: '',
    p_initialword: '',
    build_bun1: '',
    build_bun2: '',
    from_year: '',
    to_year: '',
    dong_gbn: '',
    tabGbn: 'Text',
  }
}
