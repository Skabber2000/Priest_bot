import { useEffect, useMemo, useRef, useState } from "react";

const BASE = import.meta.env.BASE_URL;
const TRACKS: readonly string[] = [
  `${BASE}audio/ambient_1.mp3`,
  `${BASE}audio/ambient_2.mp3`,
];
const DEFAULT_VOLUME = 0.35;

/** Fisher–Yates shuffle, non-mutating. */
function shuffle<T>(xs: readonly T[]): T[] {
  const out = xs.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/**
 * Looping ambient soundtrack with a shuffled playlist.
 *
 * On first user gesture (mouse/key/touch) the first randomly-picked track
 * starts; when it ends the next shuffled track plays, and so on. The pool
 * reshuffles whenever the queue runs dry so you rarely hear the same
 * ordering twice in a row.
 *
 * A small toggle in the top-left lets the user mute.
 */
export function AmbientAudio() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [cycle, setCycle] = useState(0);
  const [idx, setIdx] = useState(0);
  const [muted, setMuted] = useState(false);

  const queue = useMemo<string[]>(() => {
    void cycle; // memo depends on cycle so every new cycle gets a fresh shuffle
    return shuffle(TRACKS);
  }, [cycle]);

  const src = queue[idx] ?? queue[0]!;

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = DEFAULT_VOLUME;

    const tryStart = () => {
      el.play().catch(() => {
        // Autoplay blocked; we'll retry on the next user gesture.
      });
    };

    tryStart();
    const onGesture = () => tryStart();
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, [src]);

  useEffect(() => {
    const el = audioRef.current;
    if (el) el.muted = muted;
  }, [muted]);

  const advance = () => {
    setIdx((i) => {
      const next = i + 1;
      if (next >= queue.length) {
        setCycle((c) => c + 1);
        return 0;
      }
      return next;
    });
  };

  return (
    <>
      <audio
        ref={audioRef}
        key={`${cycle}-${idx}`}
        src={src}
        preload="auto"
        onEnded={advance}
      />
      <button
        type="button"
        onClick={() => setMuted((m) => !m)}
        aria-pressed={muted}
        aria-label={muted ? "Unmute ambient music" : "Mute ambient music"}
        title={muted ? "Unmute ambient music" : "Mute ambient music"}
        className="pointer-events-auto absolute left-4 top-4 z-10 rounded-lg border border-parchment/20 bg-black/50 px-3 py-1.5 font-display text-xs uppercase tracking-widest text-parchment/70 backdrop-blur-sm transition hover:border-ember hover:text-ember"
      >
        {muted ? "Music off" : "Music"}
      </button>
    </>
  );
}
