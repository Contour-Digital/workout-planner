import { describe, expect, it } from 'vitest'
import { computeCurrentRound, computeRoundCount, roundFinishesWith, type RoundEntryLike } from '../finisherRound'

function entry(id: string, completedFlags: boolean[]): RoundEntryLike {
  return { id, actualSets: completedFlags.map((completed) => ({ completed })) }
}

describe('computeRoundCount', () => {
  it('is zero for fewer than 2 entries', () => {
    expect(computeRoundCount([entry('a', [false, false])])).toBe(0)
    expect(computeRoundCount([])).toBe(0)
  })

  it('is the shortest entry\'s set count', () => {
    const entries = [entry('a', [false, false, false]), entry('b', [false, false])]
    expect(computeRoundCount(entries)).toBe(2)
  })
})

describe('computeCurrentRound', () => {
  it('is 0 when no sets are completed yet', () => {
    const entries = [entry('a', [false, false]), entry('b', [false, false])]
    expect(computeCurrentRound(entries, 2)).toBe(0)
  })

  it('advances only once every entry has completed that round\'s set', () => {
    const entries = [entry('a', [true, false]), entry('b', [false, false])]
    // a finished round 0 but b hasn't — the group is still on round 0.
    expect(computeCurrentRound(entries, 2)).toBe(0)
  })

  it('moves to round 1 once every entry has finished round 0', () => {
    const entries = [entry('a', [true, false]), entry('b', [true, false])]
    expect(computeCurrentRound(entries, 2)).toBe(1)
  })

  it('equals roundCount once every round is done', () => {
    const entries = [entry('a', [true, true]), entry('b', [true, true])]
    expect(computeCurrentRound(entries, 2)).toBe(2)
  })

  it('is 0 when roundCount is 0', () => {
    expect(computeCurrentRound([], 0)).toBe(0)
  })
})

describe('roundFinishesWith', () => {
  it('is true when the completing entry is the last one needed for the round', () => {
    const entries = [entry('a', [true, false]), entry('b', [false, false])]
    // b is about to complete round 0, and a already has — this finishes round 0.
    expect(roundFinishesWith(entries, 'b', 0)).toBe(true)
  })

  it('is false when another entry still hasn\'t done this round\'s set', () => {
    const entries = [entry('a', [false, false]), entry('b', [false, false])]
    expect(roundFinishesWith(entries, 'b', 0)).toBe(false)
  })
})
