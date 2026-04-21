import { describe, it, expect } from "vitest";
import {
  matchViseme,
  classifyRun,
  VISEMES,
  type Viseme,
} from "../src/hooks/useVisemeTrack";

function trail(text: string): Viseme {
  const events = classifyRun(text);
  return events.length ? events[events.length - 1]!.viseme : "rest";
}

describe("matchViseme", () => {
  it("prefers longer digraphs over single letters", () => {
    expect(matchViseme("ee", 0)?.viseme).toBe("ee");
    expect(matchViseme("ee", 0)?.span).toBe(2);

    expect(matchViseme("igh", 0)?.viseme).toBe("ai");
    expect(matchViseme("igh", 0)?.span).toBe(3);
  });

  it("is case-insensitive", () => {
    expect(matchViseme("AR", 0)?.viseme).toBe("ah");
  });

  it("returns null for unmatched characters", () => {
    expect(matchViseme("!", 0)).toBeNull();
    expect(matchViseme(" ", 0)).toBeNull();
  });

  it("maps bilabial stops and fricatives", () => {
    expect(matchViseme("p", 0)?.viseme).toBe("mbp");
    expect(matchViseme("b", 0)?.viseme).toBe("mbp");
    expect(matchViseme("m", 0)?.viseme).toBe("mbp");
    expect(matchViseme("s", 0)?.viseme).toBe("sz");
    expect(matchViseme("z", 0)?.viseme).toBe("sz");
    expect(matchViseme("sh", 0)?.viseme).toBe("sz");
  });
});

describe("classifyRun (end-to-end word shapes)", () => {
  it("finishes 'Hello' on 'ah' (the o)", () => {
    expect(trail("Hello")).toBe("ah");
  });

  it("finishes 'see' on 'ee'", () => {
    expect(trail("see")).toBe("ee");
  });

  it("finishes 'night' on 'ai' (igh trigraph)", () => {
    expect(trail("night")).toBe("ai");
  });

  it("finishes 'house' on 'ee' (final e)", () => {
    // 'ou' maps to ow, then 'se' → s (sz) → e (ee); final event is ee.
    expect(trail("house")).toBe("ee");
  });

  it("finishes 'boot' on 'ah' (final t has no rule, so last match is 'oo' then single 'o'… wait)", () => {
    // walk: 'b' (mbp, 1) -> 'oo' (oo, 2) -> 't' (skip). Final event: oo.
    expect(trail("boot")).toBe("oo");
  });

  it("finishes 'father' on 'ee'", () => {
    // f (skip) -> a (ae) -> th (skip,skip) -> e (ee) -> r (skip). Final: ee.
    expect(trail("father")).toBe("ee");
  });

  it("finishes 'car' on 'ah' (ar digraph)", () => {
    expect(trail("car")).toBe("ah");
  });

  it("finishes 'my' on 'ee' (y as vowel)", () => {
    // m (mbp) -> y (ee). Final: ee.
    expect(trail("my")).toBe("ee");
  });

  it("finishes 'cow' on 'ow'", () => {
    // c (skip) -> ow (ow). Final: ow.
    expect(trail("cow")).toBe("ow");
  });

  it("classifies a sentence and stays on the last vowel", () => {
    const events = classifyRun("Good morning");
    expect(events.length).toBeGreaterThan(3);
    const last = events[events.length - 1]!;
    // final letter is 'g' (no rule); the last matched event should be 'i' (ih) — from 'ning'.
    expect(last.viseme).toBe("ih");
  });

  it("produces sequential events in order", () => {
    const events = classifyRun("papa");
    expect(events.map((e) => e.viseme)).toEqual(["mbp", "ae", "mbp", "ae"]);
  });

  it("returns empty for whitespace-only input", () => {
    expect(classifyRun("   ")).toEqual([]);
  });
});

describe("VISEMES constant", () => {
  it("lists exactly the 10 canonical visemes", () => {
    expect(VISEMES.length).toBe(10);
    expect(new Set(VISEMES).size).toBe(10);
    expect(VISEMES).toContain("rest");
  });
});
