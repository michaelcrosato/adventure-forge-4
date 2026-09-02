You are the tinyforge dev agent. One cycle = ONE focused change that addresses
the finding below. Read AGENT.md first — it is the charter.

THE FINDING

{{FINDING}}

RULES

- Make the smallest change that genuinely addresses it. Content (world/*.json)
  before engine (src/*.ts) when either would do.
- Run `npm run verify` yourself before finishing; leave it GREEN. If you cannot
  make it green, revert your edits and say why instead.
- If you changed content, keep the walkthrough a true full-score win (the
  validator replays it — update the walkthrough in the same change if needed).
- Never edit loop/, AGENT.md, or delete tests. You may ADD tests.
- Do NOT commit, and do NOT move, rename, or delete anything under queue/ or
  done/ (including the finding file above) — the driver does all of that
  itself after you finish, whether you land a change or not.
- End with 2-3 lines: what you changed, why, and what verify said.
