import { describe, expect, it } from 'vitest'
import {
  cmToFeetInches,
  displayWeight,
  feetInchesToCm,
  kgToLb,
  lbToKg,
  parseWeightToKg,
} from '../units'

describe('weight conversion', () => {
  it('round-trips kg -> lb -> kg within a small tolerance', () => {
    const kg = 82.5
    const lb = kgToLb(kg)
    expect(lbToKg(lb)).toBeCloseTo(kg, 5)
  })

  it('displayWeight and parseWeightToKg are inverse for a given unit', () => {
    const kg = 100
    const displayed = displayWeight(kg, 'lb')
    expect(parseWeightToKg(displayed, 'lb')).toBeCloseTo(kg, 5)
  })
})

describe('height conversion', () => {
  it('converts cm to feet/inches sensibly', () => {
    const { feet, inches } = cmToFeetInches(180)
    expect(feet).toBe(5)
    expect(inches).toBe(11)
  })

  it('round-trips feet/inches -> cm -> feet/inches', () => {
    const cm = feetInchesToCm(6, 1)
    const back = cmToFeetInches(cm)
    expect(back).toEqual({ feet: 6, inches: 1 })
  })
})
