import type { WeightUnit, HeightUnit } from './units'

export interface Profile {
  id: 'singleton'
  name: string
  dob?: string // ISO date
  weightUnit: WeightUnit
  heightUnit: HeightUnit
  updatedAt: string
}

export interface WeightEntry {
  id: string
  valueKg: number
  recordedAt: string
}

export interface HeightEntry {
  id: string
  valueCm: number
  recordedAt: string
}

export function calculateAge(dob: string, asOf: Date = new Date()): number {
  const birth = new Date(dob)
  let age = asOf.getFullYear() - birth.getFullYear()
  const m = asOf.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && asOf.getDate() < birth.getDate())) age--
  return age
}
