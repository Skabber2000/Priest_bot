import { describe, it, expect } from "vitest";
import { Pacer } from "../src/hooks/useSubtitlePacer";

describe("Pacer", () => {
  it("reveals characters at the target rate", () => {
    const p = new Pacer("hello world", 10); // 10 chars/sec
    expect(p.tickSeconds(0.5)).toBe("hello"); // 0.5s * 10 = 5 chars
    expect(p.tickSeconds(0.5)).toBe("hello worl"); // next 5 chars
    expect(p.tickSeconds(1)).toBe("hello world"); // target saturates
  });

  it("does not overshoot the target buffer", () => {
    const p = new Pacer("hi", 100);
    expect(p.tickSeconds(10)).toBe("hi");
  });

  it("accumulates fractional progress across ticks", () => {
    const p = new Pacer("abcdefghij", 10);
    // Ten ticks of 0.1s each should reveal one char each on average.
    let last = "";
    for (let i = 0; i < 10; i++) last = p.tickSeconds(0.1);
    expect(last).toBe("abcdefghij");
  });

  it("treats caughtUp as finished + shown >= target", () => {
    const p = new Pacer("x", 1000);
    expect(p.caughtUp).toBe(false);
    p.tickSeconds(1);
    expect(p.caughtUp).toBe(false); // not finished yet
    p.finish();
    expect(p.caughtUp).toBe(true);
  });

  it("appends to target without losing already-shown text", () => {
    const p = new Pacer("hello", 100);
    p.tickSeconds(1); // reveals all of "hello"
    p.append(" world");
    p.tickSeconds(1);
    expect(p.tickSeconds(0)).toBe("hello world");
  });
});
