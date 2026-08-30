import { describe, expect, it } from 'vitest'
import { allocationAtElapsed, staggerRanks, STAGGER_MS, TRANSITION_MS, transitionDuration } from './useAnimatedAllocation'
import { BASELINE_ALLOCATION, SIGNATURE_WEIGHTS } from '../model/fixtures'
import { solveScenario } from '../engine/solve'
import { PROGRAM_IDS } from '../model/types'
import type { Allocation } from '../model/types'

const proposal = (): Allocation => {
  const result = solveScenario({ weights: SIGNATURE_WEIGHTS, protectedPrograms: ['emergency'] })
  if (result.status !== 'feasible') throw new Error('fixture must be feasible')
  return result.allocation
}

describe('flow transition timing', () => {
  it('orders the stagger by descending magnitude and skips programs that did not move', () => {
    const to = proposal()
    const ranks = staggerRanks(BASELINE_ALLOCATION, to)

    expect(ranks.get('housing')).toBe(0)
    expect(ranks.has('emergency')).toBe(false)
    const byRank = [...ranks.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => Math.abs(to[id] - BASELINE_ALLOCATION[id]))
    expect(byRank).toEqual([...byRank].sort((a, b) => b - a))
  })

  it('starts at the old allocation and lands exactly on the new one', () => {
    const to = proposal()
    const start = allocationAtElapsed(BASELINE_ALLOCATION, to, 0)
    const end = allocationAtElapsed(BASELINE_ALLOCATION, to, transitionDuration(BASELINE_ALLOCATION, to))

    expect(start).toEqual(BASELINE_ALLOCATION)
    for (const id of PROGRAM_IDS) expect(end[id]).toBeCloseTo(to[id], 6)
  })

  it('holds a staggered program still until its delay elapses', () => {
    const to = proposal()
    const ranked = [...staggerRanks(BASELINE_ALLOCATION, to).entries()].sort((a, b) => b[1] - a[1])
    const lastId = ranked[0]![0]
    const lastRank = ranked[0]![1]

    expect(lastRank).toBeGreaterThan(0)
    const justBefore = allocationAtElapsed(BASELINE_ALLOCATION, to, lastRank * STAGGER_MS - 1)
    expect(justBefore[lastId]).toBe(BASELINE_ALLOCATION[lastId])
    const leader = allocationAtElapsed(BASELINE_ALLOCATION, to, lastRank * STAGGER_MS - 1)
    expect(leader.housing).not.toBe(BASELINE_ALLOCATION.housing)
  })

  it('eases out, so it is past the halfway point at half the duration', () => {
    const to = proposal()
    const mid = allocationAtElapsed(BASELINE_ALLOCATION, to, TRANSITION_MS / 2)
    const linear = BASELINE_ALLOCATION.housing + (to.housing - BASELINE_ALLOCATION.housing) / 2

    expect(mid.housing).toBeGreaterThan(linear)
    expect(mid.housing).toBeLessThan(to.housing)
  })

  it('never overshoots the target or leaves the transition running early', () => {
    const to = proposal()
    for (let elapsed = 0; elapsed <= transitionDuration(BASELINE_ALLOCATION, to); elapsed += 25) {
      const frame = allocationAtElapsed(BASELINE_ALLOCATION, to, elapsed)
      for (const id of PROGRAM_IDS) {
        const low = Math.min(BASELINE_ALLOCATION[id], to[id])
        const high = Math.max(BASELINE_ALLOCATION[id], to[id])
        expect(frame[id]).toBeGreaterThanOrEqual(low - 1e-9)
        expect(frame[id]).toBeLessThanOrEqual(high + 1e-9)
      }
    }
  })
})
