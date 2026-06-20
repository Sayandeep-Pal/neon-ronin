import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Swords, Sparkles } from 'lucide-react';

interface CalibrationCheckProps {
  detectedGesture: string;
  blockActive: boolean;
  onStartGame: () => void;
  onBackToLobby: () => void;
}

export function CalibrationCheck({
  detectedGesture,
  blockActive,
  onStartGame,
  onBackToLobby
}: CalibrationCheckProps) {
  const [checklist, setChecklist] = useState({
    horizontal: false,
    vertical: false,
    diagonal: false,
    thrust: false,
    block: false,
  });

  // Track gestures performed
  useEffect(() => {
    if (detectedGesture) {
      const g = detectedGesture.toLowerCase();
      if (g in checklist) {
        setChecklist(prev => ({ ...prev, [g]: true }));
      }
    }
  }, [detectedGesture, checklist]);

  // Track blocking stance
  useEffect(() => {
    if (blockActive) {
      setChecklist(prev => ({ ...prev, block: true }));
    }
  }, [blockActive]);

  const allCompleted = Object.values(checklist).every(v => v);

  const getItemStyle = (completed: boolean, activeColor: string) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    background: completed ? `rgba(${activeColor}, 0.08)` : 'rgba(255, 255, 255, 0.02)',
    border: `1px solid ${completed ? `rgba(${activeColor}, 0.3)` : 'rgba(255, 255, 255, 0.05)'}`,
    borderRadius: '6px',
    fontSize: '0.85rem',
    color: completed ? '#ffffff' : 'var(--text-secondary)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: completed ? `0 0 10px rgba(${activeColor}, 0.1)` : 'none',
  });

  return (
    <div className="calibration-screen" style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px',
      boxSizing: 'border-box',
      background: 'rgba(3, 3, 8, 0.85)',
      backdropFilter: 'blur(10px)',
      zIndex: 10
    }}>
      <div className="calibration-header" style={{ textAlign: 'center', marginBottom: '35px' }}>
        <h1 className="lobby-title" style={{ fontSize: '2.5rem', margin: '0 0 10px 0', textShadow: '0 0 20px rgba(0, 240, 255, 0.3)' }}>Katana Calibration</h1>
        <h2 className="lobby-subtitle" style={{ fontSize: '0.85rem', margin: 0, letterSpacing: '1px', textTransform: 'uppercase' }}>Verify Motion tracking sync before entering the arena</h2>
      </div>

      <div className="calibration-body" style={{
        display: 'flex',
        gap: '40px',
        maxWidth: '900px',
        width: '100%',
        justifyContent: 'center',
        alignItems: 'stretch'
      }}>
        {/* Left side checklist */}
        <div className="lobby-panel" style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '15px',
          background: 'var(--panel-bg)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '24px',
          boxSizing: 'border-box'
        }}>
          <div className="subtitle" style={{
            fontSize: '0.8rem',
            fontWeight: 700,
            letterSpacing: '1.5px',
            alignSelf: 'flex-start',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            width: '100%',
            paddingBottom: '10px',
            marginBottom: '5px'
          }}>
            SLASH CHECKLIST
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
            {/* Horizontal: 0, 240, 255 (neon-blue) */}
            <div style={getItemStyle(checklist.horizontal, '0, 240, 255')}>
              {checklist.horizontal ? <CheckCircle2 size={16} color="#00f0ff" /> : <Circle size={16} color="var(--text-secondary)" />}
              <span>Horizontal Slash (← →)</span>
            </div>

            {/* Vertical: 176, 38, 255 (neon-purple) */}
            <div style={getItemStyle(checklist.vertical, '176, 38, 255')}>
              {checklist.vertical ? <CheckCircle2 size={16} color="#b026ff" /> : <Circle size={16} color="var(--text-secondary)" />}
              <span>Vertical Slash (↑ ↓)</span>
            </div>

            {/* Diagonal: 255, 0, 127 (neon-pink) */}
            <div style={getItemStyle(checklist.diagonal, '255, 0, 127')}>
              {checklist.diagonal ? <CheckCircle2 size={16} color="#ff007f" /> : <Circle size={16} color="var(--text-secondary)" />}
              <span>Diagonal Slash (↘ ↖)</span>
            </div>

            {/* Thrust: 255, 170, 0 (orange) */}
            <div style={getItemStyle(checklist.thrust, '255, 170, 0')}>
              {checklist.thrust ? <CheckCircle2 size={16} color="#ffaa00" /> : <Circle size={16} color="var(--text-secondary)" />}
              <span>Forward Thrust (▶)</span>
            </div>

            {/* Block: 125, 249, 255 (cyan block) */}
            <div style={getItemStyle(checklist.block, '125, 249, 255')}>
              {checklist.block ? <CheckCircle2 size={16} color="#7df9ff" /> : <Circle size={16} color="var(--text-secondary)" />}
              <span>Defense Block (⛊)</span>
            </div>
          </div>

          <div style={{
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
            textAlign: 'center',
            marginTop: '15px',
            lineHeight: '1.5',
            background: 'rgba(255, 255, 255, 0.02)',
            padding: '12px',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.04)'
          }}>
            {blockActive ? (
              <span style={{ color: '#7df9ff', fontWeight: 'bold', animation: 'pulse 1s infinite' }}>🛡️ BLOCK SHIELD ACTIVE (UPRIGHT)</span>
            ) : (
              <span>Swing your phone horizontally, vertically, or diagonally. Hold phone upright to test blocking.</span>
            )}
          </div>
        </div>

        {/* Right side instruction overlay */}
        <div className="lobby-panel" style={{
          flex: 1,
          background: 'var(--panel-bg)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '30px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '25px', textAlign: 'center', width: '100%' }}>
            {allCompleted ? (
              <>
                <Sparkles size={54} color="#ff007f" style={{ filter: 'drop-shadow(0 0 15px #ff007f)', animation: 'sword-glow 1s infinite alternate' }} />
                <span className="subtitle" style={{ color: 'var(--neon-pink)', fontSize: '0.95rem', fontWeight: 'bold', letterSpacing: '3px' }}>
                  KATANA FULLY CALIBRATED
                </span>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.6' }}>
                  Link verified. The gyroscopic mapping matrices are aligned. Prepare to defend Neo-Tokyo from the incoming AI swarm.
                </p>
              </>
            ) : (
              <>
                <Swords size={54} color="#00f0ff" style={{ filter: 'drop-shadow(0 0 15px #00f0ff)', animation: 'sword-glow 2s infinite alternate' }} />
                <span className="subtitle" style={{ color: 'var(--neon-blue)', fontSize: '0.9rem', letterSpacing: '2px', fontWeight: 'bold' }}>
                  AWAITING KATANA SIGNAL
                </span>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.6' }}>
                  Stand directly in front of the screen. Hold your phone like a sword hilt and tap <strong>Calibrate</strong> on your phone.
                </p>
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: '15px', width: '100%', marginTop: '30px' }}>
            <button className="cyber-btn" style={{ flex: 1, padding: '14px' }} onClick={onBackToLobby}>
              Exit Dojo Link
            </button>
            <button
              className="cyber-btn pink"
              style={{
                flex: 1.5,
                padding: '14px',
                opacity: allCompleted ? 1 : 0.65,
                boxShadow: allCompleted ? '0 0 15px var(--neon-pink)' : 'none',
                transition: 'all 0.3s ease'
              }}
              onClick={onStartGame}
            >
              Enter Dojo Arena
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
