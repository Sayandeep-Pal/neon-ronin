import { Wifi } from 'lucide-react';
import type { GestureType } from '../types';
import { GESTURE_META } from '../constants';
import { SwordVisualizer } from './SwordVisualizer';

interface GameplayHUDProps {
  roomId: string;
  calibrateController: () => void;
  calibrated: boolean;
  gesture: GestureType;
  inCooldown: boolean;
  hudRot: { alpha: number; beta: number; gamma: number };
  hudAccel: { x: number; y: number; z: number };
  permissionState: 'prompt' | 'granted' | 'denied';
}

export function GameplayHUD({
  roomId,
  calibrateController,
  calibrated,
  gesture,
  inCooldown,
  hudRot,
  hudAccel,
  permissionState
}: GameplayHUDProps) {
  const meta = GESTURE_META[gesture];

  return (
    <>
      {/* Status bar */}
      <div className="hud-panel" style={{ flexDirection: 'row', justifyContent: 'space-between', padding: '10px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Wifi size={16} color="var(--neon-blue)" />
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--neon-blue)' }}>
            ROOM: {roomId}
          </span>
        </div>
        <button
          onClick={calibrateController}
          className={`neon-btn neon-btn-pink ${calibrated ? 'calibrated' : ''}`}
          style={{ padding: '7px 14px', fontSize: '0.72rem', animation: 'none', border: '1px solid var(--neon-pink)' }}
        >
          {calibrated ? '✓ Re-Calibrate' : 'Calibrate'}
        </button>
      </div>

      {/* Gesture feedback banner */}
      <div className={`gesture-display ${gesture !== 'IDLE' ? 'active' : ''}`}
        style={{ borderColor: meta.color, boxShadow: `0 0 20px ${meta.color}44` }}>
        {gesture !== 'IDLE' ? (
          <>
            <div className="gesture-label" style={{ color: meta.color }}>{meta.label}</div>
            <div className="gesture-hint">{meta.hint}</div>
          </>
        ) : (
          <div className="gesture-idle">
            {calibrated ? 'READY · SWING TO SLASH' : '← TAP CALIBRATE FIRST →'}
          </div>
        )}
        {/* Cooldown bar */}
        {inCooldown && (
          <div className="cooldown-bar">
            <div className="cooldown-fill" style={{ borderColor: meta.color }} />
          </div>
        )}
      </div>

      {/* 3D Katana Visualizer */}
      <SwordVisualizer hudRot={hudRot} />

      {/* Combat cheat-sheet */}
      <div className="hud-panel move-guide">
        <div className="subtitle" style={{ fontSize: '0.6rem', marginBottom: '8px' }}>KATANA TECHNIQUES</div>
        <div className="move-grid">
          <div className="move-item"><span style={{ color: '#00f0ff' }}>← →</span> Horizontal · Drone</div>
          <div className="move-item"><span style={{ color: '#b026ff' }}>↑ ↓</span> Vertical · Shield Bot</div>
          <div className="move-item"><span style={{ color: '#ff007f' }}>↘ ↖</span> Diagonal · Ninja</div>
          <div className="move-item"><span style={{ color: '#ffaa00' }}>▶  </span> Thrust · Kamikaze</div>
          <div className="move-item"><span style={{ color: '#7df9ff' }}>⛊  </span> Hold Upright · Block</div>
        </div>
      </div>

      {/* Mini telemetry row */}
      <div className="telemetry-row" style={{ padding: '0 4px' }}>
        <div className="telemetry-item">
          <div className="telemetry-label">Pitch β</div>
          <div className="telemetry-value" style={{ color: 'var(--neon-pink)' }}>{hudRot.beta}°</div>
        </div>
        <div className="telemetry-item">
          <div className="telemetry-label">Roll γ</div>
          <div className="telemetry-value" style={{ color: 'var(--neon-purple)' }}>{hudRot.gamma}°</div>
        </div>
        <div className="telemetry-item">
          <div className="telemetry-label">|Acc|</div>
          <div className="telemetry-value">
            {Math.sqrt(hudAccel.x ** 2 + hudAccel.y ** 2 + hudAccel.z ** 2).toFixed(1)}
          </div>
        </div>
      </div>

      {permissionState === 'denied' && (
        <div style={{ color: '#ff3355', fontSize: '0.8rem', textAlign: 'center', padding: '8px' }}>
          Sensors blocked. Enable Motion & Orientation in browser/iOS Settings.
        </div>
      )}
    </>
  );
}
