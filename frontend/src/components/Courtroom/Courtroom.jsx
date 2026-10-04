import { useEffect } from "react";
import { CRITERIA, useGameStore } from "../../store/gameStore";
import { useJudge } from "../../hooks/useJudge";
import CounselPanel from "./CounselPanel";
import JudgePanel from "./JudgePanel";
import TranscriptFeed from "./TranscriptFeed";
import "./Courtroom.css";

export default function Courtroom() {
  const state = useGameStore();
  const { processArgument, isProcessing, cancelRequest } = useJudge();
  const isBotTurn = state.matchMode === "1VBOT" && state.currentSpeaker !== state.humanSide;
  useEffect(() => {
    if (!isBotTurn || state.pendingRuling || state.error || isProcessing) return;
    const timer = setTimeout(() => processArgument("", state.currentSpeaker, true), 250);
    return () => clearTimeout(timer);
  }, [isBotTurn, state.pendingRuling, state.error, state.currentSpeaker, isProcessing, processArgument]);
  const names = { petitioner: state.petitionerName, respondent: state.respondentName };
  const pending = state.pendingRuling;
  const followup = pending?.interrupt && state.retryCountBySpeaker[pending.side] < 2;
  const continueLabel = followup ? "Answer the bench" : pending?.side === "respondent" ? state.roundNumber === 3 ? "See the scorecard" : "Begin next round" : "Hear the respondent";
  return (
    <main className="courtroom-bg">
      <header><h1>{state.selectedCase.title}</h1><p>Round {state.roundNumber} / 3</p></header>
      <JudgePanel />
      {isProcessing && <button onClick={cancelRequest}>Withdraw request</button>}
      {state.error && <div role="alert"><p>{state.error}</p><p>No points were added or lost.</p>{isBotTurn && <button disabled={isProcessing} onClick={() => processArgument("", state.currentSpeaker, true)}>Retry opposing counsel</button>}</div>}
      {pending ? <section>
        {pending.botArgument && <details><summary>Read opposing counsel’s submission</summary><p>{pending.botArgument}</p></details>}
        <button className="continue-button" onClick={state.acknowledgeRuling}>{continueLabel}</button>
      </section> : <CounselPanel side={state.currentSpeaker} name={names[state.currentSpeaker]} isActive isDisabled={isProcessing} isBotControlled={isBotTurn} onSubmit={(text) => processArgument(text, state.currentSpeaker)} />}
      <aside>{["petitioner", "respondent"].map((side) => <section key={side}><h2>{names[side]} · {state.scores[side].total ?? "—"}/100</h2>{Object.entries(CRITERIA).map(([key, label]) => <p key={key}>{label}: {state.scores[side][key]?.toFixed(1) ?? "Not assessed"}</p>)}</section>)}</aside>
      <TranscriptFeed />
      <button onClick={state.resetGame}>Leave hearing</button>
    </main>
  );
}
