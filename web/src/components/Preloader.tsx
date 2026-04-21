import { useEffect, useState } from "react";

const BASE = import.meta.env.BASE_URL;

const ASSETS: readonly string[] = [
  `${BASE}videos/idle_1.mp4`,
  `${BASE}videos/idle_2.mp4`,
  `${BASE}videos/idle_3.mp4`,
  `${BASE}videos/idle_4.mp4`,
  `${BASE}videos/idle_5.mp4`,
  `${BASE}videos/idle_6.mp4`,
  `${BASE}videos/idle_7.mp4`,
  `${BASE}videos/idle_8.mp4`,
  `${BASE}videos/idle_9.mp4`,
  `${BASE}audio/ambient_1.mp3`,
  `${BASE}audio/ambient_2.mp3`,
];

interface PreloaderProps {
  onReady: () => void;
}

/**
 * Full-screen splash that warms the HTTP cache for every video + audio asset
 * before revealing the main scene. Each asset fetch reports on completion
 * and the splash fades out once all are in-cache.
 */
export function Preloader({ onReady }: PreloaderProps) {
  const [loaded, setLoaded] = useState(0);
  const [ready, setReady] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const work = ASSETS.map((url) =>
      fetch(url, { cache: "force-cache" })
        .then((r) => r.blob())
        .catch(() => null)
        .then(() => {
          if (!cancelled) setLoaded((n) => n + 1);
        }),
    );

    Promise.allSettled(work).then(() => {
      if (cancelled) return;
      // Let the final progress bar frame render before fading.
      window.setTimeout(() => setFading(true), 200);
      window.setTimeout(() => setReady(true), 900);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (ready) onReady();
  }, [ready, onReady]);

  if (ready) return null;

  const pct = Math.round((loaded / ASSETS.length) * 100);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-altar text-parchment transition-opacity duration-700 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      aria-hidden={fading}
    >
      <h1 className="font-display text-5xl uppercase tracking-[0.25em] text-parchment sm:text-6xl">
        Father Octavian
      </h1>
      <p className="mt-3 font-serif text-lg italic text-parchment/60">
        Preparing vigil&hellip;
      </p>
      <div
        className="mt-10 h-[3px] w-64 overflow-hidden rounded-full bg-parchment/15"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div
          className="h-full bg-ember transition-[width] duration-200 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-3 font-display text-xs uppercase tracking-widest text-parchment/40">
        {loaded} / {ASSETS.length}
      </p>
    </div>
  );
}
