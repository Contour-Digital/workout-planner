export type WeightUnit = 'kg' | 'lb'
export type HeightUnit = 'cm' | 'ft_in'
export type DistanceUnit = 'km' | 'mi'

const KG_PER_LB = 0.45359237
const CM_PER_INCH = 2.54

/** All weights are stored internally in kilograms to avoid repeated lossy conversion. */
export function kgToLb(kg: number): number {
  return kg / KG_PER_LB
}
export function lbToKg(lb: number): number {
  return lb * KG_PER_LB
}
export function displayWeight(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? kg : kgToLb(kg)
}
export function parseWeightToKg(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value : lbToKg(value)
}

/** All heights are stored internally in centimetres. */
export function cmToInches(cm: number): number {
  return cm / CM_PER_INCH
}
export function inchesToCm(inches: number): number {
  return inches * CM_PER_INCH
}
export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cmToInches(cm)
  const feet = Math.floor(totalInches / 12)
  const inches = Math.round(totalInches - feet * 12)
  if (inches === 12) return { feet: feet + 1, inches: 0 }
  return { feet, inches }
}
export function feetInchesToCm(feet: number, inches: number): number {
  return inchesToCm(feet * 12 + inches)
}

/** All distances are stored internally in metres. */
const M_PER_MILE = 1609.344
export function metersToKm(m: number): number {
  return m / 1000
}
export function kmToMeters(km: number): number {
  return km * 1000
}
export function metersToMiles(m: number): number {
  return m / M_PER_MILE
}
export function milesToMeters(mi: number): number {
  return mi * M_PER_MILE
}
export function displayDistance(meters: number, unit: DistanceUnit): number {
  return unit === 'km' ? metersToKm(meters) : metersToMiles(meters)
}
export function parseDistanceToMeters(value: number, unit: DistanceUnit): number {
  return unit === 'km' ? kmToMeters(value) : milesToMeters(value)
}

export function formatWeight(kg: number | undefined, unit: WeightUnit): string {
  if (kg === undefined) return '—'
  const v = displayWeight(kg, unit)
  return `${round1(v)} ${unit}`
}

export function formatHeight(cm: number | undefined, unit: HeightUnit): string {
  if (cm === undefined) return '—'
  if (unit === 'cm') return `${Math.round(cm)} cm`
  const { feet, inches } = cmToFeetInches(cm)
  return `${feet}'${inches}"`
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
