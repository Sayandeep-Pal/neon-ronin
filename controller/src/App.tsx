import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Wifi } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Vec3 { x: number; y: number; z: number; }
interface Rotation { alpha: number; beta: number; gamma: number; }

interface SensorData {
  accel: Vec3;
  rotation: Rotation;
  gyro: Rotation;
}

type GestureType = 'HORIZONTAL' | 'VERTICAL' | 'DIAGONAL' | 'THRUST' | 'BLOCK' | 'IDLE';
type FeedbackFlash = 'hit' | 'perfect' | 'damage' | '';

// ─── Low-pass filter ──────────────────────────────────────────────────────────
// Smooths raw sensor noise. alpha=0.15 → heavy smoothing, alpha=0.5 → light
const LP_ALPHA = 0.18; // tuned for motion-controller feel
function lpf(prev: number, next: number, alpha = LP_ALPHA): number {
  return prev + alpha * (next - prev);
}

// ─── Constants ────────────────────────────────────────────────────────────────
// Minimum acceleration peak (m/s²) to register a slash
const SLASH_THRESHOLD = 14;
// Minimum cooldown between gestures (ms) — prevents double-firing
const GESTURE_COOLDOWN_MS = 350;
// If total acceleration falls below this while upright, we're in BLOCK stance
const BLOCK_MOTION_THRESHOLD = 2.5;
// Upright stance: phone held vertically (beta ~ 60°–110°) and roll (gamma) small
const BLOCK_BETA_MIN = 55;
const BLOCK_BETA_MAX = 115;
const BLOCK_GAMMA_MAX = 28;

