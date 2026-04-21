import { PRIEST_SYSTEM_PROMPT } from "./prompt";
import {
  validateBody,
  parseIntEnv,
  parseOrigins,
  isOriginAllowed,
  verifyTurnstile,
} from "./guards";
import { streamAnthropic, transformAnthropicStream, errorSseResponse } from "./anthropic";

export interface Env {
  ANTHROPIC_API_KEY: string;
  TURNSTILE_SECRET?: string;
  ALLOWED_ORIGINS: string;
  MODEL: string;
  MAX_OUTPUT_TOKENS?: string;
  MAX_INPUT_CHARS?: string;
  MAX_HISTORY_TURNS?: string;
}

function corsHeadersFor(origin: string | null, allowed: string[]): Record<string, string> {
  const headers: Record<string, string> = {
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "origin",
  };
  if (origin && isOriginAllowed(origin, allowed)) {
    headers["access-control-allow-origin"] = origin;
  }
  return headers;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("origin");
    const allowed = parseOrigins(env.ALLOWED_ORIGINS);
    const cors = corsHeadersFor(origin, allowed);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === "/" && request.method === "GET") {
      return new Response("Priest Worker online. POST /chat for subtitles.\n", {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8", ...cors },
      });
    }

    if (url.pathname !== "/chat") {
      return new Response("Not found.", { status: 404, headers: cors });
    }
    if (request.method !== "POST") {
      return new Response("Method not allowed.", { status: 405, headers: cors });
    }
    if (!isOriginAllowed(origin, allowed)) {
      return new Response("Origin not allowed.", { status: 403, headers: cors });
    }
    if (!env.ANTHROPIC_API_KEY) {
      return errorSseResponse("Server misconfigured: missing ANTHROPIC_API_KEY.", 500, cors);
    }

    let parsed: unknown;
    try {
      parsed = await request.json();
    } catch {
      return errorSseResponse("Invalid JSON body.", 400, cors);
    }

    const validation = validateBody(parsed, {
      maxInputChars: parseIntEnv(env.MAX_INPUT_CHARS, 2000),
      maxHistoryTurns: parseIntEnv(env.MAX_HISTORY_TURNS, 20),
    });
    if (!validation.ok) {
      return errorSseResponse(validation.error, validation.status, cors);
    }

    const turnstileToken = (parsed as { turnstileToken?: string }).turnstileToken;
    const remoteIp = request.headers.get("cf-connecting-ip");
    const ts = await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET, remoteIp);
    if (!ts.ok) {
      return errorSseResponse(`Turnstile check failed: ${ts.reason ?? "unknown"}`, 403, cors);
    }

    let upstream: Response;
    try {
      upstream = await streamAnthropic({
        apiKey: env.ANTHROPIC_API_KEY,
        model: env.MODEL || "claude-sonnet-4-6",
        system: PRIEST_SYSTEM_PROMPT,
        messages: validation.messages,
        maxTokens: parseIntEnv(env.MAX_OUTPUT_TOKENS, 1024),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "upstream error";
      return errorSseResponse(msg, 502, cors);
    }

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      return errorSseResponse(
        `Anthropic upstream error ${upstream.status}: ${detail.slice(0, 300)}`,
        502,
        cors,
      );
    }

    const clientStream = transformAnthropicStream(upstream.body);

    return new Response(clientStream, {
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
        ...cors,
      },
    });
  },
};
