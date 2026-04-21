import { useEffect, useMemo, useState } from "react";

const BASE = import.meta.env.BASE_URL;
const CLIP_MS = 6040; // every Grok clip is 6.04 s at 24 fps
const HOLD_MS = 1000; // hold on the last frame before fading out
const FADE_MS = 500;
const SEGMENT_MS = CLIP_MS + HOLD_MS + FADE_MS;

const IDLE_SRCS: readonly string[] = [
  `${BASE}videos/idle_1.mp4`,
  `${BASE}videos/idle_2.mp4`,
  `${BASE}videos/idle_3.mp4`,
  `${BASE}videos/idle_4.mp4`,
  `${BASE}videos/idle_5.mp4`,
  `${BASE}videos/idle_6.mp4`,
  `${BASE}videos/idle_7.mp4`,
  `${BASE}videos/idle_8.mp4`,
  `${BASE}videos/idle_9.mp4`,
];

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
 * Cinematographic avatar — plays every idle clip in a random order, then
 * re-shuffles and plays them all again.
 *
 * Timing per segment:
 *   0      – CLIP_MS        video plays (natural-ending at 6.04 s)
 *   CLIP   – +HOLD_MS        hold on last frame (1 s)
 *   HOLD   – +FADE_MS        fade out (0.5 s)
 *   FADE   – next segment fades in
 */
export function VideoAvatarStage() {
  // A "cycle" is one shuffled pass through every idle clip. We keep the
  // cycle counter in state so React-StrictMode's double-invocation doesn't
  // reshuffle mid-playback.
  const [cycle, setCycle] = useState(0);
  const queue = useMemo<string[]>(() => {
    void cycle; // memo depends on cycle → re-shuffle once per cycle
    return shuffle(IDLE_SRCS);
  }, [cycle]);

  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Fade in just after mount.
    const fadeIn = window.setTimeout(() => setVisible(true), 20);
    // Fade out in the last FADE_MS of this segment.
    const fadeOut = window.setTimeout(() => setVisible(false), SEGMENT_MS - FADE_MS);
    // Advance at segment end.
    const advance = window.setTimeout(() => {
      setIdx((i) => {
        const next = i + 1;
        if (next >= queue.length) {
          setCycle((c) => c + 1);
          return 0;
        }
        return next;
      });
    }, SEGMENT_MS);

    return () => {
      window.clearTimeout(fadeIn);
      window.clearTimeout(fadeOut);
      window.clearTimeout(advance);
    };
  }, [idx, queue.length]);

  const src = queue[idx] ?? queue[0]!;

  return (
    <div className="absolute inset-0 overflow-hidden bg-altar">
      <video
        key={`${cycle}-${idx}`}
        src={src}
        muted
        autoPlay
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
        style={{
          objectPosition: "center 44%",
          opacity: visible ? 1 : 0,
          transition: `opacity ${FADE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        }}
      />
      <div className="vignette" />
      <div className="subtitle-scrim" />
    </div>
  );
}
