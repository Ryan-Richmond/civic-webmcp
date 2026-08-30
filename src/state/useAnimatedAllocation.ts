import { useEffect, useRef, useState } from 'react'
import { PROGRAM_IDS } from '../model/types'
import type { Allocation, ProgramId } from '../model/types'

/** SPEC.md section 4: transitions 500ms ease-out, staggered 40ms in descending magnitude. */
export const TRANSITION_MS = 500
export const STAGGER_MS = 40

const easeOut = (t: number) => 1 - (1 - t) ** 3

/** Rank the programs that move so the eye follows the largest transfer first. */
export function staggerRanks(from: Allocation, to: Allocation): Map<ProgramId, number> {
  const moved = PROGRAM_IDS.filter((id) => from[id] !== to[id])
    .sort((a, b) => Math.abs(to[b] - from[b]) - Math.abs(to[a] - from[a]) || a.localeCompare(b))
  return new Map(moved.map((id, index) => [id, index]))
}

/** The allocation at one instant of the transition. Exported so the timing is testable without a browser. */
export function allocationAtElapsed(from: Allocation, to: Allocation, elapsed: number): Allocation {
  const ranks = staggerRanks(from, to)
  return Object.fromEntries(PROGRAM_IDS.map((id) => {
    const progress = Math.min(1, Math.max(0, (elapsed - (ranks.get(id) ?? 0) * STAGGER_MS) / TRANSITION_MS))
    return [id, from[id] + (to[id] - from[id]) * easeOut(progress)]
  })) as Allocation
}

export function transitionDuration(from: Allocation, to: Allocation): number {
  const ranks = staggerRanks(from, to)
  if (ranks.size === 0) return 0
  return TRANSITION_MS + (ranks.size - 1) * STAGGER_MS
}

/**
 * Eases the displayed allocation toward the real one. Recharts remounts its Sankey paths on every data
 * change, so a CSS transition on those elements can never fire; animating the data moves the flow diagram,
 * the program bars, and the district tiles off one clock instead.
 *
 * Returns fractional tenths mid-flight. Callers must read displayed numbers from the real allocation.
 */
export function useAnimatedAllocation(target: Allocation): Allocation {
  const [displayed, setDisplayed] = useState<Allocation>(target)
  const displayedRef = useRef<Allocation>(target)
  displayedRef.current = displayed

  useEffect(() => {
    const from = displayedRef.current
    if (PROGRAM_IDS.every((id) => from[id] === target[id])) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayed(target)
      return
    }

    // An agent can stage a scenario while the in-app browser is backgrounded, where rAF never runs.
    // Snapping keeps the flow diagram from showing an allocation the numbers have already left behind.
    if (document.hidden) {
      setDisplayed(target)
      return
    }

    const total = transitionDuration(from, target)
    const start = performance.now()
    let frame = requestAnimationFrame(function tick(now) {
      const elapsed = now - start
      if (elapsed >= total) {
        setDisplayed(target)
        return
      }
      setDisplayed(allocationAtElapsed(from, target, elapsed))
      frame = requestAnimationFrame(tick)
    })
    const snapIfHidden = () => { if (document.hidden) { cancelAnimationFrame(frame); setDisplayed(target) } }
    document.addEventListener('visibilitychange', snapIfHidden)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', snapIfHidden)
    }
  }, [target])

  return displayed
}
