import { describe, it, expect } from "vitest";
import { transformAnthropicStream } from "../src/anthropic";

function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
}

async function drain(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out + decoder.decode();
}

describe("transformAnthropicStream", () => {
  it("forwards content_block_delta events as simplified SSE", async () => {
    const sse = [
      `event: content_block_delta\ndata: ${JSON.stringify({
        type: "content_block_delta",
        delta: { type: "text_delta", text: "Bless " },
      })}\n\n`,
      `event: content_block_delta\ndata: ${JSON.stringify({
        type: "content_block_delta",
        delta: { type: "text_delta", text: "you." },
      })}\n\n`,
      `event: message_stop\ndata: ${JSON.stringify({ type: "message_stop" })}\n\n`,
    ];
    const out = await drain(transformAnthropicStream(makeStream(sse)));
    expect(out).toContain(`data: {"delta":"Bless "}`);
    expect(out).toContain(`data: {"delta":"you."}`);
    expect(out).toContain(`data: {"done":true}`);
  });

  it("forwards errors", async () => {
    const sse = [
      `event: error\ndata: ${JSON.stringify({
        type: "error",
        error: { message: "overloaded" },
      })}\n\n`,
    ];
    const out = await drain(transformAnthropicStream(makeStream(sse)));
    expect(out).toContain(`data: {"error":"overloaded"}`);
  });

  it("handles chunks that split mid-event", async () => {
    const payload = JSON.stringify({
      type: "content_block_delta",
      delta: { type: "text_delta", text: "amen" },
    });
    const full = `event: content_block_delta\ndata: ${payload}\n\n`;
    const split = [full.slice(0, 20), full.slice(20)];
    const out = await drain(transformAnthropicStream(makeStream(split)));
    expect(out).toContain(`data: {"delta":"amen"}`);
  });

  it("ignores non-text deltas and malformed json", async () => {
    const sse = [
      `data: not json\n\n`,
      `event: content_block_start\ndata: ${JSON.stringify({
        type: "content_block_start",
      })}\n\n`,
    ];
    const out = await drain(transformAnthropicStream(makeStream(sse)));
    expect(out).toBe("");
  });
});
