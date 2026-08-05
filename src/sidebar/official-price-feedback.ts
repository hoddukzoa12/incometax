import type {
  ApartmentUnitOptionsResult,
  OfficialPriceFailureKind,
  OfficialPriceLookupStage,
  OfficialPriceNoDataReason,
  OfficialPriceResolutionResult,
} from '../../shared/official-price'
import { SIDEBAR_MESSAGES } from '../messages/sidebar'

const FAILURE_MESSAGES = {
  unitOptions: {
    invalidRequest: SIDEBAR_MESSAGES.unitInvalidRequest,
    sourceUnavailable: SIDEBAR_MESSAGES.unitSourceUnavailable,
    captchaRequired: SIDEBAR_MESSAGES.captchaRequired,
    invalidSourceResponse: SIDEBAR_MESSAGES.unitSourceInvalid,
  },
  addressToPnu: {
    invalidRequest: SIDEBAR_MESSAGES.pnuInvalidRequest,
    sourceUnavailable: SIDEBAR_MESSAGES.pnuSourceUnavailable,
    captchaRequired: SIDEBAR_MESSAGES.captchaRequired,
    invalidSourceResponse: SIDEBAR_MESSAGES.pnuSourceInvalid,
  },
  officialPrice: {
    invalidRequest: SIDEBAR_MESSAGES.priceInvalidRequest,
    sourceUnavailable: SIDEBAR_MESSAGES.priceSourceUnavailable,
    captchaRequired: SIDEBAR_MESSAGES.captchaRequired,
    invalidSourceResponse: SIDEBAR_MESSAGES.priceSourceInvalid,
  },
} as const satisfies Record<
  'unitOptions' | OfficialPriceLookupStage,
  Record<OfficialPriceFailureKind, string>
>

const NO_DATA_MESSAGES = {
  addressNotFound: SIDEBAR_MESSAGES.addressNotFound,
  complexNotFound: SIDEBAR_MESSAGES.complexNotFound,
  dongNotFound: SIDEBAR_MESSAGES.dongNotFound,
  roomNotFound: SIDEBAR_MESSAGES.roomNotFound,
  priceNotFound: SIDEBAR_MESSAGES.priceNoData,
} as const satisfies Record<OfficialPriceNoDataReason, string>

export const unitOptionsFailureMessage = (
  result: ApartmentUnitOptionsResult,
): string | null => result.status === 'failed'
  ? FAILURE_MESSAGES.unitOptions[result.failure.kind]
  : null

export const unitOptionsNoDataMessage = (
  result: ApartmentUnitOptionsResult,
  optionKind: 'dongs' | 'rooms',
): string | null => {
  if (result.status === 'noData') return NO_DATA_MESSAGES[result.reason]
  if (result.status === 'failed' || result.value[optionKind].length > 0) {
    return null
  }
  return optionKind === 'dongs'
    ? SIDEBAR_MESSAGES.unitNoData
    : SIDEBAR_MESSAGES.roomNoData
}

export const officialPriceFailureMessage = (
  result: OfficialPriceResolutionResult,
): string | null => result.status === 'failed'
  ? FAILURE_MESSAGES[result.lookupStage][result.failure.kind]
  : null

export const officialPriceNoDataMessage = (
  result: OfficialPriceResolutionResult,
): string | null => result.status === 'noData'
  ? NO_DATA_MESSAGES[result.reason]
  : null
