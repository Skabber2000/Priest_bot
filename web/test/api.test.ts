import { describe, it, expect } from "vitest";
import { parseSseStream, type StreamEvent } from "../src/lib/api";

function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
}

async function collect(
  stream: ReadableStream<Uint8Array>,
): Promise<StreamEvent[]> {
  const out: StreamEvent[] = [];
  for await (const evt of parseSseStream(stream)) out.push(evt);
  return out;
}

describe("parseSseStream", () => {
  it("parses delta / done events", async () => {
    const events = await collect(
      makeStream([
        `data: {"delta":"Peace "}\n\n`,
        `data: {"delta":"be with you."}\n\n`,
        `data: {"done":true}\n\n`,
      ]),
    );
    expect(events).toEqual([
      { type: "delta", text: "Peace " },
      { type: "delta", text: "be with you." },
      { type: "done" },
    ]);
  });

  it("surfaces error events", async () => {
    const events = await collect(makeStream([`data: {"error":"overloaded"}\n\n`]));
    expect(events).toEqual([{ type: "error", message: "overloaded" }]);
  });

  it("tolerates chunk boundaries mid-event", async () => {
    const events = await collect(
      makeStream([`data: {"delta":"hel`, `lo"}\n\n`, `data: {"done":true}\n\n`]),
    );
    expect(events).toEqual([
      { type: "delta", text: "hello" },
      { type: "done" },
    ]);
  });

  it("ignores malformed JSON without throwing", async () => {
    const events = await collect(
      makeStream([`data: not-json\n\n`, `data: {"delta":"ok"}\n\n`]),
    );
    expect(events).toEqual([{ type: "delta", text: "ok" }]);
  });

  it("joins multi-line data fields", async () => {
    const events = await collect(
      makeStream([`data: {"delta":\ndata: "joined"}\n\n`]),
    );
    expect(events).toEqual([{ type: "delta", text: "joined" }]);
  });
});
