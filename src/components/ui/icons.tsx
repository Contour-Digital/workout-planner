import type { SVGProps } from 'react'

function Svg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  )
}

export const IconDashboard = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M3 12l9-9 9 9" />
    <path d="M5 10v10h14V10" />
  </Svg>
)
export const IconDumbbell = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M6 6v12M18 6v12M3 9h3M18 9h3M3 15h3M18 15h3M6 12h12" />
  </Svg>
)
export const IconHistory = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
    <path d="M12 7v5l4 2" />
  </Svg>
)
export const IconUser = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1.5-4.5 5-6 8-6s6.5 1.5 8 6" />
  </Svg>
)
export const IconPlus = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)
export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Svg>
)
export const IconChevronRight = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M9 18l6-6-6-6" />
  </Svg>
)
export const IconChevronLeft = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M15 18l-6-6 6-6" />
  </Svg>
)
export const IconChevronDown = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
)
export const IconFlame = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M12 2c1 3-3 4-3 8a3 3 0 0 0 6 0c1 1 2 2.5 2 4.5A5.5 5.5 0 0 1 6.5 14C6.5 9 9 6 12 2Z" />
  </Svg>
)
export const IconClock = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </Svg>
)
export const IconMoon = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M21 12.5A8.5 8.5 0 1 1 11.5 3 7 7 0 0 0 21 12.5Z" />
  </Svg>
)
export const IconLeaf = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M5 21c8-1 13-6 14-14-8 1-13 6-14 14Z" />
    <path d="M5 21c0-4 2-8 5-10" />
  </Svg>
)
export const IconTrash = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
  </Svg>
)
export const IconEdit = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </Svg>
)
export const IconCopy = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
  </Svg>
)
export const IconArchive = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="4" rx="1" />
    <path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" />
    <path d="M10 12h4" />
  </Svg>
)
export const IconPlay = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M6 4l14 8-14 8V4Z" />
  </Svg>
)
export const IconPause = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M7 4h3v16H7zM14 4h3v16h-3z" />
  </Svg>
)
export const IconSearch = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </Svg>
)
export const IconX = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Svg>
)
export const IconGrip = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <circle cx="9" cy="6" r="1.2" fill="currentColor" />
    <circle cx="15" cy="6" r="1.2" fill="currentColor" />
    <circle cx="9" cy="12" r="1.2" fill="currentColor" />
    <circle cx="15" cy="12" r="1.2" fill="currentColor" />
    <circle cx="9" cy="18" r="1.2" fill="currentColor" />
    <circle cx="15" cy="18" r="1.2" fill="currentColor" />
  </Svg>
)
export const IconCalendar = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Svg>
)
export const IconSparkle = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M12 3c0 3.5 1.5 5 5 5-3.5 0-5 1.5-5 5 0-3.5-1.5-5-5-5 3.5 0 5-1.5 5-5Z" />
    <path d="M19 15c0 1.5.7 2.2 2.2 2.2C19.7 17.2 19 17.9 19 19.4c0-1.5-.7-2.2-2.2-2.2 1.5 0 2.2-.7 2.2-2.2Z" />
  </Svg>
)
