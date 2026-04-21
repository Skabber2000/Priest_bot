export const WORKER_URL: string =
  (import.meta.env.VITE_WORKER_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:8787";

export const TURNSTILE_SITE_KEY: string | undefined =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) || undefined;

/** Target subtitle display speed in words per minute (natural speech ≈ 150–180). */
export const SUBTITLE_WPM = 180;
