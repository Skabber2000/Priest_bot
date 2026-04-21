import { useEffect, useRef } from "react";

interface SubtitleBarProps {
  text: string;
  streaming: boolean;
}

export function SubtitleBar({ text, streaming }: SubtitleBarProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Keep the latest streamed word in view as text grows past 3 lines.
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [text, streaming]);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-28 flex justify-center px-6 sm:bottom-32">
      <div
        ref={scrollerRef}
        className="subtitle-scroll pointer-events-auto max-h-[4.125em] max-w-3xl overflow-y-auto text-[1.5rem] sm:text-[1.875rem] md:text-[2.35rem]"
      >
        <p
          className="subtitle-line text-balance text-center font-serif leading-snug text-parchment"
          aria-live="polite"
          aria-atomic="false"
        >
          {text}
          {streaming && <span className="caret" aria-hidden="true" />}
        </p>
      </div>
    </div>
  );
}
