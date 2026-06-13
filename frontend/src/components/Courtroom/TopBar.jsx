import { useGameStore } from '../../store/gameStore';

export default function TopBar({ roundNumber, maxRounds, caseName, caseCategory, matchMode }) {
  const { resetGame, theme, toggleTheme } = useGameStore();
  const modeLabel = matchMode === '1VBOT'
    ? '1vBot'
    : matchMode === 'ONLINE'
    ? 'Online Room'
    : '1v1';

  return (
    <div className="topbar">
      <div className="topbar-left">
        <div className="topbar-badge">
          <span className="topbar-icon">⚖️</span>
          <span className="topbar-label">SUPREME COURT OF INDIA</span>
        </div>
      </div>
      <div className="topbar-center">
        <div className="topbar-case-cat">{caseCategory}</div>
        <div className="topbar-case-name">{caseName}</div>
      </div>
      <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div className="topbar-mode">{modeLabel}</div>
        <div className="topbar-round">
          <span className="round-label">ROUND</span>
          <span className="round-num">{roundNumber}</span>
          <span className="round-max">/ {maxRounds}</span>
        </div>
        <button className="theme-toggle-btn" onClick={toggleTheme} title="Toggle Theme">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button className="topbar-end-btn" onClick={resetGame} title="End Session">✕ End</button>
      </div>
    </div>
  );
}
