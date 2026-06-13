import { useMemo, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { CASES } from '../../data/cases';
import './Lobby.css';

function TiltCard({ children, className }) {
  const x = useMotionValue(200);
  const y = useMotionValue(200);
  const rotateX = useTransform(y, [0, 400], [10, -10]);
  const rotateY = useTransform(x, [0, 400], [-10, 10]);

  function handleMouse(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    x.set(e.clientX - rect.left);
    y.set(e.clientY - rect.top);
  }

  return (
    <motion.div
      className={className}
      onMouseMove={handleMouse}
      onMouseLeave={() => { x.set(200); y.set(200); }}
      style={{ rotateX, rotateY, transformPerspective: 1000 }}
    >
      {children}
    </motion.div>
  );
}

export default function Lobby() {
  const { 
    setPetitionerName, setRespondentName, setSelectedCase, startGame, setMatchMode, setSessionProfile,
    petitionerName, respondentName, selectedCase, matchMode,
    theme, toggleTheme
  } = useGameStore();
  const [step, setStep] = useState(0); // 0=welcome, 1=mode, 2=case-select, 3=auth/names
  const [localCase, setLocalCase] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [roomCode, setRoomCode] = useState('');

  const modeCards = useMemo(() => ([
    {
      id: '1V1',
      title: '1V1',
      subtitle: 'Current local mode',
      description: 'Two counsel share the courtroom on the same device. This is the current default flow.',
    },
    {
      id: '1VBOT',
      title: '1VBot',
      subtitle: 'Play against AI counsel',
      description: 'You argue one side, and the opposing counsel is auto-generated from the case record.',
    },
    {
      id: 'ONLINE',
      title: 'Online Custom Room',
      subtitle: 'Host or join with friends',
      description: 'Create a private room, sign in, or continue as a guest to set up a shared match.',
    },
  ]), []);

  const selectedModeCard = modeCards.find((card) => card.id === matchMode);

  const handleModeSelect = (mode) => {
    setMatchMode(mode);
  };

  const handleContinueAsGuest = () => {
    if (!localCase) return;
    const guestName = displayName.trim() || 'Guest Counsel';
    setSessionProfile({
      accessMode: 'guest',
      displayName: guestName,
      email: '',
      roomCode: roomCode.trim().toUpperCase(),
    });
    setPetitionerName(guestName);
    setRespondentName('Room Opponent');
    setSelectedCase(localCase);
    startGame({
      matchMode,
      selectedCase: localCase,
      petitionerName: guestName,
      respondentName: 'Room Opponent',
    });
  };

  const handleLoginContinue = () => {
    if (!localCase) return;
    const signedInName = displayName.trim() || 'Host Counsel';
    setSessionProfile({
      accessMode: 'signed-in',
      displayName: signedInName,
      email: email.trim(),
      roomCode: roomCode.trim().toUpperCase(),
    });
    setPetitionerName(signedInName);
    setRespondentName('Room Opponent');
    setSelectedCase(localCase);
    startGame({
      matchMode,
      selectedCase: localCase,
      petitionerName: signedInName,
      respondentName: 'Room Opponent',
    });
  };

  const handleNext = () => {
    setStep(2);
  };

  const handleProceedFromCase = () => {
    if (!localCase) return;
    setSelectedCase(localCase);
    setStep(3);
  };

  const handleStart = () => {
    if (!localCase) return;
    setSelectedCase(localCase);
    if (matchMode === '1VBOT') {
      startGame({
        matchMode,
        selectedCase: localCase,
        petitionerName: petitionerName.trim() || 'Petitioner Counsel',
        respondentName: 'AI Opponent',
      });
      return;
    }

    if (matchMode === 'ONLINE') {
      startGame({
        matchMode,
        selectedCase: localCase,
        petitionerName: petitionerName.trim() || 'Host Counsel',
        respondentName: respondentName.trim() || 'Guest Counsel',
      });
      return;
    }

    startGame({
      matchMode,
      selectedCase: localCase,
      petitionerName: petitionerName.trim() || 'Counsel A',
      respondentName: respondentName.trim() || 'Counsel B',
    });
  };

  return (
    <div className="lobby-bg">
      <div className="lobby-stars" />
      <div className="lobby-orb" />
      <div className="lobby-overlay" />

      {/* Header */}
      <header className="lobby-header">
        <div className="lobby-logo">
          <span className="logo-icon">⚖️</span>
          <span className="logo-text">THEMIS.AI</span>
        </div>
        <div>
          <h1 className="lobby-title">Moot Court</h1>
          <p className="lobby-subtitle">Hon'ble Supreme Court of India — Simulator</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="lobby-mode-pill">{selectedModeCard?.title || '1V1'}</div>
          <button className="theme-toggle-btn" onClick={toggleTheme} title="Toggle Theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <main className="lobby-main" style={{ paddingBottom: '60px' }}>
        {step === 0 && (
          <TiltCard className="lobby-card glow-border fade-in">
            <div className="lobby-emblem">🏛️</div>
            <h2 className="lobby-card-title">IN THE SUPREME COURT OF INDIA</h2>
            <p className="lobby-card-subtitle">Constitutional & Civil Appellate Jurisdiction</p>
            <div className="lobby-divider" />
            
            <p className="lobby-desc">
              Step into the highest court of the land. Our advanced AI Hon'ble Bench will evaluate your
              arguments, logical structuring, and application of constitutional precedents in real-time.
            </p>
            
            <div className="lobby-features">
              <span className="feature-pill">1v1 local</span>
              <span className="feature-pill">1vBot</span>
              <span className="feature-pill">Online custom room</span>
            </div>

            <button className="btn-primary" onClick={() => setStep(1)}>
              ENTER APPEARANCE ➔
            </button>
          </TiltCard>
        )}

        {step === 1 && (
          <TiltCard className="lobby-card wide-card glow-border fade-in">
            <h2 className="lobby-card-title">Select Match Mode</h2>
            <p className="lobby-card-subtitle">Choose how you want to enter the courtroom</p>
            <div className="lobby-divider" />
            <div className="mode-grid">
              {modeCards.map((card) => (
                <button
                  key={card.id}
                  className={`mode-card ${matchMode === card.id ? 'mode-card-selected' : ''}`}
                  onClick={() => handleModeSelect(card.id)}
                  type="button"
                >
                  <div className="mode-card-top">
                    <span className="mode-card-code">{card.title}</span>
                    {matchMode === card.id && <span className="mode-card-badge">Selected</span>}
                  </div>
                  <div className="mode-card-subtitle">{card.subtitle}</div>
                  <div className="mode-card-desc">{card.description}</div>
                </button>
              ))}
            </div>
            <div className="lobby-actions">
              <button className="btn-secondary" onClick={() => setStep(0)}>BACK</button>
              <button className="btn-primary" onClick={handleNext} disabled={!matchMode}>
                CONTINUE ➔
              </button>
            </div>
          </TiltCard>
        )}

        {step === 2 && (
          <TiltCard className="lobby-card wide-card glow-border fade-in">
            <h2 className="lobby-card-title">Select Case</h2>
            <p className="lobby-card-subtitle">Choose a moot court problem to argue</p>
            <div className="lobby-divider" />
            <div className="cases-grid">
              {CASES.map(c => (
                <div
                  key={c.id}
                  className={`case-card ${localCase?.id === c.id ? 'case-selected' : ''}`}
                  onClick={() => setLocalCase(c)}
                >
                  <div className="case-cat">{c.category}</div>
                  <h3 className="case-title">{c.title}</h3>
                  <p className="case-subtitle">{c.subtitle}</p>
                  <div className="case-difficulty-row">
                    <span className="case-difficulty">{c.difficulty}</span>
                  </div>
                  <div className="case-issues-count">{c.issues.length} Issues • {c.precedents.length} Precedents</div>
                  {localCase?.id === c.id && (
                    <div className="case-selected-badge">✓ Selected</div>
                  )}
                </div>
              ))}
            </div>
            {localCase && (
              <div className="case-preview fade-in">
                <h4>Case Brief</h4>
                <p className="case-brief-difficulty">Difficulty: {localCase.difficulty}</p>
                <p>{localCase.brief}</p>
                <p>{localCase.facts.substring(0, 200)}...</p>
              </div>
            )}
            <div className="lobby-actions">
              <button className="btn-secondary" onClick={() => setStep(1)}>BACK</button>
              <button className="btn-primary" onClick={handleProceedFromCase} disabled={!localCase}>
                {matchMode === 'ONLINE' ? 'PROCEED TO LOGIN ➔' : 'PROCEED TO COUNSEL ➔'}
              </button>
            </div>
          </TiltCard>
        )}

        {step === 3 && matchMode !== 'ONLINE' && (
          <TiltCard className="lobby-card glow-border fade-in">
            <h2 className="lobby-card-title">Identify Counsel</h2>
            <p className="lobby-card-subtitle">
              {matchMode === '1VBOT' ? 'Set your name before facing the AI opponent' : 'Enter the names for both sides'}
            </p>
            <div className="lobby-divider" />
            <div className="names-grid">
              <div className="name-field petitioner-field">
                <label>⚖️ Petitioner / Appellant</label>
                <input
                  className="name-input"
                  value={petitionerName}
                  onChange={e => setPetitionerName(e.target.value)}
                  placeholder="Counsel for Petitioner"
                  maxLength={30}
                />
                <span className="field-tag petitioner-tag">BLUE SIDE</span>
              </div>
              <div className="vs-divider">VS</div>
              <div className="name-field respondent-field">
                <label>⚖️ Respondent / Appellee</label>
                <input
                  className="name-input"
                  value={matchMode === '1VBOT' ? 'AI Opponent' : respondentName}
                  onChange={e => setRespondentName(e.target.value)}
                  placeholder="Counsel for Respondent"
                  maxLength={30}
                  disabled={matchMode === '1VBOT'}
                />
                <span className="field-tag respondent-tag">{matchMode === '1VBOT' ? 'AI SIDE' : 'RED SIDE'}</span>
              </div>
            </div>
            <div className="lobby-actions">
              <button className="btn-secondary" onClick={() => setStep(2)}>BACK</button>
              <button className="btn-primary" onClick={handleStart} disabled={!petitionerName.trim() || (matchMode !== '1VBOT' && !respondentName.trim())}>
                APPROACH THE BENCH ➔
              </button>
            </div>
          </TiltCard>
        )}

        {step === 3 && matchMode === 'ONLINE' && (
          <TiltCard className="lobby-card glow-border fade-in">
            <h2 className="lobby-card-title">Online Room Login</h2>
            <p className="lobby-card-subtitle">Sign in or continue as a guest to open a custom room</p>
            <div className="lobby-divider" />

            <div className="auth-form">
              <label className="auth-field">
                <span>Display Name</span>
                <input
                  className="name-input"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Your courtroom name"
                  maxLength={30}
                />
              </label>
              <label className="auth-field">
                <span>Email</span>
                <input
                  className="name-input"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  type="email"
                />
              </label>
              <label className="auth-field">
                <span>Room Code</span>
                <input
                  className="name-input"
                  value={roomCode}
                  onChange={(event) => setRoomCode(event.target.value)}
                  placeholder="JOIN-4821"
                  maxLength={12}
                />
              </label>
            </div>

            <div className="auth-note">
              Guest mode keeps the room flow lightweight. Login can be wired to a real backend later.
            </div>

            <div className="lobby-actions">
              <button className="btn-secondary" onClick={() => setStep(2)}>BACK</button>
              <div className="btn-row">
                <button className="btn-secondary" onClick={handleContinueAsGuest}>CONTINUE AS GUEST</button>
                <button className="btn-primary" onClick={handleLoginContinue} disabled={!displayName.trim() || !roomCode.trim()}>
                  LOGIN ➔
                </button>
              </div>
            </div>
          </TiltCard>
        )}
      </main>

      <div className="lobby-ticker">
        <div className="ticker-content">
          {[
            "🏛️ SUPREME COURT CAUSE LIST • REHEARING ON ARTICLE 21 SCHEDULED • CONTEMPT MOTIONS FILED BY COUNSEL • AI HON'BLE BENCH PRESIDING TODAY • PENDING CASES: 4,021 • COURT IS IN SESSION"
          ].map((item, i) => (
            <span key={i} className="ticker-item">{item}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
