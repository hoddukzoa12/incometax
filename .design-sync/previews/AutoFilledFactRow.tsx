import { AutoFilledFactRow, TaxTermHelp } from 'incometax'

/**
 * 조건 화면의 "자동으로 확인한 값" 한 줄.
 * 사용자에게 묻지 않고 채운 값을 보여 주고, 고칠 때만 입력을 연다 —
 * 입력 비용을 0 으로 두는 것이 이 컴포넌트의 존재 이유다.
 */
export function AutoFilled() {
  return (
    <AutoFilledFactRow
      label="공시가격"
      value="2,237,000,000 원"
      editing={false}
      onEdit={() => {}}
    >
      <input type="text" defaultValue="2237000000" />
    </AutoFilledFactRow>
  )
}

/** 용어 도움말이 붙은 줄. */
export function WithHelp() {
  return (
    <AutoFilledFactRow
      label="조정대상지역"
      help={<TaxTermHelp term="adjustedArea" />}
      value="해당함"
      editing={false}
      onEdit={() => {}}
    >
      <select defaultValue="yes">
        <option value="yes">해당함</option>
        <option value="no">해당하지 않음</option>
      </select>
    </AutoFilledFactRow>
  )
}

/** 고치는 중 — 자동값 대신 입력이 열린다. */
export function Editing() {
  return (
    <AutoFilledFactRow label="내 소유 지분" value="100%" editing>
      <input type="number" defaultValue={100} min={0} max={100} />
    </AutoFilledFactRow>
  )
}

/** 고칠 수 없는 값 — onEdit 이 없으면 수정 버튼이 나오지 않는다. */
export function ReadOnly() {
  return (
    <AutoFilledFactRow label="공시가격 기준일" value="2026.1.1" editing={false}>
      <span />
    </AutoFilledFactRow>
  )
}
