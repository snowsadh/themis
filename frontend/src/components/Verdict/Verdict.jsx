import { CRITERIA, useGameStore } from "../../store/gameStore";
import TranscriptFeed from "../Courtroom/TranscriptFeed";
import "./Verdict.css";

export default function Verdict() {
  const { verdict, scores, petitionerName, respondentName, resetGame, selectedCase } = useGameStore();
  if (!verdict) return null;
  const names = { petitioner: petitionerName, respondent: respondentName };
  return <main className="verdict-bg"><div className="verdict-container">
    <p>HEARING COMPLETE · THREE ROUNDS</p><h1>{selectedCase.title}</h1>
    <p>{verdict.winnerSide ? `${names[verdict.winnerSide]} leads by ${verdict.margin} points.` : "Both sides finished on the same overall score. Neither side is declared the winner."}</p>
    {["petitioner", "respondent"].map((side) => <section key={side}><h2>{names[side]} · {scores[side].total}/100</h2>{Object.entries(CRITERIA).map(([key, label]) => <p key={key}>{label}: {scores[side][key]?.toFixed(1) ?? "Not assessed"}</p>)}</section>)}
    <button onClick={resetGame}>Try another matter</button><TranscriptFeed />
  </div></main>;
}
