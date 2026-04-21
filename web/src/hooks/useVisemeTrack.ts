import { useEffect, useRef, useState } from "react";

/**
 * Viseme set backed by the 10 priest mouth frames shipped in `public/visemes/`.
 *
 *  rest — closed neutral
 *  ae   — /æ/  as in "cat"
 *  ah   — /ɑː/ as in "father"
 *  ee   — /iː/ as in "see" (also stands in for /eɪ/ "day")
 *  ih   — /ɪ/  as in "bit"
 *  oo   — /uː/ as in "boot"
 *  ai   — /aɪ/ as in "my"
 *  ow   — /aʊ/ as in "now"
 *  mbp  — bilabial stop /p b m/
 *  sz   — alveolar fricative /s z ʃ/
 */
export type Viseme =
  | "rest"
  | "ae"
  | "ah"
  | "ee"
  | "ih"
  | "oo"
  | "ai"
  | "ow"
  | "mbp"
  | "sz";

export const VISEMES: readonly Viseme[] = [
  "rest", "ae", "ah", "ee", "ih", "oo", "ai", "ow", "mbp", "sz",
] as const;

/**
 * English grapheme → viseme rules, prioritized longest-first. Crude but good
 * enough for a "this face is speaking the text on screen" illusion without
 * running a real G2P model.
 */
interface Rule {
  pattern: string;
  viseme: Viseme;
}

const RULES: readonly Rule[] = [
  // Diphthong / tense-vowel digraphs and trigraphs
  { pattern: "igh", viseme: "ai" },   // night, light, high
  { pattern: "eigh", viseme: "ee" },  // eight (4 chars — placed after igh so longest-first ordering is preserved by length sort below)
  { pattern: "aye", viseme: "ai" },
  { pattern: "eye", viseme: "ai" },
  { pattern: "oy",  viseme: "ow" },
  { pattern: "oi",  viseme: "ow" },
  { pattern: "ou",  viseme: "ow" },
  { pattern: "ow",  viseme: "ow" },
  { pattern: "oo",  viseme: "oo" },
  { pattern: "ue",  viseme: "oo" },
  { pattern: "ew",  viseme: "oo" },
  { pattern: "oa",  viseme: "oo" },   // boat (closest we have)
  { pattern: "ay",  viseme: "ee" },
  { pattern: "ai",  viseme: "ee" },
  { pattern: "ei",  viseme: "ee" },
  { pattern: "ey",  viseme: "ee" },
  { pattern: "ee",  viseme: "ee" },
  { pattern: "ea",  viseme: "ee" },
  { pattern: "ie",  viseme: "ee" },
  { pattern: "ar",  viseme: "ah" },   // car, father
  { pattern: "au",  viseme: "ah" },   // author
  { pattern: "aw",  viseme: "ah" },   // saw

  // Consonant clusters that round to one of our visemes
  { pattern: "sh",  viseme: "sz" },
  { pattern: "zh",  viseme: "sz" },

  // Single letters (fallback)
  { pattern: "a",   viseme: "ae" },
  { pattern: "e",   viseme: "ee" },
  { pattern: "i",   viseme: "ih" },
  { pattern: "o",   viseme: "ah" },
  { pattern: "u",   viseme: "ah" },
  { pattern: "y",   viseme: "ee" },
  { pattern: "p",   viseme: "mbp" },
  { pattern: "b",   viseme: "mbp" },
  { pattern: "m",   viseme: "mbp" },
  { pattern: "s",   viseme: "sz" },
  { pattern: "z",   viseme: "sz" },
];

// Sort rules by pattern length (descending) so longest match always wins.
const SORTED_RULES: readonly Rule[] = [...RULES].sort(
  (a, b) => b.pattern.length - a.pattern.length,
);

export interface VisemeEvent {
  viseme: Viseme;
  /** Character index in the source string where the match begins. */
  at: number;
  /** Characters consumed by this match (1 for single-letter, 2+ for digraphs). */
  span: number;
}

/** Match the longest viseme rule at position `i` of `text.toLowerCase()`, or null. */
export function matchViseme(text: string, i: number): VisemeEvent | null {
  const lower = text.toLowerCase();
  for (const rule of SORTED_RULES) {
    if (lower.startsWith(rule.pattern, i)) {
      return { viseme: rule.viseme, at: i, span: rule.pattern.length };
    }
  }
  return null;
}

/** Scan the text linearly and return the full ordered sequence of viseme events. */
export function classifyRun(text: string): VisemeEvent[] {
  const events: VisemeEvent[] = [];
  let i = 0;
  while (i < text.length) {
    const m = matchViseme(text, i);
    if (m) {
      events.push(m);
      i += m.span;
    } else {
      i += 1;
    }
  }
  return events;
}

/**
 * Watches a paced subtitle buffer and reports the current viseme.
 *
 * Rules:
 *   - Whenever `shown` grows, reclassify the full string and pick the last event.
 *   - If no activity arrives within `restAfterMs`, fall back to 'rest'.
 *   - If `shown` shrinks (pacer.reset), snap straight to 'rest'.
 */
export function useVisemeTrack(shown: string, restAfterMs = 450): Viseme {
  const [viseme, setViseme] = useState<Viseme>("rest");
  const prevLenRef = useRef(0);
  const restTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (shown.length === 0) {
      prevLenRef.current = 0;
      setViseme("rest");
      if (restTimerRef.current !== null) {
        window.clearTimeout(restTimerRef.current);
        restTimerRef.current = null;
      }
      return;
    }

    if (shown.length < prevLenRef.current) {
      prevLenRef.current = shown.length;
      setViseme("rest");
      return;
    }

    if (shown.length === prevLenRef.current) return;
    prevLenRef.current = shown.length;

    const events = classifyRun(shown);
    if (events.length === 0) return;

    const latest = events[events.length - 1]!;
    setViseme(latest.viseme);

    if (restTimerRef.current !== null) window.clearTimeout(restTimerRef.current);
    restTimerRef.current = window.setTimeout(() => {
      setViseme("rest");
      restTimerRef.current = null;
    }, restAfterMs);
  }, [shown, restAfterMs]);

  useEffect(() => {
    return () => {
      if (restTimerRef.current !== null) window.clearTimeout(restTimerRef.current);
    };
  }, []);

  return viseme;
}
