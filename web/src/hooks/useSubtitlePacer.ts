import { useEffect, useRef, useState } from "react";

export interface PacerOptions {
  /** Target output rate in words per minute. */
  wpm: number;
  /** Average characters-per-word used to convert WPM → chars/sec. Default 5 (English ≈ 4.7). */
  avgCharsPerWord?: number;
}

export interface PacerHandle {
  /** Currently visible text (paced). */
  shown: string;
  /** Has the pacer caught up with the target buffer and been told the stream is done? */
  caughtUp: boolean;
  /** Append more text to the buffer. */
  push: (chunk: string) => void;
  /** Signal that no more chunks will arrive. Pacer will drain, then set caughtUp=true. */
  finish: () => void;
  /** Throw away current buffer and reset to empty. */
  reset: () => void;
}

/**
 * Paces streamed text into a "subtitle reveal" at a fixed words-per-minute rate.
 *
 * This is the seam for real TTS later: swap the fixed WPM clock for TTS word
 * timestamps and the rest of the UI stays identical.
 */
export function useSubtitlePacer(options: PacerOptions): PacerHandle {
  const { wpm, avgCharsPerWord = 5 } = options;
  const charsPerSec = (wpm * avgCharsPerWord) / 60;

  const [shown, setShown] = useState("");
  const [caughtUp, setCaughtUp] = useState(true);

  const targetRef = useRef("");
  const shownLenRef = useRef(0);
  const finishedRef = useRef(true);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const accumRef = useRef(0);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  function loop(ts: number) {
    const last = lastTsRef.current ?? ts;
    const dt = (ts - last) / 1000;
    lastTsRef.current = ts;
    accumRef.current += dt * charsPerSec;

    const want = Math.min(
      targetRef.current.length,
      shownLenRef.current + Math.floor(accumRef.current),
    );
    if (want > shownLenRef.current) {
      accumRef.current -= want - shownLenRef.current;
      shownLenRef.current = want;
      setShown(targetRef.current.slice(0, want));
    }

    const drained =
      shownLenRef.current >= targetRef.current.length && finishedRef.current;
    if (drained) {
      rafRef.current = null;
      lastTsRef.current = null;
      accumRef.current = 0;
      setCaughtUp(true);
      return;
    }
    rafRef.current = requestAnimationFrame(loop);
  }

  function ensureRunning() {
    if (rafRef.current !== null) return;
    lastTsRef.current = null;
    rafRef.current = requestAnimationFrame(loop);
  }

  return {
    shown,
    caughtUp,
    push(chunk: string) {
      if (!chunk) return;
      targetRef.current += chunk;
      finishedRef.current = false;
      setCaughtUp(false);
      ensureRunning();
    },
    finish() {
      finishedRef.current = true;
      ensureRunning();
    },
    reset() {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
      accumRef.current = 0;
      targetRef.current = "";
      shownLenRef.current = 0;
      finishedRef.current = true;
      setShown("");
      setCaughtUp(true);
    },
  };
}

/**
 * Pure pacer (no React) — advance visible-char count given elapsed time.
 * Extracted for unit tests and for eventual TTS-driven replacement.
 */
export class Pacer {
  private shown = 0;
  private accum = 0;
  constructor(
    public target: string,
    public charsPerSec: number,
    public finished: boolean = false,
  ) {}

  tickSeconds(dt: number): string {
    this.accum += dt * this.charsPerSec;
    const want = Math.min(this.target.length, this.shown + Math.floor(this.accum));
    this.accum -= want - this.shown;
    this.shown = want;
    return this.target.slice(0, this.shown);
  }

  append(chunk: string) {
    this.target += chunk;
  }

  finish() {
    this.finished = true;
  }

  get caughtUp(): boolean {
    return this.finished && this.shown >= this.target.length;
  }
}
