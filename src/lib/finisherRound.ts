/** Minimal shape the round math needs — matches SessionExerciseEntry without importing
 *  the full model, so these stay easy to unit test with plain fixtures. */
export interface RoundEntryLike {
  id: string
  actualSets: { completed: boolean }[]
}

/** How many rounds a group of 2+ round-tagged exercises runs for — the shortest one's
 *  set count, since every round needs a set from every exercise in it. Fewer than 2
 *  entries isn't a round at all. */
export function computeRoundCount(entries: RoundEntryLike[]): number {
  if (entries.length < 2) return 0
  return Math.min(...entries.map((e) => e.actualSets.length))
}

/** The earliest round where any entry still has that round's set incomplete — the
 *  group hasn't collectively moved past it yet, however each entry's own sets were
 *  actually completed in. Equals `roundCount` once every round is done. */
export function computeCurrentRound(entries: RoundEntryLike[], roundCount: number): number {
  if (roundCount === 0) return 0
  return Math.min(
    ...entries.map((e) => {
      const idx = e.actualSets.findIndex((s, i) => i < roundCount && !s.completed)
      return idx === -1 ? roundCount : idx
    }),
  )
}

/** Whether `completingEntryId` finishing its set for `currentRound` completes that
 *  round for the whole group — true only once every other entry already has. Used to
 *  gate the rest timer so it fires once per round, not once per exercise within it. */
export function roundFinishesWith(entries: RoundEntryLike[], completingEntryId: string, currentRound: number): boolean {
  return entries.every((e) => e.id === completingEntryId || e.actualSets[currentRound]?.completed)
}
