export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface StreamOptions {
  workerUrl: string;
  messages: ChatMessage[];
  turnstileToken?: string;
  signal?: AbortSignal;
}

/** POST /chat to the worker and yield normalized events from its SSE stream. */
export async function* streamPriest(opts: StreamOptions): AsyncGenerator<StreamEvent> {
  const res = await fetch(`${opts.workerUrl}/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify({
      messages: opts.messages,
      turnstileToken: opts.turnstileToken,
    }),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    yield { type: "error", message: `HTTP ${res.status}: ${body.slice(0, 300) || res.statusText}` };
    return;
  }

  for await (const evt of parseSseStream(res.body)) {
    yield evt;
    if (evt.type === "done" || evt.type === "error") return;
  }
}

/** Parse an SSE stream where each event is `data: { ... }`. Exported for testing. */
export async function* parseSseStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<StreamEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by a blank line.
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const rawEvent = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const evt = parseEventLines(rawEvent);
        if (evt) yield evt;
        boundary = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parseEventLines(raw: string): StreamEvent | null {
  let data = "";
  for (const line of raw.split("\n")) {
    if (line.startsWith("data:")) {
      data += line.slice(5).trimStart();
    }
  }
  if (!data) return null;
  try {
    const obj = JSON.parse(data) as {
      delta?: string;
      done?: boolean;
      error?: string;
    };
    if (typeof obj.delta === "string") return { type: "delta", text: obj.delta };
    if (obj.done) return { type: "done" };
    if (typeof obj.error === "string") return { type: "error", message: obj.error };
  } catch {
    // ignore malformed
  }
  return null;
}
