import { describe, expect, it } from 'vitest'

import {
  normalizeKaptBasisResponse,
  UnusableKaptBasisError,
} from '../scripts/lib/complex-normalizer.ts'

describe('normalizeKaptBasisResponse', () => {
  it('normalizes the documented K-apt V4 response fields', () => {
    expect(
      normalizeKaptBasisResponse({
        response: {
          header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
          body: {
            item: {
              kaptCode: 'A10027875',
              kaptName: '괴정 경성스마트W아파트',
              kaptAddr: '부산광역시 사하구 괴정동 258',
              doroJuso: '부산광역시 사하구 낙동대로 180',
              bjdCode: '2638010100',
              kaptUsedate: '20150806',
              kaptDongCnt: 3,
              kaptdaCnt: '182',
            },
          },
        },
      }),
    ).toEqual({
      complexId: 'A10027875',
      name: '괴정 경성스마트W아파트',
      legalAddress: '부산광역시 사하구 괴정동 258',
      roadAddress: '부산광역시 사하구 낙동대로 180',
      legalDongCode: '2638010100',
      approvalDate: '2015-08-06',
      buildingCount: 3,
      householdCount: 182,
    })
  })

  it('rejects a malformed legal dong code', () => {
    expect(() =>
      normalizeKaptBasisResponse({
        response: {
          header: { resultCode: '00' },
          body: {
            item: {
              kaptCode: 'A10027875',
              kaptName: '단지',
              kaptAddr: '주소',
              bjdCode: '26380',
              kaptDongCnt: 3,
              kaptdaCnt: 182,
            },
          },
        },
      }),
    ).toThrow('Expected 10-digit legal dong code')
  })

  it('uses the verified request code when a normal basis response omits it', () => {
    expect(
      normalizeKaptBasisResponse(
        {
          response: {
            header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
            body: {
              item: {
                kaptCode: '',
                kaptName: '단지',
                kaptAddr: '주소',
                bjdCode: '2638010100',
                kaptDongCnt: 3,
                kaptdaCnt: 182,
              },
            },
          },
        },
        'A10020277',
      ).complexId,
    ).toBe('A10020277')
  })

  it('classifies a successful response with empty required fields as unusable', () => {
    expect(() =>
      normalizeKaptBasisResponse(
        {
          response: {
            header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
            body: {
              item: {
                kaptCode: null,
                kaptName: null,
                kaptAddr: null,
                bjdCode: null,
                kaptDongCnt: null,
                kaptdaCnt: null,
              },
            },
          },
        },
        'A10020277',
      ),
    ).toThrow(UnusableKaptBasisError)
  })
})
