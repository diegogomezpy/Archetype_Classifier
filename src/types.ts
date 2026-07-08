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
  // The dollar EV advantage of side X (Growth) over side Y (Anchor): positive
  // when Growth is the richer side, negative when Anchor is. This is the single
  // source of truth for the EV-discipline (ev) axis — each round's ev signal is
  // weighted by its gap, so bigger-gap rounds count more (see applyScore).
  evGap: number
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
