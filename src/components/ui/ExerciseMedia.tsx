import clsx from 'clsx'
import type { ExerciseMedia } from '../../models/exercise'

/** Renders a real photo/GIF when one exists; otherwise renders nothing (rows are
 *  text-only until proper exercise media is added — see models/exercise.ts). */
export function ExerciseMediaThumb({ media, size = 44, className }: { media: ExerciseMedia; size?: number; className?: string }) {
  if ((media.kind === 'image' || media.kind === 'gif' || media.kind === 'upload') && media.url) {
    return (
      <img
        src={media.url}
        alt=""
        width={size}
        height={size}
        className={clsx('rounded-lg object-cover bg-primary-tint', className)}
      />
    )
  }
  return null
}
