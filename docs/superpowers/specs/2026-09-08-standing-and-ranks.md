# Standing that keeps mattering — factions with height

Date: 2026-09-08. Status: proposed. Author: project lead.

## The finding

`node --import tsx scripts/audit-choices.ts world/reach.json` now prints, per
standing and tally, how far the world can move it against the highest value
anything ever asks it to reach. On the Gray Reach:

```
  var               moves  +total  reads  highest read  verdict
  rep_keepers         240    +203      3  >=2           inert above +2
  rep_church          260    +171      7  >=2           inert above +2
  rep_watch           235    +169     17  >=2           inert above +2
  rep_free            210    +160     25  >=2           inert above +2
  rep_iron            124     +93      4  >=2           inert above +2
  rep_crown           134     +78      4  >=3           inert above +3
```

About twelve hundred places in the world move a faction's standing. Six
thresholds read it. Every faction has exactly two states in `statusPaths` —
`>= 2` and `<= -2` — so a player who has done fourteen things for the
Barrow-Keepers reads the same line as one who has done two, and meets the
same doors.

This is the realm's largest unkept promise. The world announces a
consequence every few turns ("the Barrow-Keepers approve (+1)") and then
declines to have one. It is also, not by coincidence, why there is no reason
to visit a fourth hold: the proven walkthrough wins in 255 turns having seen
97 of 905 rooms and six of eighteen regions, with the score already at its
cap.

## The design

Standing gets **height**, and every step of it does something the player can
feel. Reaching the top of one takes deeds in several different holds — which
is the missing reason to travel — and costs standing with the faction whose
aims cross it, so it is a choice and not an accumulation.

### Five states, not two

| state | threshold | what it is |
|---|---|---|
| hunted | `<= -5` | they act against you: a door shut, a price on you, a scene that comes to find you |
| marked | `<= -2` | today's negative state — they remember |
| unknown | — | the fallback |
| known | `>= 2` | today's positive state — doors open |
| trusted | `>= 5` | a standing gift you carry: something that changes how the rest of the realm plays |
| sworn | `>= 9` | a rank with a name, a route no one else has, and a line in the epilogue |

Standing moves +1 a deed and +2 a hollow, so `known` is one hold's work,
`trusted` about two, and `sworn` three or four.

**Calibrated** (2026-09-08) by replaying every proven route and reading each
`rep_*` off the final state:

| route | watch | church | iron | free | keepers | crown |
|---|---|---|---|---|---|---|
| walkthrough (`reach_at_rest`) | -1 | 5 | -3 | 3 | **14** | -1 |
| `hollow_reach` | -1 | 5 | -3 | 3 | **14** | -1 |
| `regent_deposed` | -1 | 5 | -3 | 3 | **13** | -1 |
| `reach_burned` | -1 | 4 | -2 | 3 | **13** | 0 |
| `gray_crown` | -1 | 0 | -3 | 3 | **10** | 1 |

The thresholds land where the design wants them: a route's favoured faction
reaches +10 to +14 (`sworn` at +9, with room over it), a second reaches +5
(`trusted` exactly), and the rest sit at `known` or below. A player ends
sworn to one, trusted to a second, and nothing much to the other four —
which is the shape the design is for. No renumbering needed.

**A second finding fell out of the calibration, and it is a real one.** All
five proven routes are the same faction road. Every one of them ends deep
with the Barrow-Keepers (+10 to +14) and negative with the Ironbound —
including `reach_burned`, the ending earned by burning the Hollow Throne
with the Ironbound's own oil, which finishes at **iron -2**. The realm
claims six factions and proves one. Before the tiers are written, the
Ironbound and the Crown need a road of their own that a proof replays, or
their tiers will ship untested and unreachable in practice. Treat that as
the work that comes first.

### What each tier gives

Every payoff below is expressible in the DSL as it stands — a flag the
granting scene sets, read wherever it matters. No engine change is expected;
prove that before writing any.

| faction | home | trusted (+5) | sworn (+9) |
|---|---|---|---|
| the Watch | Highward (`wm`) | **the Watch's road** — an escort at any gateway: wilderness encounters stand down while it holds | **Serjeant of the Reach** — the Watch will take the Regent without the Companies; a Watch hand at the finale |
| the Gray Church | the Priory (`fd`) | **the Prior's blessing** — a rite that opens a barrow door once in any hold | **the Bell of the Reach** — the Church's voice speaks with yours: a hollow rests on two of its three tokens |
| the Ironbound | Cinderhall (`ir`) | **a standing draught** — cinder-oil on demand, without finding the hold's own | **the Preceptor's oath** — a chapter marches: they burn a named hollow while you are elsewhere, and the hold is changed when you get there |
| the Free Companies | Camp Gallows (`th`), Gullhaven (`sk`) | **free passage** — toll camps stand down and the smugglers' road opens unpaid | **a company at your back** — hired steel at the Hollow Throne |
| the Barrow-Keepers | Keepers' Hall (`hb`) | **the Key that fits every door** — the Keeper's Key stops being one barrow's | **Keeper of the Covenant** — the Great Rite is yours to speak, wherever it is needed |
| the Crown | Marrowgate (`mg`) | **the Regent's ear** — a title, coin, and a Crown escort on the roads | **the Regent's hand** — the palace opens to you openly, and the Reach remembers whose hand you were |

### The cross-pressure

A tier granted lowers the standing of the faction whose aims it crosses, at
the moment it is granted, said plainly in the menu before it is taken:

- Ironbound `sworn` costs the Keepers and the Church.
- Keepers or Church `sworn` costs the Ironbound.
- Crown `sworn` costs the Free Companies.
- Watch `trusted` costs the Free Companies a point, and the reverse.

So a player may end sworn to one faction and known to two, never sworn to
all. The epilogue reads back what they became.

### Where it lives

- `world/reach.json` root: the new `statusPaths` states, and the epilogue
  lines that say what you became. **The project lead edits the root** — region
  authors must not, or the merges collide.
- Each faction's home region: the scene that grants the tier, walkable once
  the standing is there, refused plainly when it is not.
- Every region: nothing required, but a hold that wants to read
  `["flag", "keepers_sworn"]` in a variant or a topic should.

### Splitting the work

Three authors, disjoint files:

- **A** — the Watch (`wm_*`) and the Ironbound (`ir_*`)
- **B** — the Gray Church (`fd_*`) and the Barrow-Keepers (`hb_*`)
- **C** — the Free Companies (`th_*`, `sk_*`) and the Crown (`mg_*`)

### The bar

Unchanged: `npm run verify` green, the walkthrough still a full-score win,
every ending still proof-replayed, the token budget and the menu cap held.
A tier that cannot be reached is worse than no tier — each granting scene
needs a proof that a plausible route reaches it, and the audit above must
show the new thresholds being read.
