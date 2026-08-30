import {
  BASELINE_ALLOCATION,
  COEFFICIENTS,
  DEFAULT_CHANGE_CAP,
  PROGRAMS,
  TOTAL_BUDGET,
} from '../model/fixtures'
import { OUTCOME_IDS, PROGRAM_IDS } from '../model/types'
import type {
  Allocation,
  BindingConstraint,
  EffectiveBound,
  OutcomeWeights,
  Pins,
  ProgramId,
  Targets,
} from '../model/types'

export interface SolveRequest {
  weights: OutcomeWeights
  canonical?: Allocation
  pins?: Pins
  protectedPrograms?: readonly ProgramId[]
  targets?: Targets
  changeCap?: number
}

export interface FeasibleResult {
  status: 'feasible'
  allocation: Allocation
  bounds: EffectiveBound[]
  bindings: BindingConstraint[]
  scores: Record<ProgramId, number>
}

export interface InfeasibleResult {
  status: 'infeasible'
  requiredTotal: number
  availableTotal: number
  bounds: EffectiveBound[]
  conflicts: BindingConstraint[]
}

export type SolveResult = FeasibleResult | InfeasibleResult

const clamp = (value: number, lower: number, upper: number) => Math.min(upper, Math.max(lower, value))

function assertGridValue(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) throw new Error(`${label} must be an integer number of $0.1M units`)
}

function effectiveBounds(request: SolveRequest): EffectiveBound[] {
  const canonical = request.canonical ?? BASELINE_ALLOCATION
  const cap = request.changeCap ?? DEFAULT_CHANGE_CAP
  const protectedSet = new Set(request.protectedPrograms ?? [])

  return PROGRAMS.map((program) => {
    const capLower = Math.round(program.baseline * (1 - cap))
    const capUpper = Math.round(program.baseline * (1 + cap))
    let lower = Math.max(program.minimum, capLower)
    let upper = Math.min(program.maximum, capUpper)
    let requestedLower = lower
    let requestedUpper = upper
    let lowerCause: EffectiveBound['lowerCause'] = lower === program.minimum ? 'statute' : 'cap'
    let upperCause: EffectiveBound['upperCause'] = upper === program.maximum ? 'statute' : 'cap'

    const pin = request.pins?.[program.id]
    if (pin !== undefined) {
      assertGridValue(pin, `Pin for ${program.id}`)
      lower = pin
      upper = pin
      requestedLower = pin
      requestedUpper = pin
      lowerCause = 'pin'
      upperCause = 'pin'
    } else if (protectedSet.has(program.id)) {
      const held = canonical[program.id]
      assertGridValue(held, `Canonical allocation for ${program.id}`)
      lower = held
      upper = held
      requestedLower = held
      requestedUpper = held
      lowerCause = 'protected'
      upperCause = 'protected'
    }

    const target = request.targets?.[program.id]
    if (target?.minimum !== undefined) {
      assertGridValue(target.minimum, `Minimum target for ${program.id}`)
      requestedLower = Math.max(requestedLower, target.minimum)
      lower = Math.max(lower, target.minimum)
      lowerCause = 'target'
    }
    if (target?.maximum !== undefined) {
      assertGridValue(target.maximum, `Maximum target for ${program.id}`)
      requestedUpper = Math.min(requestedUpper, target.maximum)
      upper = Math.min(upper, target.maximum)
      upperCause = 'target'
    }

    return { programId: program.id, lower, upper, requestedLower, requestedUpper, lowerCause, upperCause }
  })
}

function programScores(weights: OutcomeWeights): Record<ProgramId, number> {
  for (const outcome of OUTCOME_IDS) {
    if (!Number.isFinite(weights[outcome]) || weights[outcome] < 0) {
      throw new Error(`Weight for ${outcome} must be a finite non-negative number`)
    }
  }

  return Object.fromEntries(
    PROGRAM_IDS.map((programId) => [
      programId,
      COEFFICIENTS.filter((coefficient) => coefficient.programId === programId).reduce(
        (score, coefficient) => score + coefficient.value * weights[coefficient.outcomeId],
        0,
      ),
    ]),
  ) as Record<ProgramId, number>
}

const requestBindings = (bounds: EffectiveBound[]): BindingConstraint[] =>
  bounds.reduce<BindingConstraint[]>((bindings, bound) => {
    if (bound.lowerCause === 'target') {
      bindings.push({ programId: bound.programId, cause: 'target', detail: `requires at least $${(bound.requestedLower / 10).toFixed(1)}M` })
    }
    else if (bound.lowerCause === 'pin' || bound.lowerCause === 'protected') {
      bindings.push({ programId: bound.programId, cause: bound.lowerCause, detail: `held at $${(bound.lower / 10).toFixed(1)}M` })
    }
    return bindings
  }, [])

export function solveScenario(request: SolveRequest): SolveResult {
  const bounds = effectiveBounds(request)
  const requiredTotal = bounds.reduce((total, bound) => total + bound.requestedLower, 0)
  const maximumTotal = bounds.reduce((total, bound) => total + bound.requestedUpper, 0)
  const crossedBounds = bounds.filter((bound) => bound.lower > bound.upper)

  if (crossedBounds.length > 0 || requiredTotal > TOTAL_BUDGET || maximumTotal < TOTAL_BUDGET) {
    return {
      status: 'infeasible',
      requiredTotal,
      availableTotal: TOTAL_BUDGET,
      bounds,
      conflicts: requestBindings(bounds),
    }
  }

  const scores = programScores(request.weights)
  const allocation = Object.fromEntries(bounds.map((bound) => [bound.programId, bound.lower])) as Allocation
  let remaining = TOTAL_BUDGET - bounds.reduce((total, bound) => total + bound.lower, 0)
  const ranked = [...bounds].sort(
    (left, right) => scores[right.programId] - scores[left.programId] || left.programId.localeCompare(right.programId),
  )

  for (const bound of ranked) {
    const increment = Math.min(remaining, bound.upper - allocation[bound.programId])
    allocation[bound.programId] += increment
    remaining -= increment
  }

  const total = PROGRAM_IDS.reduce((sum, id) => sum + allocation[id], 0)
  if (remaining !== 0 || total !== TOTAL_BUDGET) throw new Error('Solver invariant failed: allocation does not close exactly')
  for (const [id, value] of Object.entries(allocation)) assertGridValue(value, `Allocation for ${id}`)

  return { status: 'feasible', allocation, bounds, bindings: requestBindings(bounds), scores }
}

export function normalizeWeightVector(weights: Partial<OutcomeWeights>): OutcomeWeights {
  const raw = Object.fromEntries(OUTCOME_IDS.map((id) => [id, Math.max(0, weights[id] ?? 0)])) as OutcomeWeights
  const total = OUTCOME_IDS.reduce((sum, id) => sum + raw[id], 0)
  if (total === 0) return { stability: 0.25, mobility: 0.25, safety: 0.25, opportunity: 0.25 }
  return Object.fromEntries(OUTCOME_IDS.map((id) => [id, clamp(raw[id] / total, 0, 1)])) as OutcomeWeights
}
