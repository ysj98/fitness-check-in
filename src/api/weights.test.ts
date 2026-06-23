import { describe, expect, it } from 'vitest'
import { fromWeightKg, toWeightKg } from '@/utils/weight'

describe('weight unit conversion', () => {
  it('converts jin to canonical kilograms', () => {
    expect(toWeightKg(130, 'jin')).toBe(65)
    expect(toWeightKg(130.5, 'jin')).toBe(65.25)
  })

  it('converts kilograms to the selected display unit', () => {
    expect(fromWeightKg(65.25, 'jin')).toBe(130.5)
    expect(fromWeightKg(65.25, 'kg')).toBe(65.3)
  })
})
