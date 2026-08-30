import { calculateOutcomes } from '../engine/outcomes'
import { BASELINE_ALLOCATION, DISTRICTS, PROGRAMS, TOTAL_BUDGET } from '../model/fixtures'
import { OUTCOME_IDS } from '../model/types'
import type { Allocation, DistrictId, OutcomeId, ProgramId } from '../model/types'
import { stagedPinConflicts } from './civicState'
import type { CivicState } from './civicState'

export const formatMoney = (tenths: number) => `$${(tenths / 10).toFixed(1)}M`
export const formatDelta = (tenths: number) => `${tenths > 0 ? '+' : '−'}${Math.abs(tenths / 10).toFixed(1)}`

export const OUTCOME_LABELS: Record<OutcomeId, string> = {
  stability: 'Household Stability',
  mobility: 'Access and Mobility',
  safety: 'Safety and Resilience',
  opportunity: 'Opportunity and Inclusion',
}

const programLabel = (programId: ProgramId) => PROGRAMS.find(({ id }) => id === programId)?.label ?? programId
const districtLabel = (districtId: DistrictId) => DISTRICTS.find(({ id }) => id === districtId)?.label ?? districtId

export interface ProgramChange {
  programId: ProgramId
  label: string
  from: number
  to: number
  delta: number
  direction: 'up' | 'down'
}

/** Every program that moved, largest absolute move first. This is the reduced-motion change list. */
export function changeList(canonical: Allocation, proposed: Allocation): ProgramChange[] {
  return PROGRAMS.map((program) => ({
    programId: program.id,
    label: program.label,
    from: canonical[program.id],
    to: proposed[program.id],
    delta: proposed[program.id] - canonical[program.id],
    direction: (proposed[program.id] >= canonical[program.id] ? 'up' : 'down') as 'up' | 'down',
  }))
    .filter(({ delta }) => delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.programId.localeCompare(b.programId))
}

/** Screen-reader summary of the allocation a sighted user reads off the budget canvas. */
export function describeBaseline(state: CivicState): string {
  const ranked = PROGRAMS.map((program) => ({ label: program.label, value: state.canonical[program.id] }))
    .sort((a, b) => b.value - a.value)
  const largest = ranked.slice(0, 3).map(({ label, value }) => `${label} ${formatMoney(value)}`).join(', ')
  const moved = changeList(BASELINE_ALLOCATION, state.canonical)
  const provenance = state.accepted.length === 0
    ? 'This is the published baseline.'
    : `This allocation was accepted by a human and differs from the published baseline in ${moved.length} ${moved.length === 1 ? 'program' : 'programs'}.`
  return `Current allocation: ${formatMoney(TOTAL_BUDGET)} across ${PROGRAMS.length} programs. Largest three: ${largest}. ${provenance}`
}

/** Screen-reader summary of the staged proposal, including why an infeasible request has no plan. */
export function describeScenario(state: CivicState): string {
  const pinned = PROGRAMS.filter((program) => state.pins[program.id] !== undefined)
  const pinNote = pinned.length === 0
    ? 'No programs are pinned.'
    : `Pinned and immutable to tools: ${pinned.map((program) => `${program.label} at ${formatMoney(state.pins[program.id] as number)}`).join(', ')}.`

  if (!state.staged) {
    const receipt = state.accepted.at(-1)
    const acceptedNote = receipt ? ` Last accepted scenario: ${receipt.name}.` : ''
    return `No staged scenario.${acceptedNote} ${pinNote}`
  }

  const { intent, result } = state.staged
  if (result.status === 'infeasible') {
    const conflicts = result.conflicts.map((binding) => `${programLabel(binding.programId)}, ${binding.detail}`).join('; ')
    return `No plan for “${intent.name}”. The requested floors require ${formatMoney(result.requiredTotal)} against ${formatMoney(result.availableTotal)} available. ${result.conflicts.length} binding constraints: ${conflicts}. Nothing changed. ${pinNote}`
  }

  const conflicts = stagedPinConflicts(state)
  if (conflicts.length > 0) {
    const names = conflicts.map(programLabel).join(', ')
    return `Staged scenario “${intent.name}” was solved before ${conflicts.length === 1 ? 'a pin was' : 'pins were'} set and contradicts ${names}. It cannot be accepted until the agent revises it. ${pinNote}`
  }
  const changes = changeList(state.canonical, result.allocation)
  if (changes.length === 0) return `Staged scenario “${intent.name}” moves no money. ${pinNote}`
  const spoken = changes
    .map((change) => `${change.label} ${change.direction === 'up' ? 'up' : 'down'} ${Math.abs(change.delta / 10).toFixed(1)} to ${formatMoney(change.to)}`)
    .join(', ')
  return `Staged scenario “${intent.name}”: ${changes.length} programs move, total stays at ${formatMoney(TOTAL_BUDGET)}. ${spoken}. Not accepted; only a human control can accept it. ${pinNote}`
}

/** Screen-reader equivalent of one district tile across all four indices. */
export function describeDistrict(state: CivicState, districtId: DistrictId, allocation: Allocation): string {
  const scores = calculateOutcomes(allocation, new Set(state.suppressedCoefficients))[districtId]
  const baseline = calculateOutcomes(BASELINE_ALLOCATION)[districtId]
  const parts = OUTCOME_IDS.map((outcomeId) => {
    const delta = scores[outcomeId] - baseline[outcomeId]
    const movement = Math.abs(delta) < 0.05 ? 'no change' : `${delta > 0 ? 'up' : 'down'} ${Math.abs(delta).toFixed(1)}`
    return `${OUTCOME_LABELS[outcomeId]} ${scores[outcomeId].toFixed(1)}, ${movement} from baseline`
  })
  return `${districtLabel(districtId)}: ${parts.join('; ')}.`
}

/** The activity rail must not report human decisions as agent tool calls. */
export function activityCounts(state: CivicState): { toolCalls: number; humanDecisions: number } {
  return {
    toolCalls: state.activity.filter((entry) => entry.actor === 'tool').length,
    humanDecisions: state.activity.filter((entry) => entry.actor === 'human').length,
  }
}
