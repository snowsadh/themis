import { useRef, useState, useEffect } from "react";
import { useGameStore } from "../../store/gameStore";

export default function CounselPanel({
  side,
  name,
  isActive,
  isDisabled,
  isBotControlled,
  onSubmit,
}) {
  const text = useGameStore((state) => state.drafts[side]);
  const setDraft = useGameStore((state) => state.setDraft);
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState("");
  const recognition = useRef(null);
  const supported = !!(
    window.SpeechRecognition || window.webkitSpeechRecognition
  );
  useEffect(() => {
    if (isDisabled) recognition.current?.abort();
    return () => recognition.current?.abort();
  }, [isDisabled]);
  const submit = () => {
    if (isDisabled || !text.trim()) return;
    recognition.current?.stop();
    onSubmit(text);
  };
  function dictate() {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const Recognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new Recognition();
    recognition.current = rec;
    rec.lang = "en-IN";
    rec.continuous = true;
    rec.interimResults = true;
    const prefix = text;
    rec.onresult = (event) => {
      const words = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(" ");
      setDraft(side, `${prefix} ${words}`.trim().slice(0, 6000));
    };
    rec.onerror = (event) => {
      setListening(false);
      setMicError(
        event.error === "not-allowed"
          ? "Microphone access was denied. Allow it in browser settings or type your argument."
          : "Dictation stopped. Your text is safe; you can keep typing.",
      );
    };
    rec.onend = () => setListening(false);
    try {
      rec.start();
      setListening(true);
      setMicError("");
    } catch {
      setMicError(
        "The microphone could not start. Type your argument instead.",
      );
    }
  }
  return (
    <section
      className={`counsel-panel ${isActive ? "counsel-active" : "counsel-inactive"} counsel-${side}`}
    >
      <div className="counsel-header">
        <div className="counsel-avatar" aria-hidden="true">
          {side === "petitioner" ? "P" : "R"}
        </div>
        <div>
          <p className="eyebrow">{side}</p>
          <h2 className="counsel-name">{name}</h2>
        </div>
      </div>
      {isBotControlled ? (
        <div className="counsel-waiting">
          <span className="quill" aria-hidden="true">
            ✎
          </span>
          <p>
            {isActive
              ? "Opposing counsel is preparing…"
              : "Listening to the proceedings."}
          </p>
        </div>
      ) : (
        <>
          <label className="argument-label" htmlFor={`argument-${side}`}>
            {isActive ? "The floor is yours." : "Prepare your next submission."}
          </label>
          <textarea
            id={`argument-${side}`}
            value={text}
            maxLength={6000}
            onChange={(e) => setDraft(side, e.target.value)}
            placeholder="State your point, apply it to the facts, then ask for the relief you seek."
            disabled={isDisabled && isActive}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
          />
          <div className="composer-meta">
            <span>{text.length.toLocaleString()} / 6,000</span>
            <span>Ctrl / ⌘ + Enter to submit</span>
          </div>
          <div className="composer-actions">
            <button
              className="quiet-button"
              disabled={isDisabled || !supported}
              onClick={dictate}
            >
              {listening
                ? "Stop dictation"
                : supported
                  ? "Use microphone"
                  : "Type your argument"}
            </button>
            <button
              className="primary-button"
              disabled={isDisabled || !text.trim()}
              onClick={submit}
            >
              {isDisabled && isActive
                ? "Before the bench…"
                : "Submit argument →"}
            </button>
          </div>
          {micError && (
            <p className="inline-error" role="status">
              {micError}
            </p>
          )}
        </>
      )}
    </section>
  );
}
