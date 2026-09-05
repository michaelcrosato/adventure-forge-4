import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadWorld, validateWorld } from "../src/validate.ts";

const fixture = (name: string) =>
  loadWorld(fileURLToPath(new URL(`./fixtures/${name}.json`, import.meta.url)));

test("every shipped world validates clean", () => {
  const dir = fileURLToPath(new URL("../world", import.meta.url));
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  assert.ok(files.length >= 2, "expected at least lighthouse and vale");
  for (const f of files) {
    assert.deepEqual(validateWorld(loadWorld(join(dir, f))), [], f);
  }
});

test("rejects unknown room and item references", () => {
  const errs = validateWorld(fixture("bad_ref"));
  assert.ok(errs.some((e) => e.includes("no_such_room")));
  assert.ok(errs.some((e) => e.includes("no_such_item")));
});

test("rejects a world whose walkthrough does not prove a win", () => {
  const errs = validateWorld(fixture("unwinnable"));
  assert.ok(errs.some((e) => e.includes("walkthrough")));
});

test("rejects unknown effect ops (closed DSL)", () => {
  const errs = validateWorld(fixture("bad_fx"));
  assert.ok(errs.some((e) => e.includes("unknown fx op")));
});

test("rejects authored records missing a field the engine prints or dispatches on", () => {
  // JSON is not type-checked; a Vale topic once shipped without `say` and
  // played as `elder: "undefined"`.
  const w = twoEndings({ gave_in: ["give in"] });
  w.npcs = { elder: { name: "elder", room: "a", topics: [{ id: "t", label: "talk" } as never] } };
  w.rooms["a"]!.actions!.push({ id: "mute", fx: [["say", "x"]] } as never);
  w.items = { rock: { name: "rock" } as never };
  const errs = validateWorld(w);
  assert.ok(errs.some((e) => e.includes("npc elder topic t") && e.includes('"say"')), errs.join("\n"));
  assert.ok(errs.some((e) => e.includes("action mute") && e.includes('"label"')), errs.join("\n"));
  assert.ok(errs.some((e) => e.includes("item rock") && e.includes('"loc"')), errs.join("\n"));
});

// ---------- ending proofs ----------
import type { World } from "../src/types.ts";

const twoEndings = (proofs?: World["proofs"]): World => ({
  id: "p",
  title: "P",
  intro: "x",
  start: "a",
  hp: 10,
  maxScore: 5,
  rooms: {
    a: {
      name: "A",
      desc: "A.",
      actions: [
        { id: "win", label: "win", fx: [["score", 5], ["end", "win", "main", "Won."]] },
        { id: "quit", label: "give in", fx: [["end", "lose", "gave_in", "Lost."]] },
      ],
    },
  },
  items: {},
  npcs: {},
  walkthrough: ["win"],
  ...(proofs ? { proofs } : {}),
});

test("an ending without a proof is an error", () => {
  const errs = validateWorld(twoEndings());
  assert.ok(errs.some((e) => e.includes("ending gave_in") && e.includes("no proof")));
});

test("a replaying proof clears the ending", () => {
  assert.deepEqual(validateWorld(twoEndings({ gave_in: ["give in"] })), []);
});

test("a proof that reaches the wrong ending is an error", () => {
  const errs = validateWorld(twoEndings({ gave_in: ["win"] }));
  assert.ok(errs.some((e) => e.includes("proofs.gave_in")));
});

test("a proof for an ending the content cannot reach is an error", () => {
  const errs = validateWorld(twoEndings({ gave_in: ["give in"], ghost: ["win"] }));
  assert.ok(errs.some((e) => e.includes("proofs.ghost")));
});
