import { useEffect, useRef, useState } from "react";
import GameDialog from "./GameDialog";

export default function BringCase({ onClose, onReady }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [issues, setIssues] = useState("");
  const [authorities, setAuthorities] = useState("");
  const [files, setFiles] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(false);
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  const limit = 30000;
  const close = () => {
    if (busy || text) {
      if (
        !window.confirm(
          "Close this case file? Your unsaved import will be cleared.",
        )
      )
        return;
    }
    controller.current?.abort();
    onClose();
  };
  async function upload(list) {
    if (!list.length) return;
    if (list.length > 4) {
      setError("Choose up to four documents at a time.");
      return;
    }
    if (list.some((file) => file.size > 10 * 1024 * 1024)) {
      setError("Each document must be 10 MB or smaller.");
      return;
    }
    setBusy(true);
    setError("");
    controller.current = new AbortController();
    try {
      const imports = [];
      for (const file of list) {
        const body = new FormData();
        body.append("file", file);
        const response = await fetch(
          `${import.meta.env.VITE_API_BASE || "/api"}/cases/import`,
          {
            method: "POST",
            body,
            signal: AbortSignal.any([
              controller.current.signal,
              AbortSignal.timeout(45000),
            ]),
          },
        );
        let result;
        try {
          result = await response.json();
        } catch {
          throw new Error(
            "The court office did not respond. Check the backend and try again.",
          );
        }
        if (!response.ok)
          throw new Error(
            typeof result.detail === "string"
              ? result.detail
              : "This document could not be read. Try a text-based PDF, DOCX or TXT file.",
          );
        imports.push(result);
      }
      setText(
        imports
          .map((item) =>
            imports.length > 1
              ? `DOCUMENT: ${item.filename}\n\n${item.text}`
              : item.text,
          )
          .join("\n\n"),
      );
      setTitle(imports[0].title.slice(0, 200));
      setFiles(imports.map((item) => item.filename));
      setWarnings(imports.flatMap((item) => item.warnings));
      setReview(true);
    } catch (err) {
      if (!controller.current.signal.aborted)
        setError(
          err.name === "TypeError"
            ? "The court office is offline. Start the backend and retry, or paste your case text below."
            : err.name === "TimeoutError"
              ? "Reading took too long. Try a smaller document or paste the text."
              : err.message,
        );
    } finally {
      setBusy(false);
    }
  }
  function ready(event) {
    event.preventDefault();
    const questions = issues
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const laws = authorities
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (
      !questions.length ||
      questions.length > 20 ||
      questions.some((s) => s.length > 1000)
    ) {
      setError(
        "Add 1–20 questions, one per line, with up to 1,000 characters each.",
      );
      return;
    }
    if (laws.length > 50 || laws.some((s) => s.length > 1000)) {
      setError(
        "Use up to 50 authorities, one per line, with up to 1,000 characters each.",
      );
      return;
    }
    if (
      [title.trim(), text.trim(), ...questions, ...laws].reduce(
        (total, value) => total + value.length,
        0,
      ) > 60000
    ) {
      setError(
        "The title, facts, questions and authorities together must fit within 60,000 characters. Shorten the material before entering court.",
      );
      return;
    }
    onReady({
      id: `custom-${crypto.randomUUID()}`,
      title: title.trim(),
      facts: text.trim(),
      issues: questions,
      precedents: laws,
      category: "Your moot",
      source_label: "Your case file",
      source_files: files,
      brief_note:
        "Your reviewed proposition. Only the text shown here is sent to the bench.",
    });
  }
  return (
    <GameDialog
      title="Bring your own case"
      onClose={close}
      className="import-dialog"
    >
      <div className="import-heading">
        <div className="folder-illustration" aria-hidden="true">
          §
        </div>
        <div>
          <h2>
            Your moot.
            <br />
            Your courtroom.
          </h2>
          <p>Proposition, clarifications, annexures. Bring the paperwork.</p>
        </div>
      </div>
      {!review && (
        <>
          <label
            className={`upload-zone ${busy ? "is-reading" : ""}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!busy) upload(Array.from(e.dataTransfer.files));
            }}
          >
            <span className="upload-symbol" aria-hidden="true">
              ↥
            </span>
            <strong>
              {busy ? "Reading the case file…" : "Drop your documents here"}
            </strong>
            <span>
              or choose files · PDF, DOCX, TXT · up to 4 files, 10 MB each
            </span>
            <input
              type="file"
              aria-label="Upload case documents"
              accept=".pdf,.docx,.txt"
              multiple
              disabled={busy}
              onChange={(e) => {
                upload(Array.from(e.target.files));
                e.target.value = "";
              }}
            />
          </label>
          <div className="paste-divider">OR PASTE YOUR PROPOSITION</div>
          <label className="sr-only" htmlFor="paste-case">
            Case text
          </label>
          <textarea
            id="paste-case"
            className="paste-case"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the facts and proposition here…"
            disabled={busy}
          />
          <button
            className="primary-button"
            disabled={busy || !text.trim()}
            onClick={() => {
              setError("");
              setReview(true);
            }}
          >
            Review case file →
          </button>
          <p className="form-note">
            Text is extracted locally by this backend. Nothing is filed
            permanently. Scanned PDFs need selectable text.
          </p>
        </>
      )}
      {review && (
        <form onSubmit={ready} className="import-review">
          <div className="file-chips">
            {files.map((file) => (
              <span key={file}>▤ {file}</span>
            ))}
          </div>
          <label>
            Case title
            <input
              value={title}
              maxLength={200}
              required
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Name of your moot proposition"
            />
          </label>
          <label>
            Facts & proposition{" "}
            <span className={text.length > limit ? "over-limit" : "field-help"}>
              {text.length.toLocaleString()} / 30,000 characters
            </span>
            <textarea
              className="case-text-review"
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
            />
          </label>
          {text.length > limit && (
            <p className="form-error">
              The complete extraction is shown. Reduce it to 30,000 characters,
              keeping the facts and relevant annexures. Nothing has been
              silently removed.
            </p>
          )}
          {warnings.map((w, i) => (
            <p className="form-note" key={i}>
              {w}
            </p>
          ))}
          <label>
            Questions for the bench
            <textarea
              value={issues}
              onChange={(e) => setIssues(e.target.value)}
              required
              placeholder="Paste the issues from your proposition, one per line."
            />
          </label>
          <label>
            Authorities / applicable law{" "}
            <span className="field-help">Optional · one per line</span>
            <textarea
              value={authorities}
              onChange={(e) => setAuthorities(e.target.value)}
              placeholder="Add the statutes and authorities supplied with your moot."
            />
          </label>
          <p className="form-note">
            Check extraction before playing. The reviewed text and your
            arguments go to the configured model when you submit in court.
          </p>
          <div className="button-row">
            <button
              type="button"
              className="quiet-button"
              onClick={() => setReview(false)}
            >
              Back to documents
            </button>
            <button
              className="primary-button"
              disabled={
                !title.trim() ||
                !text.trim() ||
                !issues.trim() ||
                text.length > limit
              }
            >
              Choose counsel →
            </button>
          </div>
        </form>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </GameDialog>
  );
}
