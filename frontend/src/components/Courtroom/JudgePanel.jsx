import { useGameStore } from "../../store/gameStore";
import { highlightLegalTerms } from "../../utils/formatters";
export default function JudgePanel() {
  const { judgeMessage, isInterrupting, turnState, provider } = useGameStore();
  return (
    <section
      className={`judge-panel ${turnState === "JUDGE" ? "judge-active" : ""}`}
      aria-label="The bench"
    >
      <div className="judge-avatar" aria-hidden="true">
        ⚖
      </div>
      <p className="eyebrow">THE BENCH</p>
      <h2>
        {turnState === "JUDGE"
          ? "Considering…"
          : isInterrupting
            ? "A question, counsel."
            : "Order, order."}
      </h2>
      <div className="judge-speech" aria-live="polite">
        {highlightLegalTerms(judgeMessage || "The court is ready to hear you.")}
      </div>
      {provider && <p className="provider-label">Assessed by {provider}</p>}
    </section>
  );
}
