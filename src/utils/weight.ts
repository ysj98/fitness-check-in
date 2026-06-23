export type WeightUnit = 'kg' | 'jin'

export function toWeightKg(value: number, unit: WeightUnit) {
  return roundWeight(unit === 'jin' ? value / 2 : value)
}

export function fromWeightKg(value: number, unit: WeightUnit) {
  return roundWeight(unit === 'jin' ? value * 2 : value, 1)
}

export function roundWeight(value: number, digits = 2) {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}
