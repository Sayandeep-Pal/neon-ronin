import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Lobby } from './components/Lobby';
import { GameplayHUD } from './components/GameplayHUD';
import type { SensorData, GestureType, FeedbackFlash, Rotation } from './types';
import { lpf } from './utils/math';
import {
  SLASH_THRESHOLD,
  GESTURE_COOLDOWN_MS,
  BLOCK_MOTION_THRESHOLD,
  BLOCK_BETA_MIN,
  BLOCK_BETA_MAX,
  BLOCK_GAMMA_MAX
} from './constants';

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
    // Orientation → raw absolute orientation values
    window.addEventListener('deviceorientation', (ev) => {
      rawRef.current.rotation = {
        alpha: ev.alpha ?? 0,
        beta:  ev.beta  ?? 0,
        gamma: ev.gamma ?? 0,
      };
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
    calibRef.current = { ...rawRef.current.rotation };
    // Reset smoothed rotation so the sword snaps instantly to neutral
    smoothRef.current.rotation = { alpha: 0, beta: 0, gamma: 0 };
    setCalibrated(true);
    if ('vibrate' in navigator) navigator.vibrate([30, 20, 60]);
  }, []);

  // ── Gesture classifier (called inside transmit tick) ──────────────────────
  const classifyGesture = useCallback((rawSensor: SensorData) => {
    const now = Date.now();
    const { x, y, z } = rawSensor.accel;
    const absX = Math.abs(x);
    const absY = Math.abs(y);
    const absZ = Math.abs(z);
    const totalAccel = Math.sqrt(absX * absX + absY * absY + absZ * absZ);

    // ── Block detection (absolute physical stance check relative to gravity, not calibrated) ──
    const { beta, gamma } = rawSensor.rotation;
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

      // Calculate difference relative to calibration and normalize to [-180, 180] to prevent wrapping jump artifacts at neutral
      let diffAlpha = raw.rotation.alpha - calibRef.current.alpha;
      while (diffAlpha > 180) diffAlpha -= 360;
      while (diffAlpha < -180) diffAlpha += 360;

      let diffBeta = raw.rotation.beta - calibRef.current.beta;
      while (diffBeta > 180) diffBeta -= 360;
      while (diffBeta < -180) diffBeta += 360;

      let diffGamma = raw.rotation.gamma - calibRef.current.gamma;
      while (diffGamma > 180) diffGamma -= 360;
      while (diffGamma < -180) diffGamma += 360;

      // Apply LPF to the calibrated differences
      smooth.rotation.alpha = lpf(smooth.rotation.alpha, diffAlpha, 0.22);
      smooth.rotation.beta  = lpf(smooth.rotation.beta,  diffBeta,  0.22);
      smooth.rotation.gamma = lpf(smooth.rotation.gamma, diffGamma, 0.22);

      // Classify using raw sensor coordinates for blocking/slashes
      classifyGesture(raw);

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
        <Lobby
          roomId={roomId}
          setRoomId={setRoomId}
          backendUrl={backendUrl}
          setBackendUrl={setBackendUrl}
          isConnected={isConnected}
          isConnecting={isConnecting}
          errorMsg={errorMsg}
          handleConnect={handleConnect}
        />
      ) : (
        /* ── Gameplay HUD ── */
        <GameplayHUD
          roomId={roomId}
          calibrateController={calibrateController}
          calibrated={calibrated}
          gesture={gesture}
          inCooldown={inCooldown}
          hudRot={hudRot}
          hudAccel={hudAccel}
          permissionState={permissionState}
        />
      )}

      {/* Footer */}
      <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '1px', marginBottom: '10px', textAlign: 'center' }}>
        {isJoined ? 'HOLD LIKE A SWORD HILT · SWING TO ATTACK' : 'SCAN QR ON DESKTOP OR ENTER ROOM'}
      </div>
    </div>
  );
}
