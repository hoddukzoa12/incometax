import type { ApartmentUnitOption } from '../../shared/official-price'
import { SIDEBAR_MESSAGES } from '../messages/sidebar'

const optionLabel = (name: string, suffix: string): string =>
  name.endsWith(suffix) ? name : `${name}${suffix}`

export function UnitSelectionFields({
  dongs,
  rooms,
  hideDongField = false,
  selectedDong,
  selectedRoom,
  dongLoading,
  roomLoading,
  dongError,
  roomError,
  dongNoData,
  roomNoData,
  manualDong,
  manualRoom,
  lookupLoading,
  onDongChange,
  onRoomChange,
  onRoomSelect,
  onLookup,
}: {
  readonly dongs: readonly ApartmentUnitOption[]
  readonly rooms: readonly ApartmentUnitOption[]
  readonly hideDongField?: boolean
  readonly selectedDong: string
  readonly selectedRoom: string
  readonly dongLoading: boolean
  readonly roomLoading: boolean
  readonly dongError: string | null
  readonly roomError: string | null
  readonly dongNoData: string | null
  readonly roomNoData: string | null
  readonly manualDong: boolean
  readonly manualRoom: boolean
  readonly lookupLoading: boolean
  readonly onDongChange: (dong: string) => void
  readonly onRoomChange: (room: string) => void
  readonly onRoomSelect: (room: string) => void
  readonly onLookup: () => void
}) {
  const showFields = manualDong || dongs.length > 0

  return (
    <>
      {dongLoading && (
        <p className="complex-sidebar__loading">
          {SIDEBAR_MESSAGES.dongLoading}
        </p>
      )}
      {dongError && (
        <p className="complex-sidebar__error" role="alert">{dongError}</p>
      )}
      {dongNoData && (
        <p className="complex-sidebar__empty">{dongNoData}</p>
      )}

      {showFields && (
        <div className="unit-picker__fields">
          {!hideDongField && (
            <label>
              <span>
                {manualDong
                  ? SIDEBAR_MESSAGES.dongInputLabel
                  : SIDEBAR_MESSAGES.dongLabel}
              </span>
              {manualDong ? (
                <input
                  value={selectedDong}
                  placeholder={SIDEBAR_MESSAGES.enterDong}
                  onChange={(event) => onDongChange(event.target.value)}
                />
              ) : (
                <select
                  value={selectedDong}
                  onChange={(event) => onDongChange(event.target.value)}
                >
                  <option value="">{SIDEBAR_MESSAGES.selectDong}</option>
                  {dongs.map((option) => (
                    <option key={option.code} value={option.name}>
                      {optionLabel(option.name, SIDEBAR_MESSAGES.dongSuffix)}
                    </option>
                  ))}
                </select>
              )}
            </label>
          )}

          <label>
            <span>
              {manualRoom
                ? SIDEBAR_MESSAGES.roomInputLabel
                : SIDEBAR_MESSAGES.roomLabel}
            </span>
            {manualRoom ? (
              <input
                value={selectedRoom}
                disabled={!selectedDong.trim()}
                placeholder={SIDEBAR_MESSAGES.enterRoom}
                onChange={(event) => onRoomChange(event.target.value)}
              />
            ) : (
              <select
                value={selectedRoom}
                disabled={!selectedDong.trim() || roomLoading}
                onChange={(event) => onRoomSelect(event.target.value)}
              >
                <option value="">{SIDEBAR_MESSAGES.selectRoom}</option>
                {rooms.map((option) => (
                  <option key={option.code} value={option.name}>
                    {optionLabel(option.name, SIDEBAR_MESSAGES.roomSuffix)}
                  </option>
                ))}
              </select>
            )}
          </label>
        </div>
      )}

      {roomLoading && (
        <p className="complex-sidebar__loading">
          {SIDEBAR_MESSAGES.roomLoading}
        </p>
      )}
      {roomError && (
        <p className="complex-sidebar__error" role="alert">{roomError}</p>
      )}
      {roomNoData && (
        <p className="complex-sidebar__empty">{roomNoData}</p>
      )}
      {(manualDong || manualRoom) && (
        <p className="unit-picker__fallback-guide">
          {SIDEBAR_MESSAGES.manualUnitGuide}
        </p>
      )}
      <button
        className="unit-picker__lookup"
        type="button"
        disabled={!selectedDong.trim() || !selectedRoom.trim() || lookupLoading}
        onClick={onLookup}
      >
        {SIDEBAR_MESSAGES.priceLookup}
      </button>
    </>
  )
}
