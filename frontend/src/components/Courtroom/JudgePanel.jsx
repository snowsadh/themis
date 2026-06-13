import { useGameStore } from '../../store/gameStore';
import { useEffect, useState } from 'react';
import { highlightLegalTerms } from '../../utils/formatters';

export default function JudgePanel() {
  const { judgeMessage, isJudgeSpeaking, isInterrupting, judgeInterruptContext, turnState } = useGameStore();
  const [displayText, setDisplayText] = useState('');
  const [charIdx, setCharIdx] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (judgeMessage) {
      setDisplayText('');
      setCharIdx(0);
    }
  }, [judgeMessage]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!judgeMessage) { setDisplayText(''); return; }
    if (charIdx < judgeMessage.length) {
      const t = setTimeout(() => {
        setDisplayText(prev => prev + judgeMessage[charIdx]);
        setCharIdx(c => c + 1);
      }, 25);
      return () => clearTimeout(t);
    }
  }, [charIdx, judgeMessage]);

  const isSpeaking = isJudgeSpeaking && judgeMessage;

  return (
    <div className={`judge-panel ${isSpeaking ? 'judge-active glow-border' : ''} ${isInterrupting ? 'judge-interrupt' : ''}`}>
      {/* Judge avatar */}
      <div className={`judge-avatar-wrap ${isSpeaking ? 'avatar-glow' : ''}`}>
        <div className="judge-avatar">
          <span className="judge-avatar-icon">👨‍⚖️</span>
        </div>
        {isSpeaking && (
          <div className="audio-visualizer">
            <div className="bar bar1" />
            <div className="bar bar2" />
            <div className="bar bar3" />
            <div className="bar bar4" />
            <div className="bar bar5" />
          </div>
        )}
      </div>

      {/* Title */}
      <div className="judge-title-wrap">
        <div className="judge-title-badge">
          {isInterrupting ? '🔔 INTERRUPTION' : isSpeaking ? '⚖️ THE BENCH' : '⚖️ HON\'BLE BENCH'}
        </div>
        <div className="judge-name">AI JUDGE</div>
      </div>

      {/* Speech bubble */}
      <div className={`judge-speech ${isSpeaking ? 'speech-active' : 'speech-idle'} ${isInterrupting ? 'speech-interrupt' : ''}`}>
        {isSpeaking ? (
          <>
            <div className="speech-text">{highlightLegalTerms(displayText)}<span className="speech-cursor">|</span></div>
            {isInterrupting && (
              <div className="interrupt-badge">
                {judgeInterruptContext
                  ? `⚠️ Clarification requested (${judgeInterruptContext.attempt}/${judgeInterruptContext.max})`
                  : '⚠️ INTERRUPT'}
              </div>
            )}
          </>
        ) : (
          <div className="speech-idle-text">
            {turnState === 'PETITIONER' ? 'Awaiting Petitioner...' :
             turnState === 'RESPONDENT' ? 'Awaiting Respondent...' :
             'Court is in session'}
          </div>
        )}
      </div>

      {/* Gavel */}
      <div className={`gavel-wrap ${isInterrupting ? 'gavel-strike' : ''}`}>
        <span className="gavel-icon">🔨</span>
      </div>
    </div>
  );
}
