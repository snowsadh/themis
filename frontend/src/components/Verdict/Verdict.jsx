import { useGameStore } from '../../store/gameStore';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import './Verdict.css';

function toTitle(text) {
  return String(text || '')
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function RubricDiagnostics({ title, accentClass, breakdown }) {
  const diagnostics = breakdown?.diagnostics;
  if (!diagnostics || Object.keys(diagnostics).length === 0) return null;

  return (
    <div className={`rubric-side-card ${accentClass}`}>
      <div className="rubric-side-title">{title}</div>
      {Object.entries(diagnostics).map(([dimension, criteria]) => (
        <div key={dimension} className="rubric-dimension-group">
          <div className="rubric-dimension-name">{toTitle(dimension)}</div>
          {Object.entries(criteria || {}).map(([criterion, value]) => (
            <div key={`${dimension}-${criterion}`} className="rubric-criterion-row">
              <span>{toTitle(criterion)}</span>
              <span>{value}/10</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function Verdict() {
  const { verdict, scores, petitionerName, respondentName, resetGame, selectedCase, theme, toggleTheme } = useGameStore();

  if (!verdict) return null;

  const isPetitionerWinner = verdict.winner === petitionerName;

  const radarData = [
    { subject: 'Logic', A: scores.petitioner.logic * 10, B: scores.respondent.logic * 10, fullMark: 100 },
    { subject: 'Clarity', A: scores.petitioner.clarity * 10, B: scores.respondent.clarity * 10, fullMark: 100 },
    { subject: 'Confidence', A: scores.petitioner.confidence * 10, B: scores.respondent.confidence * 10, fullMark: 100 },
    { subject: 'Overall', A: verdict.petitionerScore, B: verdict.respondentScore, fullMark: 100 }
  ];

  return (
    <div className="verdict-bg">
      <div className="verdict-particles" />
      <div className="verdict-rays" />

      <div className="verdict-container fade-in">
        {/* Header */}
        <div className="verdict-header" style={{ position: 'relative' }}>
          <div className="court-seal">🏛️</div>
          <div className="verdict-header-text">
            <div className="verdict-court-name">In the Supreme Court of India</div>
            <div className="verdict-case-name">{selectedCase?.title}</div>
            <div className="verdict-case-sub">{selectedCase?.subtitle}</div>
          </div>
          <button 
            className="theme-toggle-btn" 
            onClick={toggleTheme} 
            title="Toggle Theme"
            style={{ position: 'absolute', right: 0, top: 0 }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>

        {/* Judgment stamp */}
        <div className="verdict-stamp-wrap">
          <div className={`verdict-stamp ${verdict.decision === 'ALLOWED' ? 'stamp-allowed' : 'stamp-dismissed'}`}>
            <div className="stamp-inner">
              <div className="stamp-decision">{verdict.decision}</div>
              <div className="stamp-sub">JUDGMENT PRONOUNCED</div>
            </div>
          </div>
        </div>

        {/* Winner */}
        <div className="verdict-winner-wrap">
          <div className="winner-icon">👑</div>
          <div className="winner-label">WINNER</div>
          <div className="winner-name">
            {verdict.winner}
          </div>
          <div className={`winner-side-badge ${isPetitionerWinner ? 'winner-petitioner' : 'winner-respondent'}`}>
            {isPetitionerWinner ? 'PETITIONER / APPELLANT' : 'RESPONDENT / APPELLEE'}
          </div>
        </div>

        {/* Score breakdown */}
        <div className="verdict-scores">
          <div className={`verdict-score-card ${isPetitionerWinner ? 'winner-card glow-border' : ''} petitioner-verdict-card`}>
            <div className="vsc-role">PETITIONER</div>
            <div className="vsc-name">{petitionerName}</div>
            <div className="vsc-total" style={{ color: '#4a90d9' }}>{verdict.petitionerScore}</div>
            <div className="vsc-label">/ 100</div>
            <div className="vsc-breakdown">
              <div className="vsc-item"><span>Logic</span><span>{scores.petitioner.logic}</span></div>
              <div className="vsc-item"><span>Clarity</span><span>{scores.petitioner.clarity}</span></div>
              <div className="vsc-item"><span>Confidence</span><span>{scores.petitioner.confidence}</span></div>
            </div>
            {isPetitionerWinner && <div className="vsc-winner-crown">👑</div>}
          </div>

          <div className="verdict-vs">VS</div>

          <div className={`verdict-score-card ${!isPetitionerWinner ? 'winner-card glow-border' : ''} respondent-verdict-card`}>
            <div className="vsc-role">RESPONDENT</div>
            <div className="vsc-name">{respondentName}</div>
            <div className="vsc-total" style={{ color: '#e05c5c' }}>{verdict.respondentScore}</div>
            <div className="vsc-label">/ 100</div>
            <div className="vsc-breakdown">
              <div className="vsc-item"><span>Logic</span><span>{scores.respondent.logic}</span></div>
              <div className="vsc-item"><span>Clarity</span><span>{scores.respondent.clarity}</span></div>
              <div className="vsc-item"><span>Confidence</span><span>{scores.respondent.confidence}</span></div>
            </div>
            {!isPetitionerWinner && <div className="vsc-winner-crown">👑</div>}
          </div>
        </div>

        {/* Reasoning */}
        <div className="verdict-reasoning">
          <div className="reasoning-label">JUDGMENT</div>
          <div className="reasoning-text">"{verdict.reasoning}"</div>
          <div className="reasoning-margin">Margin of victory: <strong>{verdict.margin} points</strong></div>
        </div>

        {(scores.petitioner.reasoning_breakdown || scores.respondent.reasoning_breakdown) && (
          <div className="verdict-rubric-wrap">
            <div className="reasoning-label" style={{ marginBottom: 8 }}>RUBRIC DIAGNOSTICS</div>
            <div className="verdict-rubric-grid">
              <RubricDiagnostics
                title={petitionerName}
                accentClass="rubric-petitioner"
                breakdown={scores.petitioner.reasoning_breakdown}
              />
              <RubricDiagnostics
                title={respondentName}
                accentClass="rubric-respondent"
                breakdown={scores.respondent.reasoning_breakdown}
              />
            </div>
          </div>
        )}

        {/* Analytics Radar Chart */}
        <div style={{ width: '100%', height: 360, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 24, padding: 20 }}>
          <div className="reasoning-label" style={{ textAlign: 'center', marginBottom: 10 }}>PERFORMANCE ANALYTICS</div>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
              <PolarGrid stroke="var(--glass-border)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name={petitionerName} dataKey="A" stroke="#4a90d9" fill="#4a90d9" fillOpacity={0.3} />
              <Radar name={respondentName} dataKey="B" stroke="#e05c5c" fill="#e05c5c" fillOpacity={0.3} />
              <Legend />
              <Tooltip contentStyle={{ background: 'var(--panel-bg)', borderColor: 'var(--glass-border)', borderRadius: 8 }} itemStyle={{ color: 'var(--text-primary)' }}/>
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Actions */}
        <div className="verdict-actions">
          <button className="verdict-reset-btn" onClick={resetGame}>
            ↩ New Session
          </button>
          <button className="verdict-share-btn" onClick={() => window.print()}>
            🖨️ Print Verdict
          </button>
        </div>

        {/* Footer */}
        <div className="verdict-footer">
          <div className="footer-seal">⚖</div>
          <div className="footer-text">This verdict was pronounced by the AI Hon'ble Bench of the Moot Court Simulator</div>
          <div className="footer-seal">⚖</div>
        </div>
      </div>
    </div>
  );
}
