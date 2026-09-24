import type { ReactNode } from 'react'
import { hexToRgba } from '../../lib/color'

interface CategoryBadgeProps {
  color: string
  icon?: ReactNode
  children: ReactNode
}

/** Like Badge, but colored from an arbitrary user-chosen hex value (calendar
 *  category colors) rather than one of the app's fixed design-system tones. */
export function CategoryBadge({ color, icon, children }: CategoryBadgeProps) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: hexToRgba(color, 0.16), color }}
    >
      {icon}
      {children}
    </span>
  )
}
