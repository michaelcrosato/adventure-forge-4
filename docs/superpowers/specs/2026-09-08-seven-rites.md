# Seven holds, one rite — and what to do about it

Date: 2026-09-08. Status: proposed. Author: project lead.

## The finding

The content audit traced the realm's most-repeated mechanic. Seven holds rest
their grief by **collecting three tagged tokens from three named sources and
combining them at one spot**:

| hold | the three |
|---|---|
| Hollowbrook | three old verses (causeway, merestone, ringditch) |
| the Kingswood | three notes of the recall (woodward's call, hunt's roll, burners' rhyme) |
| the Meres | the covenant's three words (divers', shrine's, warden's) |
| Mootcombe | three toasts (king's, Church's, guests') |
| Pennywell | three moneyers' names (assayer, tithe-ledger, child's penny) |
| the Shieldings | the truce-words from three sources (roll, count, chantry book) |
| the Hearthlands | three tally-sticks of the crofters' names |

Each is beautifully written and they are the same puzzle. A player who has
done two of them knows the shape of the other five before entering, and
`scripts/audit-shape.ts` shows the rest of the frame is just as uniform:
fifteen holds, fifteen identical `bargain/burn/rest` triples, 43-58 rooms and
6-8 quests apiece, exactly four stamped places in thirteen of the fifteen.

The burn is worse: fourteen of fifteen are *get an incendiary from a faction
npc, apply it with a might check, hollow gone*, and eight of them name the
same substance ("cinder-oil", 59 occurrences).

## The direction

**Do not add a sixteenth hold until the fifteen stop rhyming.** The realm has
the named-place count of Skyrim already; what it lacks is the feeling that a
new hold will ask something new. Vary the verb, not the prose.

Every replacement keeps the three things the design contract requires — a
force route, a craft route and a words route; no class locked out; and an
outcome that lands on exactly one of rested / bargained / burned — and
changes what the player *does*:

| shape | the rite is | what it needs |
|---|---|---|
| **a witness** | the grief needs someone living to hear it: bring a named npc, or a companion, to the site | party mechanics, which exist (`inParty`, `npcHere`) |
| **a trade** | it wants back what was taken from it: give up an item worth keeping | a real cost, felt |
| **a name** | not a collection but a deduction: which of the dead is this? Read the evidence, pick one from a list, and be wrong at a price | content only |
| **an act left undone** | finish the work they died in the middle of — the harvest, the wall, the crossing | content only; better with the clock |
| **a sequence** | the steps of the rite in the right order, and the order is learnable | content only — the realm's first real puzzle |
| **a refusal** | it asks you to agree with it, and resting it means refusing, and enduring what follows | content only |
| **a sacrifice** | it costs the player something permanent — a perk, a companion's regard, a faction's standing | content only |
| **a substitution** | it is answered by another hold's grief being answered — a chain between holds | one flag read across regions |

The burn wants the same treatment: fire is one answer among several. Water,
salt, the sea, a collapse, a flood, a plough, a pardon, a demolition — the
Meres already breaks the mould with dam charges and nothing else does.

## The order of work

Variety is worth less than the reasons to go looking for it, so:

1. **Corridors** — 211 of 905 rooms the player can only walk out of. In hand.
2. **Standing with height** and **the Ironbound march** — the two reasons a
   fourth hold is worth visiting at all. Specs already written.
3. **Then this.** Seven rites, seven shapes, one hold at a time, each with
   its own replay proof, none of them touching another's files.
4. **Then, and only then, a new hold** — and it should be one whose problem is
   not a grief-hollow at all. The best candidate on the table: a hold about to
   *make* a grief rather than carry one — a hanging, an eviction, a burial
   about to be done wrong — where the player's verb is prevent, not settle,
   and failing leaves a hollow that behaves like all the others.

## The bar

Rewriting a hold's rite changes proven content. Every one of these lands with
its hold's walkthrough steps and ending proofs updated in the same change,
`npm run verify` green, and `scripts/audit-choices.ts --prefix <code>` showing
no new forgotten forks. A rite that reads well and replays wrong is not done.
