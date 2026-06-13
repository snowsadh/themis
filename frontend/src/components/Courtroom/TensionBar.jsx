import React from 'react';
import { useGameStore } from '../../store/gameStore';

export default function TensionBar() {
  const { scores, petitionerName, respondentName } = useGameStore();
  const pScore = scores.petitioner.total;
  const rScore = scores.respondent.total;
  
  // Win ratio (1 means petitioner is completely dominating)
  let ratio = 0.5;
  if (pScore > 0 || rScore > 0) {
    ratio = pScore / (pScore + rScore);
  }

  // Knot position (0% = fully left, 100% = fully right)
  const knotPos = 100 - (ratio * 100); 

  // How much they lean based on who is pulling harder.
  // When knot < 50, Petitioner leans back (-deg), Respondent is dragged forward (-deg)
  const leanAngle = (knotPos - 50) * 0.9;
  
  // High tension if the scores are close and greater than 0
  const isStraining = pScore > 0 && Math.abs(pScore - rScore) < 20;

  return (
    <div className="tension-bar-wrapper" style={{ padding: '10px 0', position: 'relative' }}>
      <style>{`
        @keyframes strain {
          0% { transform: translateY(0) rotate(var(--lean-angle)); }
          50% { transform: translateY(-2px) rotate(calc(var(--lean-angle) + 2deg)); }
          100% { transform: translateY(0) rotate(calc(var(--lean-angle) - 2deg)); }
        }
      `}</style>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        
        {/* Petitioner Cartoon Figure */}
        <div style={{ 
          fontSize: '48px', 
          zIndex: 2, 
          '--lean-angle': `${leanAngle}deg`,
          transform: `rotate(${leanAngle}deg)`,
          transition: 'transform 1s cubic-bezier(0.16, 1, 0.3, 1)',
          transformOrigin: 'bottom right',
          animation: isStraining ? 'strain 0.5s infinite' : 'none',
          textShadow: '0 0 15px rgba(74,144,217,0.6)'
        }} title={petitionerName}>
          🦸‍♂️
        </div>

        {/* The Rope */}
        <div style={{ 
          flex: 1, 
          height: '6px', 
          background: `linear-gradient(90deg, #4a90d9 ${knotPos}%, #e05c5c ${knotPos}%)`, 
          position: 'relative',
          borderRadius: '3px',
          margin: '0 -5px',
          zIndex: 1,
          boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
          transition: 'background 1s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          {/* The Knot */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: `${knotPos}%`,
            transform: 'translate(-50%, -50%)',
            width: '24px',
            height: '24px',
            background: '#ffcc00',
            borderRadius: '50%',
            border: '4px solid #fff',
            boxShadow: '0 0 15px rgba(255, 204, 0, 0.8)',
            transition: 'left 1s cubic-bezier(0.16, 1, 0.3, 1)'
          }} />
        </div>

        {/* Respondent Cartoon Figure */}
        <div style={{ 
          fontSize: '48px', 
          zIndex: 2, 
          '--lean-angle': `${leanAngle}deg`,
          transform: `scaleX(-1) rotate(${-leanAngle}deg)`,
          transition: 'transform 1s cubic-bezier(0.16, 1, 0.3, 1)',
          transformOrigin: 'bottom right',
          animation: isStraining ? 'strain 0.5s infinite' : 'none',
          textShadow: '0 0 15px rgba(224,92,92,0.6)'
        }} title={respondentName}>
          🦹‍♂️
        </div>
        
      </div>
      
      {/* Informative Label */}
      <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '2px' }}>
        Courtroom Tension
      </div>
    </div>
  );
}
