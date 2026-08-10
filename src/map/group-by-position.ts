import type { ComplexSummary } from '../../shared/complex'

/**
 * 같은 좌표의 단지를 한 묶음으로 만든다.
 *
 * 적재된 22,260개 중 500개가 245개 지점에 겹쳐 있다 — 지오코딩이 같은 지번으로
 * 풀어서다(자양현대·자양현대3차가 소수점까지 같다). 라벨을 밀어 펼치면 지도에서의
 * 위치가 거짓이 되므로 겹친 대로 묶어 보이고 눌러서 고르게 한다.
 *
 * 묶음 안에서는 세대 수가 큰 단지가 앞에 온다 — 접힌 라벨의 대표 이름이 된다.
 */
export const groupComplexesByPosition = (
  complexes: readonly ComplexSummary[],
): readonly (readonly ComplexSummary[])[] => {
  const groups = new Map<string, ComplexSummary[]>()
  for (const complex of complexes) {
    const key = `${complex.lat},${complex.lng}`
    const group = groups.get(key)
    if (group) group.push(complex)
    else groups.set(key, [complex])
  }
  return [...groups.values()].map((group) =>
    [...group].sort(
      (a, b) => (b.householdCount ?? 0) - (a.householdCount ?? 0),
    ),
  )
}
