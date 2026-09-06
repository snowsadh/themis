import { useEffect, useState } from "react";
import { useGameStore } from "../store/gameStore";
import { api } from "../utils/api";

export default function ConnectionSettings({ expanded = false }) {
  const { options, setOptions } = useGameStore();
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState("Checking court connection…");
  async function check() {
    setMessage("Checking court connection…");
    try {
      const result = await api("/health");
      setStatus(result);
      setMessage(
        result.judge_configured
          ? "Backend connected · model configured (not yet tested)"
          : "Backend connected · add a model or fallback key to hear arguments",
      );
    } catch {
      setStatus(null);
      setMessage("Backend offline · start the server to hear arguments");
    }
  }
  useEffect(() => {
    let cancelled = false;
    api("/health")
      .then((result) => {
        if (!cancelled) {
          setStatus(result);
          setMessage(
            result.judge_configured
              ? "Backend connected · model configured (not yet tested)"
              : "Backend connected · add a model or fallback key to hear arguments",
          );
        }
      })
      .catch(() => {
        if (!cancelled)
          setMessage("Backend offline · start the server to hear arguments");
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <details className="connection-settings" open={expanded}>
      <summary>
        Advanced · court connection <span aria-hidden="true">↗</span>
      </summary>
      <div className="settings-body">
        <p role="status">{message}</p>
        <p>
          The fine-tuned judge is configured in the server’s .env file.{" "}
          {status?.fine_tuned_configured
            ? "Its endpoint is configured."
            : "No fine-tuned endpoint is configured yet."}
        </p>
        <label className="check-label">
          <input
            type="checkbox"
            checked={options.allow_fallback}
            onChange={(e) => setOptions({ allow_fallback: e.target.checked })}
          />{" "}
          Allow OpenAI fallback if the primary judge fails
        </label>
        <label>
          Fallback API key{" "}
          <input
            type="password"
            autoComplete="off"
            value={options.openai_key}
            placeholder={
              status?.openai_configured
                ? "Server key configured · optional override"
                : "sk-…"
            }
            onChange={(e) => setOptions({ openai_key: e.target.value.trim() })}
          />
        </label>
        <label>
          Fallback model{" "}
          <input
            value={options.openai_model}
            placeholder={status?.openai_model || "gpt-4o-mini"}
            maxLength={120}
            onChange={(e) =>
              setOptions({ openai_model: e.target.value.trim() })
            }
          />
        </label>
        <p className="muted">
          Changes apply to the next submission. Your override stays in memory
          until this tab reloads. It is sent only to this backend, then to
          OpenAI. Fallback calls use your API balance.
        </p>
        <div className="button-row">
          <button
            className="quiet-button"
            onClick={() => setOptions({ openai_key: "" })}
          >
            Clear override
          </button>
          <button className="quiet-button" onClick={check}>
            Check backend
          </button>
        </div>
      </div>
    </details>
  );
}
