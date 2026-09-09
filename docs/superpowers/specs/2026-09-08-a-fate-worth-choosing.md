# Two of every hold's three fates are pure loss

Date: 2026-09-08. Status: proposed. Author: project lead.

## The finding

```bash
npx tsx scripts/audit-fates.ts world/reach.json
```

Every hold can be laid to rest, bargained with, or burned. Three fates,
authored three times over, fifteen holds — thirty routes behind the two that
are not "rest". Three blind players then ran the realm end to end and chose
**rest 24 times out of 24**. Not one bargain, not one burn.

The tool says why without needing an argument:

| | score | standing | companions | an ending that reads it |
|---|---|---|---|---|
| rest | **+25** | keepers +2, often church +2 | the only approvals | `reach_at_rest` wants three rested |
| bargain | +20 | mixed, often −2 somewhere | one small approval at best | none |
| burn | +15 | iron +2, church −2 | disapproval in every hold | none |

The score ordering is identical in **all fifteen holds**. And only one of the
six endings reads a hold's fate at all — not even `reach_burned`, whose gate
is cinder oil in your hand rather than a burned realm.

So two thirds of every hold's climax is strictly dominated on every axis a
player can see, and the odds line tells them so before they choose. Nobody
misjudged anything. Three careful players read it correctly and took the best
option twenty-four times, and thirty authored routes have never been walked.

This is the largest gap between the game and its stated ambition. BG3's
choices cost you something you wanted; these cost you ten score and your
friends' regard in exchange for nothing.

## What a fate must be

A fate is a choice only if a player who wants something the realm offers can
reach it *only* this way. That gives three tests, and a fix has to pass all
three:

1. **No fate out-pays another in the same currency.** Score stops ranking
   them. This is necessary and nowhere near sufficient.
2. **Each fate pays in a currency the others cannot.** Not "less of the same".
3. **Something the realm wants reads each fate.** An ending, a rank, a road
   opened. A payoff nobody's plan runs through is decoration.

## The change

### Half A — score stops ranking the fates

All three fates score **+25**. Thirty edits, mechanical, and it must land in
one commit across all fifteen holds: half a realm ranked and half not is
worse than either.

The bar is unaffected and this must be verified rather than assumed: the
walkthrough rests everything, so its total stays 366 and
`walkthrough: score === maxScore` still holds. `scripts/budget.ts --terse`
should be byte-identical. Score is no longer clamped, so a bargaining player
now *also* reaches a full route's worth, which is the point.

### Half B — each fate becomes a road

**Rest** keeps what it has: the Keepers' and the Church's regard, the
companions' approval, and `reach_at_rest`'s three-rested gate. Nothing to do.

**Burn** is furthest along and is in flight. `reach_burned` should be earned
by burning the realm — `hollows_burned >= N` — with the oil still needed as
the *means* at the throne. That ending has never been proven by a route that
actually burns anything, and capturing that proof is most of the work.

**Bargain** has no road at all and needs one. The shape the fiction already
supports: the holds still owe, the griefs still walk, and the living kept
their bargains — a realm that chose to live with its dead rather than lay
them down or burn them out. That is a seventh ending. `hollows_bargained`
does not exist yet as a var (`hollows_rested`'s own label says "a bargain
counts", which is part of how bargaining ended up invisible: it feeds the
*resting* tally). Give bargaining its own count, and its own seat.

**The ranks are the other lever, and they are already built.** Burning
should build toward `iron_sworn`, bargaining toward `free_` or `crown_`.
Every tier payoff is wired across all sixteen regions and the wave collected
two ranks in three runs; a fate that is the fastest road to a rank is a fate
with a reason.

## What not to do

- Do not raise burn's score to +25 and stop. That passes test 1 and fails 2
  and 3, and the tool will still print `RANKED` for a realm where nothing
  reads a burned hold.
- Do not make resting worse. It is the good ending and it should feel like
  one; the problem is that the others feel like mistakes.
- Do not lower burn's standing cost. Burning a hold's dead *should* cost you
  the Church and your companions. That cost is the choice. What is missing is
  the other side of it.

## How the fix is checked

- `npx tsx scripts/audit-fates.ts world/reach.json --terse` prints no
  `RANKED` line, and its verdict counts 0 of 15.
- A new test asserts no hold's fates are strictly score-ranked, so the next
  hold is held to it without anyone remembering.
- `reach_burned` and a bargained ending each carry a `proofs` entry whose
  route actually burns and actually bargains.
- The next blind wave. If players still rest everything, half B did not go far
  enough, and the wave replay says so in one number: rests, bargains and burns
  per run.
