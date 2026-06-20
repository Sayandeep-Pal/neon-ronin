import type React from 'react';
import { Activity } from 'lucide-react';
import type { SensorData } from '../types';

interface GameHUDProps {
  health: number;
  combo: number;
  score: number;
  wave: number;
  detectedGesture: string;
  latestSensor: React.MutableRefObject<SensorData>;
  blockActive: boolean;
}

export function GameHUD({
  health,
  combo,
  score,
  wave,
  detectedGesture,
  latestSensor,
  blockActive
}: GameHUDProps) {
  return (
    <>
      {/* Main game HUD: HP, Score, Wave */}
      <div className="game-hud">
        <div className="hud-group">
          <div className="hud-item">
            <div className="hud-label">Ronin Health</div>
            <div className="hud-health-bar">
              <div className="hud-health-fill" style={{ width: `${health}%` }} />
            </div>
          </div>
        </div>

        <div className="hud-group" style={{ alignItems: 'center' }}>
          {combo >= 3 && (
            <div className="combo-badge">
              {combo}X COMBO
            </div>
          )}
        </div>

        <div className="hud-group" style={{ flexDirection: 'row', gap: '12px' }}>
          <div className="hud-item" style={{ minWidth: '120px' }}>
            <div className="hud-label">Score</div>
            <div className="hud-value" style={{ color: 'var(--neon-blue)' }}>{score}</div>
          </div>
          <div className="hud-item" style={{ minWidth: '100px' }}>
            <div className="hud-label">Wave</div>
            <div className="hud-value" style={{ color: 'var(--neon-pink)' }}>{wave}</div>
          </div>
        </div>
      </div>

      {/* Gesture classifier text indicator banner */}
      <div id="gesture-banner" className="gesture-banner">
        {detectedGesture}
      </div>

      {/* Live Developer Telemetry Dashboard */}
      <div className="telemetry-overlay">
        <div className="telemetry-header">
          <span>Sensor Dashboard</span>
          <Activity size={12} style={{ animation: 'grid-glow 1s infinite' }} />
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Status:</span>
            <span style={{ color: '#33ff33', fontWeight: 'bold' }}>Katana Linked</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Yaw / Pitch / Roll:</span>
            <span style={{ fontFamily: 'var(--font-display)' }}>
              {latestSensor.current.rotation.alpha}° / {latestSensor.current.rotation.beta}° / {latestSensor.current.rotation.gamma}°
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Linear Acceleration:</span>
            <span style={{ fontFamily: 'var(--font-display)' }}>
              {latestSensor.current.accel.x} / {latestSensor.current.accel.y} / {latestSensor.current.accel.z}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Guard Stance:</span>
            <span style={{ color: blockActive ? 'var(--neon-purple)' : 'var(--text-secondary)', fontWeight: 'bold' }}>
              {blockActive ? 'BLOCK ACTIVE' : 'UNGUARDED'}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
