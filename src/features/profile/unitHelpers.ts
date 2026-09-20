import { formatHeight, formatWeight, inchesToCm, parseWeightToKg, type HeightUnit, type WeightUnit } from '../../models/units'

export function displayWeightFor(kg: number, unit: WeightUnit): string {
  return formatWeight(kg, unit)
}

export function parseWeightInput(value: number, unit: WeightUnit): number {
  return parseWeightToKg(value, unit)
}

export function displayHeightFor(cm: number, unit: HeightUnit): string {
  return formatHeight(cm, unit)
}

/** For the ft_in unit, the single input field is entered as total inches. */
export function parseHeightInput(value: number, unit: HeightUnit): number {
  return unit === 'cm' ? value : inchesToCm(value)
}
