import { describe, expect, it } from 'vitest'
import { formatSetTarget, summarizeSetTargets } from '../formatPerformance'
import type { SetTarget } from '../../models/routine'

function set(setNumber: number, patch: Partial<SetTarget> = {}): SetTarget {
  return { id: String(setNumber), setNumber, ...patch }
}

describe('formatSetTarget', () => {
  it('joins every target that is set', () => {
    expect(formatSetTarget(set(1, { targetReps: 10, targetWeightKg: 30 }))).toBe('10 reps × 30 kg')
    expect(formatSetTarget(set(1, { targetDurationSeconds: 600, targetDistanceMeters: 2000 }))).toBe('600s × 2000 m')
  })

  it('appends the side, or is null with no targets', () => {
    expect(formatSetTarget(set(1, { targetReps: 8, side: 'left' }))).toBe('8 reps (Left)')
    expect(formatSetTarget(set(1))).toBeNull()
  })
})

describe('summarizeSetTargets', () => {
  it('collapses consecutive identical sets', () => {
    const sets = [set(1, { targetReps: 10 }), set(2, { targetReps: 10 }), set(3, { targetReps: 8, targetWeightKg: 40 })]
    expect(summarizeSetTargets(sets)).toEqual(['2 sets · 10 reps', '1 set · 8 reps × 40 kg'])
  })

  it('labels sets with no targets', () => {
    expect(summarizeSetTargets([set(1), set(2)])).toEqual(['2 sets · No target'])
  })
})
