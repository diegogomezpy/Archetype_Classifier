export type DisplayMode = 'relative' | 'absolute'

export type Scenario = {
  p: string
  amt: number
  note: string
}

// One side of an allocation round.
export type AllocSide = {
  label: string
  scenarios: Scenario[]
}

export type AllocRound = {
  id: number
  screen: number
  type: 'alloc'
  tag: string
  displayMode: DisplayMode
  q: string
  sub: string
  x: AllocSide
  y: AllocSide
}

export type LiqOption = {
  label: string
  ret: string
  ev: number
  icon: string
  sub: string
}

export type LiqRound = {
  id: number
  screen: number
  type: 'liq'
  tag: string
  q: string
  sub: string
  x: LiqOption
  y: LiqOption
}

export type Round = AllocRound | LiqRound

export type Scores = {
  sigma: number
  alpha: number
  lambda: number
  liq: number
}
