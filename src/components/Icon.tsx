// Inlined Tabler icons (https://tabler.io/icons) — no external icon library.

type IconProps = {
  name: string
  className?: string
}

export default function Icon({ name, className }: IconProps) {
  const common = {
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  }

  if (name === 'lock') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" {...common}>
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6z" />
        <path d="M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" />
        <path d="M8 11v-4a4 4 0 1 1 8 0v4" />
      </svg>
    )
  }

  if (name === 'refresh') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" {...common}>
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" />
        <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
      </svg>
    )
  }

  if (name === 'door-exit') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" {...common}>
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M13 12v.01" />
        <path d="M3 21h18" />
        <path d="M5 21v-16a2 2 0 0 1 2 -2h7.5m2.5 10.5v7.5" />
        <path d="M14 7h7m-3 -3l3 3l-3 3" />
      </svg>
    )
  }

  if (name === 'arrow-up-right') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" {...common}>
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M17 7l-10 10" />
        <path d="M8 7l9 0l0 9" />
      </svg>
    )
  }

  if (name === 'arrow-down-right') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" {...common}>
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M7 7l10 10" />
        <path d="M17 8l0 9l-9 0" />
      </svg>
    )
  }

  return null
}
