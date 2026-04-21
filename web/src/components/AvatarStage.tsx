import { memo } from "react";
import { VISEMES, type Viseme } from "../hooks/useVisemeTrack";

const BASE = import.meta.env.BASE_URL;

const VISEME_SRC: Record<Viseme, string> = {
  rest: `${BASE}visemes/rest.jpg`,
  ae: `${BASE}visemes/ae.jpg`,
  ah: `${BASE}visemes/ah.jpg`,
  ee: `${BASE}visemes/ee.jpg`,
  ih: `${BASE}visemes/ih.jpg`,
  oo: `${BASE}visemes/oo.jpg`,
  ai: `${BASE}visemes/ai.jpg`,
  ow: `${BASE}visemes/ow.jpg`,
  mbp: `${BASE}visemes/mbp.jpg`,
  sz: `${BASE}visemes/sz.jpg`,
};

// Non-rest visemes. Rest is drawn separately as an always-visible base layer.
const SPEAKING_VISEMES = VISEMES.filter((v) => v !== "rest");

interface AvatarStageProps {
  viseme: Viseme;
}

function AvatarStageInner({ viseme }: AvatarStageProps) {
  return (
    <div
      className="avatar-stage absolute inset-0 overflow-hidden bg-altar"
      data-viseme={viseme}
    >
      <div className="absolute inset-0 animate-subtle-pan">
        {/* Rest is always at opacity 1 underneath so transitions between
            visemes always return through the priest's neutral face — no
            black flashes, no ghost-doubling. */}
        <img
          src={VISEME_SRC.rest}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="viseme-layer viseme-rest absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: "center 44%" }}
          fetchPriority="high"
          decoding="async"
        />
        {SPEAKING_VISEMES.map((v) => (
          <img
            key={v}
            src={VISEME_SRC[v]}
            alt=""
            aria-hidden="true"
            draggable={false}
            className={`viseme-layer absolute inset-0 h-full w-full object-cover${
              v === viseme ? " is-active" : ""
            }`}
            style={{ objectPosition: "center 44%" }}
            fetchPriority="low"
            decoding="async"
          />
        ))}
      </div>
      <div className="candlelight animate-flicker" />
      <div className="vignette" />
      <div className="grain" />
      <div className="subtitle-scrim" />
    </div>
  );
}

export const AvatarStage = memo(AvatarStageInner);
