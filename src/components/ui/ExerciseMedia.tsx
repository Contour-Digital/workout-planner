import clsx from 'clsx'
import type { ExerciseMedia } from '../../models/exercise'

const TOKEN_EMOJI: Record<string, string> = {
  squat: '🏋️',
  deadlift: '🏋️',
  bench: '🏋️',
  press: '🏋️',
  row: '🚣',
  pullup: '🧗',
  pushup: '💪',
  lunge: '🦵',
  plank: '🧘',
  kettlebell: '🔔',
  jump: '🤸',
  run: '🏃',
  bike: '🚴',
  rope: '🪢',
  stretch: '🧘',
  band: '➰',
  roller: '🌀',
  breathing: '🌬️',
  walk: '🚶',
  strength: '🏋️',
  cardio: '🏃',
  mobility: '🧘',
  bodyweight: '💪',
  functional: '🤸',
  recovery: '🌿',
}

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
  const emoji = TOKEN_EMOJI[media.placeholderToken ?? ''] ?? '🏷️'
  return (
    <div
      className={clsx('flex items-center justify-center rounded-lg bg-primary-tint', className)}
      style={{ width: size, height: size, fontSize: size * 0.5 }}
      aria-hidden="true"
    >
      {emoji}
    </div>
  )
}
