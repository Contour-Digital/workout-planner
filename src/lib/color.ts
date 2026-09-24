/** Converts a #rgb/#rrggbb hex color to an rgba() string at the given alpha.
 *  Falls back to a neutral gray for anything that doesn't parse as hex. */
export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean

  const match = /^[0-9a-f]{6}$/i.exec(full)
  if (!match) return `rgba(138, 138, 138, ${alpha})`

  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
