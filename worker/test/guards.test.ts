import { describe, it, expect } from "vitest";
import {
  validateBody,
  truncateHistory,
  parseIntEnv,
  parseOrigins,
  isOriginAllowed,
  type ChatMessage,
} from "../src/guards";

const cfg = { maxInputChars: 100, maxHistoryTurns: 5 };

describe("validateBody", () => {
  it("rejects non-object bodies", () => {
    const r = validateBody("oops", cfg);
    expect(r.ok).toBe(false);
  });

  it("rejects empty messages array", () => {
    const r = validateBody({ messages: [] }, cfg);
    expect(r.ok).toBe(false);
  });

  it("rejects when last message is not from user", () => {
    const r = validateBody(
      { messages: [{ role: "assistant", content: "hi" }] },
      cfg,
    );
    expect(r.ok).toBe(false);
  });

  it("rejects invalid role", () => {
    const r = validateBody(
      { messages: [{ role: "system", content: "hi" }] },
      cfg,
    );
    expect(r.ok).toBe(false);
  });

  it("rejects oversize message with 413", () => {
    const big = "x".repeat(cfg.maxInputChars + 1);
    const r = validateBody({ messages: [{ role: "user", content: big }] }, cfg);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(413);
  });

  it("rejects whitespace-only content", () => {
    const r = validateBody({ messages: [{ role: "user", content: "   " }] }, cfg);
    expect(r.ok).toBe(false);
  });

  it("accepts a valid single user turn and trims whitespace", () => {
    const r = validateBody(
      { messages: [{ role: "user", content: "  hello  " }] },
      cfg,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.messages[0]?.content).toBe("hello");
  });

  it("truncates history beyond maxHistoryTurns", () => {
    const msgs: ChatMessage[] = [];
    for (let i = 0; i < 20; i++) {
      msgs.push({ role: i % 2 === 0 ? "user" : "assistant", content: `m${i}` });
    }
    // Ensure last is a user turn
    msgs.push({ role: "user", content: "now" });
    const r = validateBody({ messages: msgs }, cfg);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.messages.length).toBeLessThanOrEqual(cfg.maxHistoryTurns * 2);
      expect(r.messages[r.messages.length - 1]?.content).toBe("now");
    }
  });
});

describe("truncateHistory", () => {
  it("keeps the tail when over the cap", () => {
    const msgs: ChatMessage[] = Array.from({ length: 30 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: String(i),
    }));
    const out = truncateHistory(msgs, 5);
    expect(out.length).toBe(10);
    expect(out[0]?.content).toBe("20");
    expect(out[out.length - 1]?.content).toBe("29");
  });

  it("returns the array unchanged when under the cap", () => {
    const msgs: ChatMessage[] = [
      { role: "user", content: "a" },
      { role: "assistant", content: "b" },
    ];
    expect(truncateHistory(msgs, 5)).toBe(msgs);
  });
});

describe("parseIntEnv", () => {
  it("returns fallback for undefined", () => {
    expect(parseIntEnv(undefined, 42)).toBe(42);
  });
  it("returns fallback for non-numeric", () => {
    expect(parseIntEnv("banana", 7)).toBe(7);
  });
  it("parses valid integer", () => {
    expect(parseIntEnv("123", 0)).toBe(123);
  });
  it("rejects zero and negative", () => {
    expect(parseIntEnv("0", 5)).toBe(5);
    expect(parseIntEnv("-3", 5)).toBe(5);
  });
});

describe("parseOrigins / isOriginAllowed", () => {
  it("parses comma-separated origins and trims whitespace", () => {
    expect(parseOrigins(" a , b, c  ")).toEqual(["a", "b", "c"]);
  });
  it("matches exact origin", () => {
    expect(isOriginAllowed("https://foo.dev", ["https://foo.dev"])).toBe(true);
    expect(isOriginAllowed("https://bar.dev", ["https://foo.dev"])).toBe(false);
  });
  it("accepts wildcard *", () => {
    expect(isOriginAllowed("https://anywhere", ["*"])).toBe(true);
  });
  it("rejects null origin", () => {
    expect(isOriginAllowed(null, ["*"])).toBe(false);
  });
});
