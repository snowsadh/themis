import { useEffect, useState } from 'react';

export default function ScorePanel({ petitioner, respondent }) {
  const [animP, setAnimP] = useState(0);
  const [animR, setAnimR] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setAnimP(petitioner.total), 200);
    return () => clearTimeout(t);
  }, [petitioner.total]);

  useEffect(() => {
    const t = setTimeout(() => setAnimR(respondent.total), 200);
    return () => clearTimeout(t);
  }, [respondent.total]);

  const pLead = petitioner.total > respondent.total;
  const tied = petitioner.total === respondent.total;

  return (
    <div className="score-panel">
      {/* Petitioner score */}
      <div className="score-side petitioner-score-side">
        <div className="score-side-name">{petitioner.name}</div>
        <div className="score-big petitioner-score-big">{animP}</div>
        <div className="score-bar-outer">
          <div
            className="score-bar-inner petitioner-bar"
            style={{ width: `${animP}%`, transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)' }}
          />
        </div>
        <div className="score-cats">
          <span>L:{petitioner.logic}</span>
          <span>C:{petitioner.clarity}</span>
          <span>Cf:{petitioner.confidence}</span>
        </div>
        {pLead && !tied && <div className="leading-badge petitioner-lead">LEADING ↑</div>}
      </div>

      {/* Center vs */}
      <div className="score-center">
        <div className="score-vs">VS</div>
        <div className="score-total-label">LIVE SCORE</div>
        {tied && <div className="tied-badge">TIED</div>}
      </div>

      {/* Respondent score */}
      <div className="score-side respondent-score-side">
        <div className="score-bar-outer">
          <div
            className="score-bar-inner respondent-bar"
            style={{ width: `${animR}%`, transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)' }}
          />
        </div>
        <div className="score-big respondent-score-big">{animR}</div>
        <div className="score-side-name">{respondent.name}</div>
        <div className="score-cats">
          <span>L:{respondent.logic}</span>
          <span>C:{respondent.clarity}</span>
          <span>Cf:{respondent.confidence}</span>
        </div>
        {!pLead && !tied && <div className="leading-badge respondent-lead">LEADING ↑</div>}
      </div>
    </div>
  );
}
