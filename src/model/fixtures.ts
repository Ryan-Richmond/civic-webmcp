import type {
  Allocation,
  Coefficient,
  District,
  DistrictId,
  OutcomeId,
  OutcomeWeights,
  Program,
  ProgramId,
} from './types'

export const MODEL_VERSION = 'hc-1.0'
export const TOTAL_BUDGET = 1_000
export const DEFAULT_CHANGE_CAP = 0.3

export const PROGRAMS: readonly Program[] = [
  { id: 'housing', label: 'Housing Stability', baseline: 150, minimum: 80, maximum: 300 },
  { id: 'transit', label: 'Transit and Access', baseline: 140, minimum: 80, maximum: 250 },
  { id: 'emergency', label: 'Emergency Response', baseline: 200, minimum: 180, maximum: 250 },
  { id: 'health', label: 'Public Health', baseline: 110, minimum: 70, maximum: 200 },
  { id: 'youth', label: 'Youth and Learning', baseline: 140, minimum: 80, maximum: 220 },
  { id: 'climate', label: 'Climate and Parks', baseline: 80, minimum: 40, maximum: 160 },
  { id: 'libraries', label: 'Libraries and Digital Access', baseline: 70, minimum: 50, maximum: 120 },
  { id: 'streets', label: 'Streets and Infrastructure', baseline: 110, minimum: 70, maximum: 200 },
]

export const DISTRICTS: readonly District[] = [
  { id: 'north_harbor', label: 'North Harbor' },
  { id: 'east_junction', label: 'East Junction' },
  { id: 'river_ward', label: 'River Ward' },
  { id: 'central', label: 'Central' },
  { id: 'south_point', label: 'South Point' },
  { id: 'west_hills', label: 'West Hills' },
]

export const BASELINE_ALLOCATION = Object.fromEntries(
  PROGRAMS.map((program) => [program.id, program.baseline]),
) as Allocation

export const DISTRICT_INCIDENCE: Record<ProgramId, Record<DistrictId, number>> = {
  housing: { river_ward: 0.3, south_point: 0.22, east_junction: 0.18, north_harbor: 0.14, central: 0.11, west_hills: 0.05 },
  transit: { east_junction: 0.28, central: 0.24, south_point: 0.2, north_harbor: 0.13, river_ward: 0.11, west_hills: 0.04 },
  emergency: { central: 0.22, south_point: 0.2, river_ward: 0.19, east_junction: 0.17, north_harbor: 0.13, west_hills: 0.09 },
  health: { river_ward: 0.27, south_point: 0.21, east_junction: 0.18, central: 0.16, north_harbor: 0.12, west_hills: 0.06 },
  youth: { south_point: 0.25, river_ward: 0.24, east_junction: 0.19, north_harbor: 0.15, central: 0.1, west_hills: 0.07 },
  climate: { north_harbor: 0.24, west_hills: 0.21, south_point: 0.19, river_ward: 0.16, central: 0.12, east_junction: 0.08 },
  libraries: { central: 0.23, east_junction: 0.2, south_point: 0.19, river_ward: 0.18, north_harbor: 0.13, west_hills: 0.07 },
  streets: { west_hills: 0.21, south_point: 0.2, north_harbor: 0.19, east_junction: 0.16, river_ward: 0.13, central: 0.11 },
}

export const COEFFICIENTS: readonly Coefficient[] = [
  { id: 'cf_housing_stability', programId: 'housing', outcomeId: 'stability', value: 1.6, confidence: 'low', provenance: 'assumed' },
  { id: 'cf_housing_opportunity', programId: 'housing', outcomeId: 'opportunity', value: 0.5, confidence: 'low', provenance: 'assumed' },
  { id: 'cf_transit_mobility', programId: 'transit', outcomeId: 'mobility', value: 1.4, confidence: 'medium', provenance: 'seeded' },
  { id: 'cf_transit_opportunity', programId: 'transit', outcomeId: 'opportunity', value: 0.4, confidence: 'low', provenance: 'assumed' },
  { id: 'cf_emergency_safety', programId: 'emergency', outcomeId: 'safety', value: 1.5, confidence: 'medium', provenance: 'seeded' },
  { id: 'cf_health_stability', programId: 'health', outcomeId: 'stability', value: 0.7, confidence: 'low', provenance: 'assumed' },
  { id: 'cf_health_safety', programId: 'health', outcomeId: 'safety', value: 0.6, confidence: 'low', provenance: 'assumed' },
  { id: 'cf_youth_opportunity', programId: 'youth', outcomeId: 'opportunity', value: 1.5, confidence: 'low', provenance: 'assumed' },
  { id: 'cf_climate_safety', programId: 'climate', outcomeId: 'safety', value: 0.9, confidence: 'low', provenance: 'assumed' },
  { id: 'cf_streets_mobility', programId: 'streets', outcomeId: 'mobility', value: 1, confidence: 'medium', provenance: 'seeded' },
  { id: 'cf_streets_safety', programId: 'streets', outcomeId: 'safety', value: 0.5, confidence: 'low', provenance: 'assumed' },
]

export const BASELINE_OUTCOMES: Record<DistrictId, Record<OutcomeId, number>> = {
  north_harbor: { stability: 62, mobility: 55, safety: 68, opportunity: 58 },
  east_junction: { stability: 54, mobility: 74, safety: 61, opportunity: 63 },
  river_ward: { stability: 41, mobility: 58, safety: 52, opportunity: 44 },
  central: { stability: 59, mobility: 78, safety: 66, opportunity: 69 },
  south_point: { stability: 57, mobility: 62, safety: 63, opportunity: 59 },
  west_hills: { stability: 74, mobility: 44, safety: 77, opportunity: 71 },
}

export const SIGNATURE_WEIGHTS: OutcomeWeights = {
  stability: 0.35,
  mobility: 0.35,
  opportunity: 0.2,
  safety: 0.1,
}
