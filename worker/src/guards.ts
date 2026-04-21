export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  turnstileToken?: string;
}

export interface GuardConfig {
  maxInputChars: number;
  maxHistoryTurns: number;
}

export type ValidationResult =
  | { ok: true; messages: ChatMessage[] }
  | { ok: false; status: number; error: string };

export function validateBody(raw: unknown, cfg: GuardConfig): ValidationResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, status: 400, error: "Body must be a JSON object." };
  }
  const body = raw as Partial<ChatRequest>;
  if (!Array.isArray(body.messages)) {
    return { ok: false, status: 400, error: "`messages` must be an array." };
  }
  if (body.messages.length === 0) {
    return { ok: false, status: 400, error: "`messages` is empty." };
  }

  const cleaned: ChatMessage[] = [];
  for (const m of body.messages) {
    if (!m || typeof m !== "object") {
      return { ok: false, status: 400, error: "Each message must be an object." };
    }
    const role = (m as ChatMessage).role;
    const content = (m as ChatMessage).content;
    if (role !== "user" && role !== "assistant") {
      return { ok: false, status: 400, error: `Invalid role: ${String(role)}` };
    }
    if (typeof content !== "string") {
      return { ok: false, status: 400, error: "`content` must be a string." };
    }
    const trimmed = content.trim();
    if (trimmed.length === 0) {
      return { ok: false, status: 400, error: "Message content is empty." };
    }
    if (trimmed.length > cfg.maxInputChars) {
      return {
        ok: false,
        status: 413,
        error: `Message exceeds ${cfg.maxInputChars} characters.`,
      };
    }
    cleaned.push({ role, content: trimmed });
  }

  const last = cleaned[cleaned.length - 1];
  if (!last || last.role !== "user") {
    return { ok: false, status: 400, error: "Last message must be from the user." };
  }

  return { ok: true, messages: truncateHistory(cleaned, cfg.maxHistoryTurns) };
}

/** Keep the most recent N turns (user+assistant pairs). The final user message is always kept. */
export function truncateHistory(messages: ChatMessage[], maxTurns: number): ChatMessage[] {
  const maxMessages = Math.max(1, maxTurns * 2);
  if (messages.length <= maxMessages) return messages;
  return messages.slice(messages.length - maxMessages);
}

export function parseIntEnv(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function parseOrigins(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function isOriginAllowed(origin: string | null, allowed: string[]): boolean {
  if (!origin) return false;
  return allowed.some((a) => a === origin || a === "*");
}

export async function verifyTurnstile(
  token: string | undefined,
  secret: string | undefined,
  remoteIp: string | null,
): Promise<{ ok: boolean; reason?: string }> {
  if (!secret) return { ok: true };
  if (!token) return { ok: false, reason: "missing-turnstile-token" };

  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (remoteIp) form.append("remoteip", remoteIp);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });
  if (!res.ok) return { ok: false, reason: `turnstile-http-${res.status}` };
  const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
  if (data.success) return { ok: true };
  return { ok: false, reason: (data["error-codes"] ?? ["turnstile-failed"]).join(",") };
}
