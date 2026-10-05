import { useEffect, useState } from "react";
import GameDialog from "./GameDialog";
import { useGameStore } from "../store/gameStore";
import ConnectionSettings from "./ConnectionSettings";
import { api } from "../utils/api";

export default function CaseSetup({ selectedCase, onClose }) {
  const [tab, setTab] = useState(
    selectedCase.id?.toString().startsWith("custom-") ? "players" : "brief",
  );
  const [mode, setMode] = useState("1V1");
  const [side, setSide] = useState("petitioner");
  const [name, setName] = useState("");
  const [opponent, setOpponent] = useState("");
  const [connection, setConnection] = useState(null);
  const [showConnection, setShowConnection] = useState(false);
  const options = useGameStore((state) => state.options);
  useEffect(() => {
    const controller = new AbortController();
    api("/health", undefined, controller.signal)
      .then(setConnection)
      .catch(() => {
        if (!controller.signal.aborted) setConnection({ offline: true });
      });
    return () => controller.abort();
  }, []);
  const hasFallback =
    options.allow_fallback &&
    (options.openai_key || connection?.openai_configured);
  const connectionNeeded =
    connection &&
    (connection.offline ||
      (!hasFallback &&
        (!connection.primary_judge_configured ||
          (mode === "1VBOT" && !connection.primary_counsel_configured))));
  const startGame = useGameStore((state) => state.startGame);
  function start(event) {
    event.preventDefault();
    startGame({
      selectedCase,
      matchMode: mode,
      humanSide: side,
      petitionerName:
        mode === "1VBOT" && side === "respondent"
          ? "Opposing counsel"
          : name.trim() || "Counsel A",
      respondentName:
        mode === "1VBOT"
          ? side === "respondent"
            ? name.trim() || "Counsel B"
            : "Opposing counsel"
          : opponent.trim() || "Counsel B",
    });
  }
  return (
    <GameDialog title="Case file" onClose={onClose}>
      <div className="case-detail-top">
        <span className="case-category">{selectedCase.category}</span>
        <h2>{selectedCase.title}</h2>
        <span className="field-help">
          {selectedCase.source_label || "Practice proposition"}
        </span>
      </div>
      <div className="file-tabs">
        <button aria-pressed={tab === "brief"} onClick={() => setTab("brief")}>
          The brief
        </button>
        <button
          aria-pressed={tab === "players"}
          onClick={() => setTab("players")}
        >
          Choose counsel
        </button>
      </div>
      {tab === "brief" ? (
        <div className="brief-content">
          <h3>Facts of the matter</h3>
          <p className="preserve-lines">{selectedCase.facts}</p>
          <h3>Before the bench</h3>
          <ol>
            {selectedCase.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ol>
          {(selectedCase.petitioner_stand || selectedCase.respondent_stand) && (
            <div className="positions-grid">
              <section>
                <h3>Petitioner’s position</h3>
                <p>{selectedCase.petitioner_stand}</p>
              </section>
              <section>
                <h3>Respondent’s position</h3>
                <p>{selectedCase.respondent_stand}</p>
              </section>
            </div>
          )}
          <details className="case-authorities">
            <summary>
              Applicable law & authorities · {selectedCase.precedents.length}
            </summary>
            <ul>
              {selectedCase.precedents.map((law) => (
                <li key={law}>{law}</li>
              ))}
            </ul>
          </details>
          {selectedCase.source_url && (
            <a
              className="source-link"
              href={selectedCase.source_url}
              target="_blank"
              rel="noreferrer"
            >
              Read the judgment on Indian Kanoon ↗
            </a>
          )}
          {selectedCase.brief_note && (
            <p className="form-note">{selectedCase.brief_note}</p>
          )}
          <button className="primary-button" onClick={() => setTab("players")}>
            Take this case →
          </button>
        </div>
      ) : (
        <form className="player-setup" onSubmit={start}>
          <fieldset>
            <legend>Who’s on the other side?</legend>
            <div className="mode-options">
              <button
                type="button"
                aria-pressed={mode === "1V1"}
                onClick={() => setMode("1V1")}
              >
                <span>Two players</span>
                <small>Pass the device. Make your case.</small>
              </button>
              <button
                type="button"
                aria-pressed={mode === "1VBOT"}
                onClick={() => setMode("1VBOT")}
              >
                <span>Solo practice</span>
                <small>Face computer-controlled counsel.</small>
              </button>
            </div>
          </fieldset>
          <div className="player-lineup">
            <img src={`/art/${side}.webp`} alt="" />
            <div>
              <label>
                {mode === "1V1" ? "Petitioner’s name" : "Your name"}
                <input
                  autoComplete="off"
                  maxLength={30}
                  placeholder="Counsel A"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              {mode === "1V1" ? (
                <label>
                  Respondent’s name
                  <input
                    maxLength={30}
                    placeholder="Counsel B"
                    value={opponent}
                    onChange={(e) => setOpponent(e.target.value)}
                  />
                </label>
              ) : (
                <label>
                  Your side
                  <select
                    value={side}
                    onChange={(e) => setSide(e.target.value)}
                  >
                    <option value="petitioner">
                      Petitioner · make the challenge
                    </option>
                    <option value="respondent">
                      Respondent · defend the action
                    </option>
                  </select>
                </label>
              )}
            </div>
            <img
              src={`/art/${side === "petitioner" ? "respondent" : "petitioner"}.webp`}
              alt=""
            />
          </div>
          <div className="round-preview">
            <span>Opening</span>
            <span>Rebuttal</span>
            <span>Closing</span>
          </div>
          <p className="form-note">
            Three rounds. Up to two bench questions per side, per round. Read
            each ruling, then continue when you’re ready.
          </p>
          {connectionNeeded && (
            <div className="setup-connection-note" role="status">
              <p>
                {connection.offline
                  ? "The court office is offline. Start the backend before submitting."
                  : "A model connection is still needed for this mode. You can explore the courtroom, but submissions need a connected bench and solo play also needs opposing counsel."}
              </p>
              <button
                className="quiet-button"
                type="button"
                onClick={() => setShowConnection((value) => !value)}
              >
                Connection settings
              </button>
            </div>
          )}
          <button className="primary-button play-button" type="submit">
            Enter the courtroom <span>▶</span>
          </button>
        </form>
      )}
      {showConnection && <ConnectionSettings expanded />}
    </GameDialog>
  );
}
