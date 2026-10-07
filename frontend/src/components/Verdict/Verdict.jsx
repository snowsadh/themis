import { useGameStore, CRITERIA } from "../../store/gameStore";
import TranscriptFeed from "../Courtroom/TranscriptFeed";
import "./Verdict.css";
export default function Verdict() {
  const {
    verdict,
    scores,
    petitionerName,
    respondentName,
    resetGame,
    selectedCase,
    transcript,
  } = useGameStore();
  if (!verdict) return null;
  const names = { petitioner: petitionerName, respondent: respondentName };
  function download() {
    const text = [
      `THEMIS · Practice hearing`,
      selectedCase.title,
      `Result: ${verdict.winnerSide ? names[verdict.winnerSide] + " leads" : "Draw"}`,
      `${petitionerName}: ${scores.petitioner.total}/100 · ${respondentName}: ${scores.respondent.total}/100`,
      "",
      ...transcript.flatMap((t) => [
        `${t.type.toUpperCase()}: ${t.text}`,
        t.evaluation ? JSON.stringify(t.evaluation, null, 2) : "",
        "",
      ]),
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "themis-hearing.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <main className="verdict-bg">
      <div className="verdict-container">
        <header className="result-header">
          <span className="game-logo">
            <span className="logo-mark">T</span>THEMIS
          </span>
          <span className="eyebrow">HEARING COMPLETE · THREE ROUNDS</span>
        </header>
        <section className="result-intro">
          <div className="result-stamp" aria-hidden="true">
            COURT
            <br />
            ADJOURNED
          </div>
          <p className="eyebrow">{selectedCase.title}</p>
          <h1>
            {verdict.winnerSide ? (
              <>
                {names[verdict.winnerSide]}
                <br />
                <em>carries the day.</em>
              </>
            ) : (
              <>
                An even match.
                <br />
                <em>A case well argued.</em>
              </>
            )}
          </h1>
          <p>
            {verdict.winnerSide
              ? `${verdict.margin} points separate the two sides on this practice scorecard.`
              : "Both sides finished on the same overall score. Neither side is declared the winner."}
          </p>
        </section>
        <div className="result-scores">
          {["petitioner", "respondent"].map((side) => (
            <section
              className={`result-card ${verdict.winnerSide === side ? "result-lead" : ""}`}
              key={side}
            >
              <img
                className="result-portrait"
                src={`/art/${side}.webp`}
                alt=""
              />
              <p className="eyebrow">
                {side}
                {verdict.winnerSide === side ? " · LEADING SIDE" : ""}
              </p>
              <h2>{names[side]}</h2>
              <div className="result-total">
                {scores[side].total}
                <small>/100</small>
              </div>
              {Object.entries(CRITERIA).map(([key, label]) => (
                <div className="result-metric" key={key}>
                  <span>{label}</span>
                  <strong>
                    {scores[side][key] == null
                      ? "Not assessed"
                      : `${scores[side][key].toFixed(1)} / +3`}
                  </strong>
                </div>
              ))}
              <h3>Last note from the bench</h3>
              <p>
                {scores[side].history.at(-1)?.notes ||
                  scores[side].history.at(-1)?.feedback}
              </p>
            </section>
          ))}
        </div>
        <p className="score-explainer">
          Criterion means use all assessed submissions. Unassessed bench
          handling is excluded. Overall = (mean of assessed criterion means + 3)
          ÷ 6 × 100, rounded. This practice result is not a judgment about the
          actual law or historical outcome.
        </p>
        <div className="result-actions">
          <button className="primary-button" onClick={resetGame}>
            Try another matter →
          </button>
          <button className="quiet-button" onClick={download}>
            Download hearing
          </button>
          <button className="quiet-button" onClick={() => window.print()}>
            Print scorecard
          </button>
        </div>
        <TranscriptFeed />
      </div>
    </main>
  );
}
