import { CRITERIA, useGameStore } from "../../store/gameStore";
export default function TranscriptFeed() {
  const { transcript } = useGameStore();
  return (
    <section className="transcript-wrap">
      <div className="transcript-header">
        <h2 className="transcript-title">The court record</h2>
        <span>{transcript.length} entries</span>
      </div>
      <div className="transcript-body">
        {transcript.map((entry) => (
          <article
            key={entry.id}
            className={`transcript-entry entry-${entry.type}`}
          >
            <div className="entry-icon" aria-hidden="true">
              {entry.type === "judge"
                ? "⚖"
                : entry.type === "petitioner"
                  ? "P"
                  : "R"}
            </div>
            <div className="entry-content">
              <div className="entry-label">
                {entry.type === "judge" ? "The bench" : entry.type}
                {entry.bot ? " · opposing counsel" : ""}
                <span className="entry-time">{entry.timestamp}</span>
              </div>
              <p className="entry-text">{entry.text}</p>
              {entry.evaluation && (
                <details className="assessment">
                  <summary>Assessment · {entry.evaluation.provider}</summary>
                  <div className="entry-scores">
                    {Object.entries(CRITERIA).map(([key, label]) => (
                      <span key={key}>
                        {label}:{" "}
                        {entry.evaluation.delta_scores[key] ?? "Not assessed"}
                      </span>
                    ))}
                  </div>
                  <p>{entry.evaluation.judge_notes}</p>
                  {entry.evaluation.evidence?.length > 0 && (
                    <p className="muted">
                      Related brief passages (keyword matches, not verified
                      citations):{" "}
                      {entry.evaluation.evidence.map((e) => e.label).join(", ")}
                      .
                    </p>
                  )}
                </details>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
