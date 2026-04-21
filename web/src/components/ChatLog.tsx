import { useEffect, useRef } from "react";
import type { ChatMessage } from "../lib/api";

interface ChatLogProps {
  messages: ChatMessage[];
  visible: boolean;
  onToggle: () => void;
}

export function ChatLog({ messages, visible, onToggle }: ChatLogProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visible && scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages, visible]);

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        className="pointer-events-auto absolute right-4 top-4 z-10 rounded-lg border border-parchment/20 bg-black/50 px-3 py-1.5 font-display text-xs uppercase tracking-widest text-parchment/70 backdrop-blur-sm transition hover:border-ember hover:text-ember"
        aria-expanded={visible}
      >
        {visible ? "Close log" : "Transcript"}
      </button>

      {visible && (
        <aside
          className="pointer-events-auto absolute right-4 top-16 z-10 flex max-h-[70vh] w-[min(420px,calc(100vw-2rem))] flex-col rounded-xl border border-parchment/20 bg-black/75 shadow-2xl backdrop-blur-md"
          aria-label="Conversation transcript"
        >
          <div ref={scrollerRef} className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <p className="font-serif italic text-parchment/50">
                Nothing said yet. The silence is, as always, complicit.
              </p>
            ) : (
              <ul className="space-y-3">
                {messages.map((m, i) => (
                  <li key={i} className="font-serif leading-snug">
                    <span
                      className={
                        m.role === "user"
                          ? "block text-xs uppercase tracking-widest text-parchment/50"
                          : "block text-xs uppercase tracking-widest text-ember"
                      }
                    >
                      {m.role === "user" ? "You" : "Father Octavian"}
                    </span>
                    <span className="block whitespace-pre-wrap text-parchment/90">
                      {m.content}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      )}
    </>
  );
}
