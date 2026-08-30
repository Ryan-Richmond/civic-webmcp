export const PROGRAM_IDS = [
  'housing',
  'transit',
  'emergency',
  'health',
  'youth',
  'climate',
  'libraries',
  'streets',
] as const

export const DISTRICT_IDS = [
  'north_harbor',
  'east_junction',
  'river_ward',
  'central',
  'south_point',
  'west_hills',
] as const

export const OUTCOME_IDS = ['stability', 'mobility', 'safety', 'opportunity'] as const

export type ProgramId = (typeof PROGRAM_IDS)[number]
export type DistrictId = (typeof DISTRICT_IDS)[number]
export type OutcomeId = (typeof OUTCOME_IDS)[number]
export type CoefficientId = `cf_${ProgramId}_${OutcomeId}`
export type Allocation = Record<ProgramId, number>
export type OutcomeWeights = Record<OutcomeId, number>

export interface Program {
  id: ProgramId
  label: string
  baseline: number
  minimum: number
  maximum: number
}

export interface District {
  id: DistrictId
  label: string
}

export interface Coefficient {
  id: CoefficientId
  programId: ProgramId
  outcomeId: OutcomeId
  value: number
  confidence: 'low' | 'medium'
  provenance: 'assumed' | 'seeded'
}

export interface Target {
  minimum?: number
  maximum?: number
}

export type Targets = Partial<Record<ProgramId, Target>>
export type Pins = Partial<Record<ProgramId, number>>

export interface BindingConstraint {
  programId: ProgramId
  cause: 'pin' | 'protected' | 'target' | 'cap' | 'statute'
  detail: string
}

export interface EffectiveBound {
  programId: ProgramId
  lower: number
  upper: number
  requestedLower: number
  requestedUpper: number
  lowerCause: BindingConstraint['cause']
  upperCause: BindingConstraint['cause']
}
