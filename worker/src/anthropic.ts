import type { ChatMessage } from "./guards";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export interface AnthropicCallOptions {
  apiKey: string;
  model: string;
  system: string;
  messages: ChatMessage[];
  maxTokens: number;
  signal?: AbortSignal;
}

/** POST to Anthropic with stream:true. Returns the upstream Response (SSE stream). */
export async function streamAnthropic(opts: AnthropicCallOptions): Promise<Response> {
  return fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": opts.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      system: opts.system,
      messages: opts.messages,
      max_tokens: opts.maxTokens,
      stream: true,
    }),
    signal: opts.signal,
  });
}

/**
 * Transform Anthropic's SSE event stream into a simpler client-facing SSE stream
 * where every event is `data: {"delta":"..."}`, `data: {"done":true}`, or
 * `data: {"error":"..."}`.
 */
export function transformAnthropicStream(upstream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return upstream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          let evt: {
            type?: string;
            delta?: { type?: string; text?: string };
            error?: { message?: string };
          };
          try {
            evt = JSON.parse(payload);
          } catch {
            continue;
          }
          if (
            evt.type === "content_block_delta" &&
            evt.delta?.type === "text_delta" &&
            typeof evt.delta.text === "string"
          ) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ delta: evt.delta.text })}\n\n`),
            );
          } else if (evt.type === "message_stop") {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          } else if (evt.type === "error") {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ error: evt.error?.message ?? "stream error" })}\n\n`,
              ),
            );
          }
        }
      },
      flush(controller) {
        if (buffer.trim().length > 0) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        }
      },
    }),
  );
}

export function errorSseResponse(message: string, status: number, corsHeaders: HeadersInit): Response {
  const body = `data: ${JSON.stringify({ error: message })}\n\n`;
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      ...corsHeaders,
    },
  });
}
