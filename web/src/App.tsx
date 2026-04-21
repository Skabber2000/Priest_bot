import { useCallback, useEffect, useState } from "react";
import { VideoAvatarStage } from "./components/VideoAvatarStage";
import { AmbientAudio } from "./components/AmbientAudio";
import { Preloader } from "./components/Preloader";
import { SubtitleBar } from "./components/SubtitleBar";
import { Composer } from "./components/Composer";
import { ChatLog } from "./components/ChatLog";
import { useSubtitlePacer } from "./hooks/useSubtitlePacer";
import { usePriestStream } from "./hooks/usePriestStream";
import { SUBTITLE_WPM } from "./config";
import type { ChatMessage } from "./lib/api";

const OPENING_LINE =
  "Come in, come in. Mind the draft — the Almighty economized on insulation.";

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const pacer = useSubtitlePacer({ wpm: SUBTITLE_WPM });
  const { streaming, error, send, cancel } = usePriestStream();

  // Show a written greeting once the preloader dismisses.
  useEffect(() => {
    if (!ready) return;
    pacer.push(OPENING_LINE);
    pacer.finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const handleSend = useCallback(
    async (text: string) => {
      const userMsg: ChatMessage = { role: "user", content: text };
      const next = [...messages, userMsg];
      setMessages(next);

      pacer.reset();

      let assistantText = "";
      await send(next, {
        onDelta: (delta) => {
          assistantText += delta;
          pacer.push(delta);
        },
        onDone: () => {
          pacer.finish();
          if (assistantText.trim()) {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: assistantText },
            ]);
          }
        },
      });
    },
    [messages, pacer, send],
  );

  return (
    <main className="relative h-full w-full">
      <Preloader onReady={() => setReady(true)} />
      <VideoAvatarStage />
      <AmbientAudio />
      <ChatLog
        messages={messages}
        visible={logOpen}
        onToggle={() => setLogOpen((v) => !v)}
      />
      <SubtitleBar text={pacer.shown} streaming={streaming || !pacer.caughtUp} />
      {error && (
        <div className="pointer-events-none absolute inset-x-0 top-20 flex justify-center">
          <p className="rounded-md bg-red-900/80 px-3 py-1 font-display text-xs uppercase tracking-widest text-red-100 shadow-lg">
            {error}
          </p>
        </div>
      )}
      <Composer
        disabled={streaming}
        streaming={streaming}
        onSend={handleSend}
        onCancel={cancel}
      />
    </main>
  );
}
