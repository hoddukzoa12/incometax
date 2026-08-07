import { useState } from 'react'
import { ConditionChoiceButtons } from 'incometax'

/** 아직 답하지 않은 상태. 조건 화면이 처음 보여 주는 모습이다. */
export function Unanswered() {
  return <ConditionChoiceButtons value={null} onChange={() => {}} />
}

/** "네"를 고른 상태. aria-pressed 로 선택이 표시된다. */
export function Yes() {
  return <ConditionChoiceButtons value={true} onChange={() => {}} />
}

/** "아니요"를 고른 상태. */
export function No() {
  return <ConditionChoiceButtons value={false} onChange={() => {}} />
}

/** 실제 쓰임 — 질문 문구와 함께 놓고 답을 상태로 받는다. */
export function InQuestion() {
  const [lived, setLived] = useState<boolean | null>(null)
  return (
    <div className="holding-conditions__question">
      <p>이 집에 살고 계신가요?</p>
      <ConditionChoiceButtons value={lived} onChange={setLived} />
    </div>
  )
}
