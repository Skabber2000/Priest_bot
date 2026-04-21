import { useState, type FormEvent, type KeyboardEvent } from "react";

interface ComposerProps {
  disabled: boolean;
  onSend: (text: string) => void;
  onCancel?: () => void;
  streaming: boolean;
}

export function Composer({ disabled, onSend, onCancel, streaming }: ComposerProps) {
  const [value, setValue] = useState("");

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <form
      onSubmit={submit}
      className="pointer-events-auto absolute inset-x-0 bottom-0 flex justify-center px-4 pb-5"
    >
      <div className="flex w-full max-w-3xl items-end gap-2 rounded-2xl border border-parchment/20 bg-black/60 p-2 shadow-xl backdrop-blur-md">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Speak your mind, my child…"
          className="min-h-[2.5rem] w-full resize-none bg-transparent px-3 py-2 font-serif text-lg text-parchment placeholder:italic placeholder:text-parchment/40 focus:outline-none"
          maxLength={2000}
          disabled={disabled && !streaming}
        />
        {streaming ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-parchment/30 px-4 py-2 font-display text-sm uppercase tracking-wider text-parchment/80 transition hover:border-ember hover:text-ember"
          >
            Interrupt
          </button>
        ) : (
          <button
            type="submit"
            disabled={!value.trim() || disabled}
            className="rounded-xl bg-ember/90 px-4 py-2 font-display text-sm uppercase tracking-wider text-altar transition hover:bg-ember disabled:opacity-40"
          >
            Speak
          </button>
        )}
      </div>
    </form>
  );
}
