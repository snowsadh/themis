export default function TimerBar({ timer, isActive, turnState, isInterrupting, interruptContext }) {
  const pct = (timer / 60) * 100;
  const isUrgent = timer <= 10 && isActive;
  const isWarning = timer <= 20 && timer > 10 && isActive;

  const color = isUrgent ? '#e05c5c' : isWarning ? '#e8a44a' : '#c9a84c';

  const label = turnState === 'PETITIONER' ? 'PETITIONER' : turnState === 'RESPONDENT' ? 'RESPONDENT' : 'JUDGE';
  const sideLabel = isInterrupting && interruptContext?.speaker
    ? interruptContext.speaker.toUpperCase()
    : label;

  return (
    <div className="timer-outer">
      <div className="timer-inner">
        <div className="timer-side-label" style={{ color: turnState === 'PETITIONER' ? '#4a90d9' : turnState === 'RESPONDENT' ? '#e05c5c' : '#c9a84c' }}>
          {turnState === 'JUDGE'
            ? '⚖️ JUDGE SPEAKING'
            : isInterrupting && interruptContext
            ? `🔁 ${sideLabel} CLARIFICATION (${interruptContext.attempt}/${interruptContext.max})`
            : `🎤 ${label}'S TURN`}
        </div>
        <div className="timer-bar-wrap">
          <div
            className={`timer-bar-fill ${isUrgent ? 'urgent' : ''}`}
            style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
          />
        </div>
        <div className={`timer-count ${isUrgent ? 'timer-urgent' : ''}`}>
          {isActive ? `${timer}s` : '—'}
        </div>
      </div>
    </div>
  );
}
