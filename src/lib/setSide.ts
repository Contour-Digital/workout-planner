export type SetSide = 'left' | 'right' | undefined

/** Cycles a set's side tag: untagged -> left -> right -> untagged. Shared between the
 *  routine editor (tagging a plan's sets ahead of time) and the active session (tagging
 *  as you go), so a stretch/single-arm or single-leg exercise's sets read the same way
 *  in both places. */
export function nextSetSide(side: SetSide): SetSide {
  if (side === 'left') return 'right'
  if (side === 'right') return undefined
  return 'left'
}
