# The realm moves without you

Date: 2026-09-08. Status: proposed. Author: project lead.

## The finding

Nothing in the Gray Reach happens unless the player does it. Fifteen holds
hold their grief in stasis for as long as you like; a player settles three
and finds the other twelve exactly as they were left. There is no urgency, no
loss, and no reason to prefer this hold now over that one later — which is
the same reason the realm's breadth does not pay: the proven walkthrough wins
in 255 turns having seen 97 of 905 rooms and six of eighteen regions, and
nothing in the world argues for the seventh.

The content audit put it plainly: *nothing paces or motivates stopping after
three or four holds*, and seven of the nine blind playtesters who ran out of
turns ran out **in the holds**.

## The design

A force in the world that acts on its own, that the player's own choice sets
in motion, and that the player can stop.

### Not a timer — a consequence

The obvious version is a clock that punishes slowness. It is the wrong one:
it punishes the player for the thing the realm is built to reward, and it
would make the covenant road — the proven walkthrough — a race.

The right version: **the Ironbound march begins when you invite it.** Burn
your first hollow, or take the Regent's writ, and the Ironbound learn that
the Reach's griefs can be answered with fire and that the crown will not stop
them. From then on they work down the Reach without you, hold by hold, and
every hold they reach is burned when you get there.

This earns three things at once:

- **A road the Ironbound actually own.** Today every proven route ends deep
  with the Barrow-Keepers and negative with the Ironbound — `reach_burned`
  included, the ending you get by burning the Hollow Throne with their own
  oil, which finishes at `rep_iron -2`. The realm claims six factions and
  proves one. This gives the sixth a shape a player can feel.
- **A cost for a choice, not for a clock.** The covenant player never sees a
  hold burn. The Ironbound player watches the realm burn behind them, and
  that is the bargain they made in the first hold.
- **Reach that pays.** Once the march is moving, which holds you go to, and
  in what order, is the most consequential decision in the game.

### It can be stopped

Never a cutscene. At every step the player has routes, and they are the
game's usual four:

- **Settle the hold first.** The march skips a hold whose grief is at rest.
- **Stop the Preceptor.** He is a person, he is findable, and he can be
  fought, out-argued (`will`), out-ranked (the Watch's commission or the
  Regent's own writ), or bought off (the Companies).
- **Turn the order.** Ironbound standing high enough buys a say in which hold
  is next — the darkest option, and the one that makes the player complicit.
- **Let it burn.** A real choice with a real ending attached.

### What it costs to build

Almost nothing in content, because **the burn is already written**. All
fifteen holds already author `<code>_hollow_burned` and its aftermath: burned
variants, changed npc lines, epilogue. The march does not need new hold
content — it needs to set flags the holds already read. What it needs is two
engine primitives.

## The engine: the realm's own turn

### 1. A turn condition

`["turn", op, n]` — read the turn counter in any `if`, with the same ops as
`var`. Deterministic: `turn` is state. Two lines of engine, one validator
rule, one test.

### 2. `world.clock`

A list of scheduled effects, evaluated once per **spent** turn, after the
player's action and after the world's aggressive pass:

```json
"clock": [
  { "id": "iron_march_warned",
    "if": [["flag", "iron_march"], ["turn", ">=", 40]],
    "once": true,
    "fx": [["say", "Word on the road: an Ironbound column is moving west, and it is not stopping at Cinderhall."]] }
]
```

- `once: true` sets the auto-flag `clocked_<id>`, exactly like `did_<id>`.
- Entries are checked in file order and **at most one fires per turn**. That
  is what keeps this inside the token budget: a turn's clock line is either
  absent or one sentence, never a digest.
- Its `fx` are ordinary effects, so the march can `say`, `set`, `addvar`,
  `npcgo`, `goto` and `if` like anything else. No new effect vocabulary.
- Determinism is untouched: a pure function of state, and any chance goes
  through the existing seeded `chance` op.

The clock is the primitive; the march is one user of it. Others follow for
free: a quest that fails if it is left too long, an npc who gives up waiting,
a season that turns, a bargain that comes due — the last of which four holds
already promise in prose and cannot deliver.

## The bar

Unchanged, and two parts of it need care:

- **The walkthrough.** The covenant road must not trigger the march, and the
  validator will prove it: if the walkthrough's score or ending moves, the
  design is wrong, not the test. `reach_burned`'s proof, on the other hand,
  *should* change — it is the route that invites the march — and its replay
  must be updated in the same change.
- **The budget.** One clock line per turn, and only while a march is running.
  Measure `npm run measure` before and after; the realm sits near 417 chars
  against a ceiling of 450.

New ops need validator coverage and tests in the same change: an unknown key
in a clock entry, a `turn` condition with a bad op, a clock `fx` naming an
unknown flag or room — each a validator error with a test proving the
rejection. And the march needs its own proof: a replay that invites it,
watches a hold burn, stops it at the second, and ends.
