import { useEffect, useRef, useState } from "react";
import { CRITERIA, useGameStore } from "../../store/gameStore";
import { useJudge } from "../../hooks/useJudge";
import CounselPanel from "./CounselPanel";
import TranscriptFeed from "./TranscriptFeed";
import ConnectionSettings from "../ConnectionSettings";
import CourtStage from "../CourtStage";
import GameDialog from "../GameDialog";
import "./Courtroom.css";

export default function Courtroom() {
  const state = useGameStore();
  const { processArgument, isProcessing, cancelRequest } = useJudge();
  const [drawer, setDrawer] = useState(null);
  const [entered, setEntered] = useState(false);
  const benchRef = useRef(null);
  const smooth = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth";
  useEffect(() => {
    if (!state.pendingRuling) return;
    benchRef.current?.scrollIntoView({ behavior: smooth(), block: "nearest" });
    benchRef.current
      ?.querySelector(".continue-button")
      ?.focus({ preventScroll: true });
  }, [state.pendingRuling]);
  const isBotTurn =
    state.matchMode === "1VBOT" && state.currentSpeaker !== state.humanSide;
  useEffect(() => {
    const timer = setTimeout(() => setEntered(true), 950);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (
      drawer ||
      !entered ||
      !isBotTurn ||
      state.pendingRuling ||
      state.error ||
      isProcessing
    )
      return;
    const timer = setTimeout(
      () => processArgument("", state.currentSpeaker, true),
      250,
    );
    return () => clearTimeout(timer);
  }, [
    drawer,
    entered,
    isBotTurn,
    state.pendingRuling,
    state.error,
    state.currentSpeaker,
    isProcessing,
    processArgument,
  ]);
  useEffect(() => {
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  const titles = ["Opening arguments", "Rebuttals", "Closing submissions"];
  const names = {
    petitioner: state.petitionerName,
    respondent: state.respondentName,
  };
  const pending = state.pendingRuling;
  const followup =
    pending?.interrupt && state.retryCountBySpeaker[pending.side] < 2;
  const continueLabel = followup
    ? "Answer the bench"
    : pending?.side === "respondent"
      ? state.roundNumber === 3
        ? "See the scorecard"
        : "Begin next round"
      : "Hear the respondent";
  return (
    <main className="court-game">
      <header className="court-header">
        <span className="game-logo">
          <span className="logo-mark">T</span>THEMIS
        </span>
        <div className="court-case-title">
          <span className="small-caps">{state.selectedCase.category}</span>
          <h1>{state.selectedCase.title}</h1>
        </div>
        <button
          className="icon-button"
          aria-label="Pause hearing"
          onClick={() => setDrawer("pause")}
        >
          Ⅱ
        </button>
      </header>
      <div className="hearing-progress">
        <span className="round-chip">ROUND {state.roundNumber} / 3</span>
        <strong>{titles[state.roundNumber - 1]}</strong>
        <span>
          {pending
            ? "A ruling from the bench"
            : isProcessing
              ? isBotTurn
                ? "Opposing counsel is preparing…"
                : "The bench is considering…"
              : `${names[state.currentSpeaker]} has the floor`}
        </span>
      </div>
      <div className="court-play-area">
        <div className="court-main-column">
          <div className="court-scene-wrap">
            <CourtStage
              active={pending || isProcessing ? "judge" : state.currentSpeaker}
              processing={isProcessing}
            >
              {!entered && (
                <div className="court-entrance">
                  <span>ALL RISE!</span>
                  <small>The court is now in session.</small>
                </div>
              )}
              {isProcessing && (
                <div className="thinking-caption">
                  <i />
                  <i />
                  <i />
                  <span>
                    {isBotTurn
                      ? "Preparing a reply"
                      : "Considering your submission"}
                  </span>
                  <button onClick={cancelRequest}>Withdraw request</button>
                </div>
              )}
            </CourtStage>
            <section
              ref={benchRef}
              className={`bench-dialogue ${pending ? "ruling-ready" : ""}`}
              aria-label="The bench"
            >
              <div className="bench-nameplate">
                {pending?.interrupt ? "A QUESTION FROM THE BENCH" : "THE BENCH"}
              </div>
              <div className="bench-dialogue-content" aria-live="polite">
                <p>{state.judgeMessage}</p>
                {pending && (
                  <button
                    className="continue-button"
                    onClick={() => {
                      window.speechSynthesis?.cancel();
                      state.acknowledgeRuling();
                      requestAnimationFrame(() => {
                        const input = document.querySelector(
                          ".submission-desk textarea",
                        );
                        input?.focus({ preventScroll: true });
                        input?.scrollIntoView({
                          behavior: smooth(),
                          block: "nearest",
                        });
                      });
                    }}
                  >
                    {continueLabel} <span>▶</span>
                  </button>
                )}
              </div>
              {pending?.interrupt && !followup && (
                <p className="followup-limit">
                  Two follow-ups heard. This turn is complete; continue to hand
                  over.
                </p>
              )}
              {pending?.botArgument && (
                <details className="opponent-submission">
                  <summary>Read opposing counsel’s submission</summary>
                  <p>{pending.botArgument}</p>
                </details>
              )}
            </section>
          </div>
          {state.error && (
            <div className="hearing-error" role="alert">
              <strong>A short recess.</strong>
              <p>{state.error}</p>
              <p>No points were added or lost.</p>
              <div className="button-row">
                {isBotTurn ? (
                  <button
                    className="primary-button"
                    disabled={isProcessing}
                    onClick={() =>
                      processArgument("", state.currentSpeaker, true)
                    }
                  >
                    Retry opposing counsel
                  </button>
                ) : null}
                <button
                  className="quiet-button"
                  onClick={() => setDrawer("settings")}
                >
                  Connection settings
                </button>
              </div>
            </div>
          )}
          <div className={`submission-desk ${pending ? "desk-reviewing" : ""}`}>
            {pending ? (
              <div className="review-prompt">
                <span>✦</span>
                <div>
                  <h2>Give that ruling a moment.</h2>
                  <p>
                    Read the bench’s response above. Continue when you’re ready.
                  </p>
                </div>
                <button
                  className="quiet-button"
                  onClick={() => setDrawer("scores")}
                >
                  Inspect the scores ↗
                </button>
              </div>
            ) : (
              <CounselPanel
                key={state.currentSpeaker}
                side={state.currentSpeaker}
                name={names[state.currentSpeaker]}
                isActive
                isDisabled={isProcessing || !entered}
                isBotControlled={isBotTurn}
                scores={state.scores[state.currentSpeaker]}
                onSubmit={(text) => processArgument(text, state.currentSpeaker)}
              />
            )}
          </div>
        </div>
        <aside className="hearing-sidebar">
          <div className="scoreboard-title">
            <h2>At the lectern</h2>
            <span>LIVE SCORE</span>
          </div>
          {["petitioner", "respondent"].map((side) => (
            <section
              className={`mini-player mini-${side} ${state.currentSpeaker === side ? "player-current" : ""}`}
              key={side}
            >
              <div className="mini-portrait">
                <img src={`/art/${side}.webp`} alt="" />
              </div>
              <div>
                <span className="small-caps">{side}</span>
                <h3>{names[side]}</h3>
              </div>
              <strong>
                {state.scores[side].total ?? "—"}
                <small>/100</small>
              </strong>
            </section>
          ))}
          <div className="round-track">
            {titles.map((title, index) => (
              <div
                key={title}
                className={
                  state.roundNumber === index + 1
                    ? "round-current"
                    : state.roundNumber > index + 1
                      ? "round-complete"
                      : ""
                }
              >
                <span>{state.roundNumber > index + 1 ? "✓" : index + 1}</span>
                {title}
              </div>
            ))}
          </div>
          <div className="court-tools">
            <button onClick={() => setDrawer("brief")}>
              ▤ <span>Case brief & authorities</span>
              <span>↗</span>
            </button>
            <button onClick={() => setDrawer("record")}>
              ≡ <span>The court record</span>
              <span>{state.transcript.length}</span>
            </button>
            <button onClick={() => setDrawer("scores")}>
              ◈ <span>Score breakdown</span>
              <span>↗</span>
            </button>
          </div>
          <button
            className="voice-toggle"
            aria-pressed={state.voiceEnabled}
            onClick={() => {
              state.toggleVoice();
              window.speechSynthesis?.cancel();
            }}
          >
            ♪ Spoken feedback {state.voiceEnabled ? "on" : "off"}
          </button>
        </aside>
      </div>
      {drawer && (
        <GameDialog
          title={
            drawer === "brief"
              ? "Case file"
              : drawer === "record"
                ? "Court record"
                : drawer === "scores"
                  ? "Scorecard"
                  : drawer === "pause"
                    ? "Hearing paused"
                    : "Settings"
          }
          onClose={() => setDrawer(null)}
        >
          {drawer === "record" && <TranscriptFeed />}
          {drawer === "brief" && (
            <div className="brief-content">
              <h2>{state.selectedCase.title}</h2>
              <h3>Facts</h3>
              <p className="preserve-lines">{state.selectedCase.facts}</p>
              <h3>Questions before the bench</h3>
              <ol>
                {state.selectedCase.issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ol>
              {state.selectedCase.petitioner_stand && (
                <>
                  <h3>Petitioner</h3>
                  <p>{state.selectedCase.petitioner_stand}</p>
                  <h3>Respondent</h3>
                  <p>{state.selectedCase.respondent_stand}</p>
                </>
              )}
              <h3>Authorities</h3>
              <ul>
                {state.selectedCase.precedents.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
              {state.selectedCase.source_url && (
                <a
                  className="source-link"
                  href={state.selectedCase.source_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Read original judgment ↗
                </a>
              )}
            </div>
          )}
          {drawer === "scores" && (
            <div className="score-drawer">
              <h2>Every argument counts.</h2>
              <p className="form-note">
                Scores run from −3 to +3. A dash means not assessed. Overall
                scores normalise criterion averages to 100.
              </p>
              {["petitioner", "respondent"].map((side) => (
                <section key={side}>
                  <h3>
                    {names[side]}{" "}
                    <span>{state.scores[side].total ?? "—"}/100</span>
                  </h3>
                  {Object.entries(CRITERIA).map(([key, label]) => (
                    <div key={key}>
                      <span>{label}</span>
                      <strong>
                        {state.scores[side][key]?.toFixed(1) ?? "—"}
                      </strong>
                    </div>
                  ))}
                </section>
              ))}
              {state.provider && (
                <p className="form-note">Last assessment: {state.provider}</p>
              )}
            </div>
          )}
          {drawer === "settings" && <ConnectionSettings expanded />}
          {drawer === "pause" && (
            <div className="pause-menu">
              <h2>Court in recess.</h2>
              <p>Your draft and scores stay here while this tab is open.</p>
              <button
                className="primary-button"
                onClick={() => setDrawer(null)}
              >
                Back to the hearing ▶
              </button>
              <button
                className="quiet-button"
                onClick={() => setDrawer("settings")}
              >
                Connection settings
              </button>
              <button
                className="quiet-button"
                onClick={() => {
                  if (
                    window.confirm(
                      "Leave this hearing? Your draft and court record will be cleared.",
                    )
                  )
                    state.resetGame();
                }}
              >
                Leave hearing
              </button>
            </div>
          )}
        </GameDialog>
      )}
    </main>
  );
}