// ─── Gesture Config (label, icon label, color) ────────────────────────────────
const GESTURE_META: Record<GestureType, { label: string; color: string; hint: string }> = {
  HORIZONTAL: { label: '← HORIZONTAL →', color: '#00f0ff', hint: 'vs Drones'       },
  VERTICAL:   { label: '↓ VERTICAL ↓',   color: '#b026ff', hint: 'vs Shield Bots'  },
  DIAGONAL:   { label: '↘ DIAGONAL ↖',   color: '#ff007f', hint: 'vs Cyber Ninjas' },
  THRUST:     { label: '▶ THRUST',        color: '#ffaa00', hint: 'vs Kamikazes'    },
  BLOCK:      { label: '⛊  BLOCKING',     color: '#7df9ff', hint: 'Guard Active'    },
  IDLE:       { label: '',                color: 'transparent', hint: ''           },
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function App() {
  // Connection
  const [roomId,       setRoomId]       = useState('');
  const [backendUrl,   setBackendUrl]   = useState('');
  const [isConnected,  setIsConnected]  = useState(false);
  const [isJoined,     setIsJoined]     = useState(false);
  const [errorMsg,     setErrorMsg]     = useState('');
  const [permissionState, setPermissionState] = useState<'prompt'|'granted'|'denied'>('prompt');
  const [isConnecting, setIsConnecting] = useState(false);

  // Gameplay display
  const [gesture,     setGesture]     = useState<GestureType>('IDLE');
  const [flashClass,  setFlashClass]  = useState<FeedbackFlash>('');
  const [inCooldown,  setInCooldown]  = useState(false);
  const [calibrated,  setCalibrated]  = useState(false);

  // HUD (updated slowly to avoid re-render churn)
  const [hudAccel, setHudAccel] = useState({ x: 0, y: 0, z: 0 });
  const [hudRot,   setHudRot]   = useState({ alpha: 0, beta: 0, gamma: 0 });

  // ── Refs ──────────────────────────────────────────────────────────────────
  const socketRef      = useRef<Socket | null>(null);
  // Raw sensor buffer (written at 60fps by event listeners)
  const rawRef = useRef<SensorData>({
    accel:    { x: 0, y: 0, z: 0 },
    rotation: { alpha: 0, beta: 0, gamma: 0 },
    gyro:     { alpha: 0, beta: 0, gamma: 0 },
  });
  // Smoothed sensor buffer (low-pass filtered, what we actually transmit)
  const smoothRef = useRef<SensorData>({
    accel:    { x: 0, y: 0, z: 0 },
    rotation: { alpha: 0, beta: 0, gamma: 0 },
    gyro:     { alpha: 0, beta: 0, gamma: 0 },
  });
  // Calibration snapshot — offset subtracted from every rotation reading
  const calibRef = useRef<Rotation>({ alpha: 0, beta: 0, gamma: 0 });

  // Gesture detection state
  const lastGestureTimeRef = useRef(0);
  const blockActiveRef     = useRef(false);
  const gestureTimeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── URL params on mount ───────────────────────────────────────────────────
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const r = p.get('room');
    const s = p.get('server');   // URL param from QR code takes highest priority

    if (r) setRoomId(r.toUpperCase());

    // Priority: QR ?server= param > .env VITE_BACKEND_URL > derived from hostname
    const { protocol, hostname } = window.location;
    setBackendUrl(
      s ||
      import.meta.env.VITE_BACKEND_URL ||
      `${protocol}//${hostname}:3001`
    );
  }, []);

  // ── Sensor listeners ─────────────────────────────────────────────────────
  const setupSensorListeners = useCallback(() => {
    // Orientation → rotation angles (calibration-corrected)
    window.addEventListener('deviceorientation', (ev) => {
      const rawAlpha = ev.alpha ?? 0;
      const rawBeta  = ev.beta  ?? 0;
      const rawGamma = ev.gamma ?? 0;

      // Subtract calibration snapshot, keep alpha in [0,360)
      const corrAlpha = (rawAlpha - calibRef.current.alpha + 360) % 360;
      const corrBeta  = rawBeta  - calibRef.current.beta;
      const corrGamma = rawGamma - calibRef.current.gamma;

      // Store raw (before smoothing — smoothing happens in tick loop)
      rawRef.current.rotation = { alpha: corrAlpha, beta: corrBeta, gamma: corrGamma };
    });

    // Motion → linear acceleration + gyro
    window.addEventListener('devicemotion', (ev) => {
      rawRef.current.accel = {
        x: ev.acceleration?.x ?? 0,
        y: ev.acceleration?.y ?? 0,
        z: ev.acceleration?.z ?? 0,
      };
      rawRef.current.gyro = {
        alpha: ev.rotationRate?.alpha ?? 0,
        beta:  ev.rotationRate?.beta  ?? 0,
        gamma: ev.rotationRate?.gamma ?? 0,
      };
    });
  }, []);

  // ── Calibration ──────────────────────────────────────────────────────────
  // Snap the CURRENT raw orientation as the new zero-reference
  const calibrateController = useCallback(() => {
    const ev = rawRef.current.rotation;
    // We need to capture the uncorrected angles. Since rawRef already has
    // the corrected ones (previous calib subtracted), we back-compute:
    calibRef.current = {
      alpha: (ev.alpha + calibRef.current.alpha) % 360,
      beta:  ev.beta  + calibRef.current.beta,
      gamma: ev.gamma + calibRef.current.gamma,
    };
    // Reset smoothed rotation so the sword snaps instantly to neutral
    smoothRef.current.rotation = { alpha: 0, beta: 0, gamma: 0 };
    setCalibrated(true);
    if ('vibrate' in navigator) navigator.vibrate([30, 20, 60]);
  }, []);

  // ── Gesture classifier (called inside transmit tick) ──────────────────────
  const classifyGesture = useCallback((s: SensorData) => {
    const now = Date.now();
    const { x, y, z } = s.accel;
    const absX = Math.abs(x);
    const absY = Math.abs(y);
    const absZ = Math.abs(z);
    const totalAccel = Math.sqrt(absX * absX + absY * absY + absZ * absZ);

    // ── Block detection (stance check, not a swing) ──
    const { beta, gamma } = s.rotation;
    const isUpright   = beta  >= BLOCK_BETA_MIN && beta  <= BLOCK_BETA_MAX;
    const isLevelRoll = Math.abs(gamma) <= BLOCK_GAMMA_MAX;
    const isStill     = totalAccel < BLOCK_MOTION_THRESHOLD;

    if (isUpright && isLevelRoll && isStill) {
      if (!blockActiveRef.current) {
        blockActiveRef.current = true;
        setGesture('BLOCK');
        if (socketRef.current?.connected) {
          socketRef.current.emit('controller-gesture', { type: 'BLOCK' });
        }
      }
      return;
    } else if (blockActiveRef.current) {
      blockActiveRef.current = false;
      setGesture('IDLE');
    }

    // ── Slash detection (acceleration spike) ──
    if (totalAccel < SLASH_THRESHOLD) return;          // not a swing
    if (now - lastGestureTimeRef.current < GESTURE_COOLDOWN_MS) return; // cooldown

    let detectedGesture: GestureType | null = null;

    if (absZ > absX * 1.6 && absZ > absY * 1.6 && z < -8) {
      // Forward lunge dominant on -Z axis
      detectedGesture = 'THRUST';
    } else if (absX > absY * 1.5 && absX > absZ * 1.2) {
      // Horizontal dominant on X axis
      detectedGesture = 'HORIZONTAL';
    } else if (absY > absX * 1.5 && absY > absZ * 1.2) {
      // Vertical dominant on Y axis
      detectedGesture = 'VERTICAL';
    } else if (absX > SLASH_THRESHOLD * 0.6 && absY > SLASH_THRESHOLD * 0.6) {
      // Both X and Y significant → diagonal
      detectedGesture = 'DIAGONAL';
    }

    if (detectedGesture) {
      lastGestureTimeRef.current = now;
      blockActiveRef.current = false;

      // Show gesture on UI + short cooldown indicator
      setGesture(detectedGesture);
      setInCooldown(true);
      if ('vibrate' in navigator) navigator.vibrate(25); // tiny swing feedback

      // Emit the confirmed gesture to the desktop
      if (socketRef.current?.connected) {
        socketRef.current.emit('controller-gesture', {
          type:      detectedGesture,
          intensity: totalAccel,
          timestamp: now,
        });
      }

      // Clear gesture banner after 600ms cooldown
      if (gestureTimeoutRef.current) clearTimeout(gestureTimeoutRef.current);
      gestureTimeoutRef.current = setTimeout(() => {
        setGesture('IDLE');
        setInCooldown(false);
      }, GESTURE_COOLDOWN_MS + 50);
    }
  }, []);

  // ── Permission request ────────────────────────────────────────────────────
  const requestPermission = useCallback(async () => {
    const DOE = DeviceOrientationEvent as any;
    if (typeof DOE?.requestPermission === 'function') {
      try {
        const op = await DOE.requestPermission();
        const mp = typeof (DeviceMotionEvent as any).requestPermission === 'function'
          ? await (DeviceMotionEvent as any).requestPermission()
          : 'granted';
        if (op === 'granted' && mp === 'granted') {
          setPermissionState('granted');
          setupSensorListeners();
          return true;
        }
        setPermissionState('denied');
        setErrorMsg('Motion permission denied. Enable in iOS Settings → Privacy → Motion.');
        return false;
      } catch {
        setPermissionState('denied');
        setErrorMsg('Sensor permission blocked. Must be on HTTPS.');
        return false;
      }
    }
    // Android / non-iOS — auto-granted
    setPermissionState('granted');
    setupSensorListeners();
    return true;
  }, [setupSensorListeners]);

  // ── Connect + join room ───────────────────────────────────────────────────
  const handleConnect = useCallback(() => {
    if (!roomId)     { setErrorMsg('Please enter a Room ID.'); return; }
    if (!backendUrl) { setErrorMsg('Please enter the Backend Server URL.'); return; }
    setErrorMsg('');
    setIsConnecting(true);

    socketRef.current?.disconnect();

    const socket = io(backendUrl, { reconnectionAttempts: 5, timeout: 10000 });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join-room', roomId, (res: any) => {
        setIsConnecting(false);
        if (res.success) {
          setIsJoined(true);
          requestPermission();
        } else {
          setErrorMsg(res.error || 'Failed to join room. Check the Room ID.');
          socket.disconnect();
        }
      });
    });

    socket.on('connect_error', () => {
      setIsConnecting(false);
      setIsConnected(false);
      setErrorMsg('Cannot reach backend. Check URL and port forwarding.');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      setIsJoined(false);
    });

    // Visual + haptic feedback from game
    socket.on('game-feedback', (ev: { type: string; duration: number }) => {
      if ('vibrate' in navigator && ev.duration) navigator.vibrate(ev.duration);
      const cls = ev.type as FeedbackFlash;
      setFlashClass(cls);
      setTimeout(() => setFlashClass(''), 280);
    });

    socket.on('host-disconnected', () => {
      setErrorMsg('Host ended the session.');
      setIsJoined(false);
      socket.disconnect();
    });
  }, [roomId, backendUrl, requestPermission]);

  // ── Main tick loop: smooth → classify → transmit ──────────────────────────
  useEffect(() => {
    if (!isJoined || !isConnected) return;

    let hudTick = 0;
    // Run at ~60fps; transmit every other frame (30fps)
    const id = setInterval(() => {
      const raw    = rawRef.current;
      const smooth = smoothRef.current;

      // Apply low-pass filter to all axes
      smooth.accel.x    = lpf(smooth.accel.x,    raw.accel.x);
      smooth.accel.y    = lpf(smooth.accel.y,    raw.accel.y);
      smooth.accel.z    = lpf(smooth.accel.z,    raw.accel.z);
      smooth.gyro.alpha = lpf(smooth.gyro.alpha, raw.gyro.alpha);
      smooth.gyro.beta  = lpf(smooth.gyro.beta,  raw.gyro.beta);
      smooth.gyro.gamma = lpf(smooth.gyro.gamma, raw.gyro.gamma);
      // Rotation: separate alpha wrap-around handling
      smooth.rotation.beta  = lpf(smooth.rotation.beta,  raw.rotation.beta,  0.22);
      smooth.rotation.gamma = lpf(smooth.rotation.gamma, raw.rotation.gamma, 0.22);
      // For alpha (0–360 wrapping), use raw to avoid wrap-jump artefacts
      smooth.rotation.alpha = raw.rotation.alpha;

      // Classify using the RAW acceleration spike (smoothed data would suppress peaks)
      classifyGesture({ ...raw, rotation: smooth.rotation });

      // Transmit smoothed data at 30fps (every 2nd tick at 60fps)
      hudTick++;
      if (hudTick % 2 === 0 && socketRef.current?.connected) {
        socketRef.current.emit('controller-data', {
          accel:     smooth.accel,
          rotation:  smooth.rotation,
          gyro:      smooth.gyro,
          timestamp: Date.now(),
        });
      }

      // Update HUD at ~5fps (every 12th tick)
      if (hudTick % 12 === 0) {
        setHudAccel({ ...smooth.accel });
        setHudRot({
          alpha: parseFloat(smooth.rotation.alpha.toFixed(1)),
          beta:  parseFloat(smooth.rotation.beta.toFixed(1)),
          gamma: parseFloat(smooth.rotation.gamma.toFixed(1)),
        });
        hudTick = 0;
      }
    }, 16); // ~60fps

    return () => clearInterval(id);
  }, [isJoined, isConnected, classifyGesture]);

  // Clean up socket
  useEffect(() => () => { socketRef.current?.disconnect(); }, []);

  // Sword CSS 3D transform (uses smoothed rotation, clamped to sane ranges)
  const clampedBeta  = Math.min(Math.max(hudRot.beta,  -90), 90);
  const clampedGamma = Math.min(Math.max(hudRot.gamma, -75), 75);
  const swordStyle   = {
    transform: `rotateX(${-clampedBeta}deg) rotateY(${clampedGamma}deg)`,
  };

  const meta = GESTURE_META[gesture];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="controller-container">
      {/* Feedback overlay flash */}
      <div className={`feedback-flash ${flashClass}`} />

      {/* Header */}
      <div className="header">
        <h1 className="title">Neon Ronin</h1>
        <div className="subtitle">Katana Controller</div>
      </div>

      {/* ── Lobby Panel ── */}
      {!isJoined ? (
        <div className="connection-panel">
          <div className="status-badge">
            <div className={`status-dot ${isConnected ? 'connected' : isConnecting ? 'connecting' : ''}`} />
            {isConnected ? 'Server Connected' : isConnecting ? 'Connecting…' : 'Disconnected'}
          </div>

          <div className="room-input-container">
            <label className="subtitle" style={{ alignSelf: 'flex-start', fontSize: '0.75rem' }}>Room ID</label>
            <input
              type="text"
              className="room-input"
              placeholder="CYBER7"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              maxLength={6}
            />
          </div>

          <div className="room-input-container">
            <label className="subtitle" style={{ alignSelf: 'flex-start', fontSize: '0.75rem' }}>Backend Socket URL</label>
            <input
              type="text"
              className="room-input"
              style={{ fontSize: '0.9rem', letterSpacing: '0.5px' }}
              placeholder="http://host:3001"
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value.trim())}
            />
          </div>

          {errorMsg && (
            <div style={{ color: '#ff3355', fontSize: '0.85rem', textAlign: 'center' }}>
              {errorMsg}
            </div>
          )}

          <button className="neon-btn" onClick={handleConnect} disabled={isConnecting}
            style={{ width: '100%', marginTop: '12px', opacity: isConnecting ? 0.6 : 1 }}>
            {isConnecting ? 'Linking…' : 'Initialize Link'}
          </button>
        </div>

      ) : (
        /* ── Gameplay HUD ── */
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
          <div className="sword-visualizer">
            <div className="sword-wrapper" style={swordStyle}>
              <div className="cyber-katana" />
              <div className="cyber-katana-tsuba" />
              <div className="cyber-katana-hilt" />
            </div>
          </div>

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
      )}

      {/* Footer */}
      <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '1px', marginBottom: '10px', textAlign: 'center' }}>
        {isJoined ? 'HOLD LIKE A SWORD HILT · SWING TO ATTACK' : 'SCAN QR ON DESKTOP OR ENTER ROOM'}
      </div>
    </div>
  );
}
