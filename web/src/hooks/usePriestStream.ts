import { useCallback, useRef, useState } from "react";
import { streamPriest, type ChatMessage } from "../lib/api";
import { WORKER_URL } from "../config";

export interface UsePriestStreamResult {
  streaming: boolean;
  error: string | null;
  /** Send `messages` to the worker. `onDelta`/`onDone` fire as events arrive. */
  send: (
    messages: ChatMessage[],
    handlers: {
      onDelta: (delta: string) => void;
      onDone: () => void;
      turnstileToken?: string;
    },
  ) => Promise<void>;
  /** Abort any in-flight request. */
  cancel: () => void;
}

export function usePriestStream(): UsePriestStreamResult {
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    ctrlRef.current?.abort();
    ctrlRef.current = null;
    setStreaming(false);
  }, []);

  const send = useCallback<UsePriestStreamResult["send"]>(
    async (messages, { onDelta, onDone, turnstileToken }) => {
      cancel();
      setError(null);
      setStreaming(true);

      const ctrl = new AbortController();
      ctrlRef.current = ctrl;

      try {
        for await (const evt of streamPriest({
          workerUrl: WORKER_URL,
          messages,
          turnstileToken,
          signal: ctrl.signal,
        })) {
          if (evt.type === "delta") onDelta(evt.text);
          else if (evt.type === "error") {
            setError(evt.message);
            break;
          } else if (evt.type === "done") {
            break;
          }
        }
        onDone();
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message);
        }
      } finally {
        if (ctrlRef.current === ctrl) ctrlRef.current = null;
        setStreaming(false);
      }
    },
    [cancel],
  );

  return { streaming, error, send, cancel };
}
