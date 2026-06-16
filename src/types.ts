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
  // EV-matched rounds (both sides average $10,500) measure pure payoff shape.
  // EV-mismatched rounds (`evGap` set) have one richer side; choosing it
  // signals EV-discipline (the Optimizer axis). `evGap` is the dollar EV
  // advantage of side X over side Y (negative if Y is the richer side).
  evGap?: number
  q: string
  sub: string
  x: AllocSide
  y: AllocSide
}

export type Round = AllocRound

export type Scores = {
  sigma: number
  alpha: number
  lambda: number
  ev: number
}
