import { useEffect, useRef, useState, useCallback } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useJudge } from '../../hooks/useJudge';
import ScorePanel from './ScorePanel';
import JudgePanel from './JudgePanel';
import CounselPanel from './CounselPanel';
import TimerBar from './TimerBar';
import TensionBar from './TensionBar';
import TranscriptFeed from './TranscriptFeed';
import TopBar from './TopBar';
import ObjectionOverlay from './ObjectionOverlay';
import './Courtroom.css';

export default function Courtroom() {
  const {
    matchMode,
    turnState, timer, timerActive, tickTimer, setTurn,
    petitionerName, respondentName, selectedCase,
    scores, roundNumber, maxRounds, nextRound, setObjection, clearObjection, objectionActive,
    setJudgeMessage, clearJudge, addTranscript, isInterrupting, judgeInterruptContext
  } = useGameStore();

  const { processArgument, isProcessing, getOpeningStatement } = useJudge();
  const timerRef = useRef(null);
  const [hasOpened, setHasOpened] = useState(false);

  // Opening statement from judge on mount
  useEffect(() => {
    if (!hasOpened) {
      setHasOpened(true);
      const opening = getOpeningStatement();
      setJudgeMessage(opening);
      addTranscript({ type: 'judge', text: opening });
      setTimeout(() => {
        clearJudge();
        setTurn('PETITIONER');
      }, 4000);
    }
  }, []);

  // Timer countdown
  useEffect(() => {
    if (timerActive) {
      timerRef.current = setInterval(() => {
        tickTimer();
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [timerActive, tickTimer]);

  // Timer expiry
  useEffect(() => {
    if (timer === 0 && timerActive) {
      if (turnState === 'PETITIONER' || turnState === 'RESPONDENT') {
        setJudgeMessage("Time's up, Counsel. Your time has expired.", true);
        addTranscript({ type: 'judge', text: "Time's up, Counsel. Your time has expired." });
        setTimeout(() => {
          clearJudge();
          nextRound();
        }, 2500);
      }
    }
  }, [timer]);

  // Timer pressure at 10s
  useEffect(() => {
    if (timer === 10 && timerActive && (turnState === 'PETITIONER' || turnState === 'RESPONDENT')) {
      setJudgeMessage("Counsel, you have 10 seconds remaining.", true);
      setTimeout(() => clearJudge(), 2000);
    }
  }, [timer]);

  const handleSubmit = useCallback(async (text, side) => {
    if (isProcessing) return;
    await processArgument(text, side);
  }, [processArgument, isProcessing]);

  const handleObjection = (side) => {
    setObjection(side);
    addTranscript({ type: 'objection', text: `OBJECTION! raised by ${side === 'petitioner' ? petitionerName : respondentName}`, side });
    setTimeout(() => {
      clearObjection();
      setJudgeMessage("Objection noted. Counsel, respond to the objection.", false);
      addTranscript({ type: 'judge', text: 'Objection noted. Counsel, respond to the objection.' });
      setTimeout(() => clearJudge(), 3000);
    }, 2000);
  };

  const isJudgeTurn = turnState === 'JUDGE';
  const isPetitionerTurn = turnState === 'PETITIONER';
  const isRespondentTurn = turnState === 'RESPONDENT';

  return (
    <div className="courtroom-bg">
      {/* Ambient particles */}
      <div className="courtroom-particles" />

      {/* Top bar */}
      <TopBar
        roundNumber={roundNumber}
        maxRounds={maxRounds}
        caseName={selectedCase?.title}
        caseCategory={selectedCase?.category}
        matchMode={matchMode}
      />

      {/* Timer */}
      <TimerBar
        timer={timer}
        isActive={timerActive && !isJudgeTurn}
        turnState={turnState}
        isInterrupting={isInterrupting}
        interruptContext={judgeInterruptContext}
      />

      {/* Tension Bar */}
      <div style={{ padding: '0 24px' }}>
        <TensionBar />
      </div>

      {/* Objection overlay */}
      {objectionActive && <ObjectionOverlay side={objectionActive} name={objectionActive === 'petitioner' ? petitionerName : respondentName} />}

      {/* Main arena */}
      <div className="courtroom-arena">
        {/* Petitioner */}
        <CounselPanel
          side="petitioner"
          name={petitionerName}
          isActive={isPetitionerTurn}
          isDisabled={!isPetitionerTurn || isProcessing}
          isBotControlled={false}
          scores={scores.petitioner}
          onSubmit={(text) => handleSubmit(text, 'petitioner')}
          onObjection={() => handleObjection('petitioner')}
          canObjection={isRespondentTurn}
        />

        {/* Judge */}
        <JudgePanel />

        {/* Respondent */}
        <CounselPanel
          side="respondent"
          name={matchMode === '1VBOT' ? `${respondentName} (BOT)` : respondentName}
          isActive={isRespondentTurn}
          isDisabled={!isRespondentTurn || isProcessing}
          isBotControlled={matchMode === '1VBOT'}
          scores={scores.respondent}
          onSubmit={(text) => handleSubmit(text, 'respondent')}
          onObjection={() => handleObjection('respondent')}
          canObjection={isPetitionerTurn}
        />
      </div>

      {/* Score bars */}
      <ScorePanel
        petitioner={{ name: petitionerName, ...scores.petitioner }}
        respondent={{ name: respondentName, ...scores.respondent }}
      />

      {/* Transcript */}
      <TranscriptFeed />

      {/* Courtroom pillars (decorative) */}
      <div className="pillar pillar-left" />
      <div className="pillar pillar-right" />
    </div>
  );
}
