import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Swords, Activity, Smartphone, Volume2, VolumeX } from 'lucide-react';
import QRCode from 'qrcode';

// Interface for sensor data
interface SensorData {
  accel: { x: number; y: number; z: number };
  rotation: { alpha: number; beta: number; gamma: number };
  gyro: { alpha: number; beta: number; gamma: number };
  timestamp: number;
}

// Game enemy definition
interface Enemy {
  id: string;
  type: 'drone' | 'shieldbot' | 'cyberninja' | 'kamikaze' | 'samurai';
  x: number; // Ground coordinates (-150 to 150)
  y: number;
  z: number; // Elevation
  speed: number;
  health: number;
  maxHealth: number;
  weakness: 'horizontal' | 'vertical' | 'diagonal' | 'thrust' | 'counter';
  angle: number; // Spawn angle (0 to 2*PI)
  size: number;
  color: string;
  pulseTimer: number;
  state: 'approach' | 'windup' | 'slashed' | 'dead';
  windupTime: number; // Max time in windup before hit
  windupCounter: number;
}

// Particle system definition
interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

export default function App() {
  // Connection states
  const [roomId, setRoomId] = useState('');
  const [backendUrl, setBackendUrl] = useState('');
  const [controllerUrlBase, setControllerUrlBase] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [isSearchingHost, setIsSearchingHost] = useState(false);
  const [isControllerConnected, setIsControllerConnected] = useState(false);

  // Audio state
  const [isMuted, setIsMuted] = useState(false);

  // Gameplay states
  const [gameState, setGameState] = useState<'lobby' | 'playing' | 'gameover'>('lobby');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [health, setHealth] = useState(100);
  const [wave, setWave] = useState(1);
  const [detectedGesture, setDetectedGesture] = useState('');

  // Socket & Telemetry refs
  const socketRef = useRef<Socket | null>(null);

  const latestSensor = useRef<SensorData>({
    accel: { x: 0, y: 0, z: 0 },
    rotation: { alpha: 0, beta: 0, gamma: 0 },
    gyro: { alpha: 0, beta: 0, gamma: 0 },
    timestamp: 0
  });

  // Canvas & Audio refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const synthIntervalRef = useRef<any>(null); // For background synth drone

  // Gameplay mechanics refs
  const enemiesRef = useRef<Enemy[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const swordTrailRef = useRef<{ x: number; y: number; z: number }[]>([]);
  const blockActiveRef = useRef<boolean>(false);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const healthRef = useRef(100);
  const waveRef = useRef(1);
  const nextWaveTimer = useRef<number>(0);
  const screenShakeRef = useRef<number>(0);
  const flashBackgroundRef = useRef<string | null>(null);


  // Set default socket server and controller client domains
  useEffect(() => {
    const { protocol, hostname } = window.location;

    // Use .env variable if set, otherwise derive from window.location
    const envBackend = import.meta.env.VITE_BACKEND_URL;
    setBackendUrl(envBackend || `${protocol}//${hostname}:3001`);

    const envController = import.meta.env.VITE_CONTROLLER_URL;
    setControllerUrlBase(envController || (
      window.location.port === '5173'
        ? `${protocol}//${hostname}:5174`
        : window.location.origin
    ));
  }, []);

  // Web Audio Synth setup for sound effects (zero network assets)
  const initAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      startSynthDrone();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  // Neon Synthwave low-frequency background drone
  const startSynthDrone = () => {
    if (isMuted || !audioContextRef.current) return;
    try {
      const ctx = audioContextRef.current;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc1.type = 'sawtooth';
      osc2.type = 'square';
      osc1.frequency.setValueAtTime(55, ctx.currentTime); // A1 note
      osc2.frequency.setValueAtTime(55.5, ctx.currentTime); // detune slightly

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(120, ctx.currentTime);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();

      // Moderate pitch sweep LFO
      synthIntervalRef.current = setInterval(() => {
        if (ctx.state === 'running') {
          const cut = 100 + Math.sin(Date.now() / 2000) * 40;
          filter.frequency.setValueAtTime(cut, ctx.currentTime);
        }
      }, 50);
    } catch (e) {
      console.error(e);
    }
  };

  // Synthesize custom sound effects
  const playSound = (type: 'swing' | 'hit' | 'perfect' | 'damage' | 'alarm' | 'boss_charge') => {
    if (isMuted || !audioContextRef.current) return;
    try {
      const ctx = audioContextRef.current;
      const now = ctx.currentTime;

      if (type === 'swing') {
        // Bandpass noise sweep for katana swing
        const bufferSize = ctx.sampleRate * 0.15; // 150ms
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.setValueAtTime(8, now);
        filter.frequency.setValueAtTime(800, now);
        filter.frequency.exponentialRampToValueAtTime(150, now + 0.15);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.15);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start();
      } 
      else if (type === 'hit') {
        // High impact laser blast with rapid pitch envelope
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.2);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(now + 0.2);
      } 
      else if (type === 'perfect') {
        // Synthesizer metallic high clash + chord (Perfect rating!)
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'sawtooth';
        
        osc1.frequency.setValueAtTime(880, now); // A5
        osc2.frequency.setValueAtTime(1320, now); // E6

        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(); osc2.start();
        osc1.stop(now + 0.4); osc2.stop(now + 0.4);
      } 
      else if (type === 'damage') {
        // Low distorted explosion growl
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.linearRampToValueAtTime(30, now + 0.4);

        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(now + 0.4);
      } 
      else if (type === 'alarm') {
        // Pitch sweep warning siren
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(350, now);
        osc.frequency.linearRampToValueAtTime(700, now + 0.25);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(now + 0.25);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Trigger hosting room connection
  const hostGameSession = () => {
    if (!backendUrl) return;
    setIsSearchingHost(true);

    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    console.log(`Connecting to backend socket server: ${backendUrl}`);
    const socket = io(backendUrl);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Host connected to server. Creating room...');
      
      socket.emit('host-room', (response: any) => {
        if (response.success) {
          const rId = response.roomId;
          setRoomId(rId);
          setIsSearchingHost(false);

          // Generate QR code encoding URL pointing to mobile controller client
          const link = `${controllerUrlBase}/controller?room=${rId}&server=${backendUrl}`;
          console.log(`Mobile Controller connection link: ${link}`);
          QRCode.toDataURL(link, { width: 220, margin: 1, color: { dark: '#05050a', light: '#ffffff' } })
            .then(url => setQrCodeUrl(url))
            .catch(err => console.error(err));
        } else {
          console.error('Failed to create room.');
          setIsSearchingHost(false);
        }
      });
    });

    socket.on('controller-joined', (data: any) => {
      console.log(`Mobile controller paired successfully! (Socket: ${data.socketId})`);
      setIsControllerConnected(true);
      initAudio();
    });

    socket.on('controller-disconnected', () => {
      console.log('Mobile controller disconnected.');
      setIsControllerConnected(false);
      setGameState('lobby');
    });

    // Receive low-latency smoothed telemetry from controller (for katana 3D visual)
    socket.on('motion-data', (data: SensorData) => {
      latestSensor.current = data;
    });

    // Receive pre-classified gestures from the controller's own classifier
    // This is the authoritative gesture event — bypasses desktop re-classification
    socket.on('controller-gesture', (ev: { type: string; intensity?: number; timestamp?: number }) => {
      const gestureMap: Record<string, 'horizontal' | 'vertical' | 'diagonal' | 'thrust'> = {
        HORIZONTAL: 'horizontal',
        VERTICAL:   'vertical',
        DIAGONAL:   'diagonal',
        THRUST:     'thrust',
      };
      if (ev.type === 'BLOCK') {
        blockActiveRef.current = true;
        setDetectedGesture('BLOCK');
        return;
      }
      blockActiveRef.current = false;
      const slashType = gestureMap[ev.type];
      if (slashType) {
        executeSlash(slashType, ev.intensity ?? 16);
      }
    });

    socket.on('disconnect', () => {
      console.log('Host socket disconnected.');
      setIsControllerConnected(false);
      setGameState('lobby');
    });
  };

  // Perform swing slash attack action in game
  const executeSlash = (gestureType: 'horizontal' | 'vertical' | 'diagonal' | 'thrust', intensity: number) => {
    playSound('swing');
    setDetectedGesture(gestureType.toUpperCase());

    // Show temporary banner
    const banner = document.getElementById('gesture-banner');
    if (banner) {
      banner.classList.remove('show');
      void banner.offsetWidth; // trigger reflow
      banner.classList.add('show');
    }

    // Evaluate slash accuracy against active enemies in strike zone
    evaluateHits(gestureType, intensity);
  };

  // Evaluate if slash hit approaching enemies
  const evaluateHits = (slashType: 'horizontal' | 'vertical' | 'diagonal' | 'thrust', speedVal: number) => {
    let hitAny = false;
    let perfectHit = false;

    // Define strike zone boundaries (distance from center: 20 to 65 units)
    const STRIKE_MIN = 20;
    const STRIKE_MAX = 70;

    enemiesRef.current.forEach((enemy) => {
      if (enemy.state === 'dead' || enemy.state === 'slashed') return;

      const dist = Math.sqrt(enemy.x * enemy.x + enemy.y * enemy.y);
      if (dist >= STRIKE_MIN && dist <= STRIKE_MAX) {
        // Check matching weakness
        if (enemy.weakness === slashType) {
          hitAny = true;
          
          // Calculate rating based on swing speed
          // Threshold speed for Perfect slash = 28 m/s²
          const rating = speedVal > 28 ? 'perfect' : 'good';
          
          if (rating === 'perfect') {
            perfectHit = true;
            enemy.health -= 2;
          } else {
            enemy.health -= 1;
          }

          if (enemy.health <= 0) {
            enemy.state = 'slashed';
            // Spawn neon splash particles
            createExplosion(enemy.x, enemy.y, enemy.z, enemy.color);
            
            // Calculate score rewards
            let points = 10;
            if (enemy.type === 'shieldbot') points = 25;
            if (enemy.type === 'cyberninja') points = 50;
            if (enemy.type === 'kamikaze') points = 40;
            if (enemy.type === 'samurai') points = 250;

            const comboMultiplier = comboRef.current >= 10 ? 3 : comboRef.current >= 5 ? 2 : comboRef.current >= 3 ? 1.5 : 1;
            const pointsEarned = Math.round(points * comboMultiplier * (rating === 'perfect' ? 1.5 : 1));
            
            scoreRef.current += pointsEarned;
            comboRef.current += 1;
            
            setScore(scoreRef.current);
            setCombo(comboRef.current);
            if (comboRef.current > maxCombo) setMaxCombo(comboRef.current);
          } else {
            // Damage enemy but not dead
            createExplosion(enemy.x, enemy.y, enemy.z, '#ffffff', 8);
          }
        }
      }
    });

    if (hitAny) {
      if (perfectHit) {
        playSound('perfect');
        flashBackgroundRef.current = 'rgba(255, 255, 255, 0.15)';
        // Send haptic feedback trigger to mobile: 150ms vibration
        if (socketRef.current) socketRef.current.emit('game-event', { type: 'perfect', duration: 150 });
      } else {
        playSound('hit');
        // Send haptic feedback trigger to mobile: 50ms vibration
        if (socketRef.current) socketRef.current.emit('game-event', { type: 'hit', duration: 50 });
      }
    } else {
      // Missed slash: breaks combo
      comboRef.current = 0;
      setCombo(0);
    }
  };

  // Spawn explosion particles
  const createExplosion = (ex: number, ey: number, ez: number, color: string, count = 25) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      particlesRef.current.push({
        x: ex,
        y: ey,
        z: ez,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        vz: 3 + Math.random() * 6,
        color,
        life: 0,
        maxLife: 40 + Math.random() * 30,
        size: 2 + Math.random() * 3
      });
    }
  };

  // Spawn incoming enemies based on wave configuration
  const spawnEnemy = (type: 'drone' | 'shieldbot' | 'cyberninja' | 'kamikaze' | 'samurai') => {
    const angle = Math.random() * Math.PI * 2;
    const startDist = 180; // Distance outer grid ring
    const x = Math.cos(angle) * startDist;
    const y = Math.sin(angle) * startDist;

    let z = 0;
    let speed = 0.8 + Math.random() * 0.6;
    let maxHealth = 1;
    let weakness: 'horizontal' | 'vertical' | 'diagonal' | 'thrust' | 'counter' = 'horizontal';
    let size = 12;
    let color = 'var(--neon-blue)';

    if (type === 'drone') {
      z = 25; // Hovering
      speed = 0.9 + Math.random() * 0.4;
      weakness = 'horizontal';
      color = '#00f0ff'; // neon blue
    } else if (type === 'shieldbot') {
      z = 0;
      speed = 0.5 + Math.random() * 0.3;
      maxHealth = 2;
      weakness = 'vertical';
      color = '#b026ff'; // neon purple
      size = 15;
    } else if (type === 'cyberninja') {
      z = 0;
      speed = 1.6 + Math.random() * 0.5;
      maxHealth = 3;
      weakness = 'diagonal';
      color = '#ff007f'; // neon pink
    } else if (type === 'kamikaze') {
      z = 10;
      speed = 2.4;
      weakness = 'thrust';
      color = '#ffaa00'; // yellow alert
      size = 10;
    } else if (type === 'samurai') {
      z = 0;
      speed = 0.35;
      maxHealth = 6;
      weakness = 'counter'; // requires parry-block then slash
      color = '#ff3333'; // neon red boss
      size = 20;
    }

    enemiesRef.current.push({
      id: Math.random().toString(),
      type,
      x,
      y,
      z,
      speed,
      health: maxHealth,
      maxHealth,
      weakness,
      angle,
      size,
      color,
      pulseTimer: 0,
      state: 'approach',
      windupTime: type === 'samurai' ? 120 : 60,
      windupCounter: 0
    });
  };

  // Spawning Wave Manager
  const checkWaveProgression = () => {
    if (enemiesRef.current.length === 0 && nextWaveTimer.current <= 0) {
      // Trigger wave escalation
      nextWaveTimer.current = 180; // 3 seconds delay
    }

    if (nextWaveTimer.current > 0) {
      nextWaveTimer.current -= 1;
      if (nextWaveTimer.current === 0) {
        const nextWave = waveRef.current + 1;
        waveRef.current = nextWave;
        setWave(nextWave);
        triggerWaveSpawns(nextWave);
      }
    }
  };

  const triggerWaveSpawns = (waveNum: number) => {
    playSound('alarm');
    flashBackgroundRef.current = 'rgba(0, 240, 255, 0.08)';

    // Enemy spawn queues
    let droneCount = 0;
    let shieldCount = 0;
    let ninjaCount = 0;
    let kamikazeCount = 0;
    let samuraiCount = 0;

    if (waveNum === 1) {
      droneCount = 4;
    } else if (waveNum === 2) {
      droneCount = 5;
      shieldCount = 2;
    } else if (waveNum === 3) {
      droneCount = 4;
      ninjaCount = 3;
      kamikazeCount = 1;
    } else if (waveNum === 4) {
      shieldCount = 4;
      ninjaCount = 4;
      kamikazeCount = 3;
    } else if (waveNum === 5) {
      samuraiCount = 1; // Mini Boss wave
      droneCount = 3;
      shieldCount = 2;
    } else {
      // Endless Scaling
      droneCount = 4 + waveNum;
      shieldCount = 1 + Math.floor(waveNum / 2);
      ninjaCount = 1 + Math.floor(waveNum / 2);
      kamikazeCount = Math.floor(waveNum / 2);
      if (waveNum % 3 === 0) samuraiCount = Math.floor(waveNum / 3);
    }

    // Distribute spawns sequentially
    let delay = 0;
    for (let i = 0; i < droneCount; i++) setTimeout(() => spawnEnemy('drone'), delay += 1200);
    for (let i = 0; i < shieldCount; i++) setTimeout(() => spawnEnemy('shieldbot'), delay += 2000);
    for (let i = 0; i < ninjaCount; i++) setTimeout(() => spawnEnemy('cyberninja'), delay += 2500);
    for (let i = 0; i < kamikazeCount; i++) setTimeout(() => spawnEnemy('kamikaze'), delay += 1800);
    for (let i = 0; i < samuraiCount; i++) setTimeout(() => spawnEnemy('samurai'), delay += 3000);
  };

  // Main Canvas Render Loop (60fps)
  useEffect(() => {
    let animId: any = null;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handles resizing
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    // Isometric Projection Math
    const ISO_ANGLE = Math.PI / 6; // 30 deg
    const cosA = Math.cos(ISO_ANGLE);
    const sinA = Math.sin(ISO_ANGLE);
    
    // Scale coordinate multiplier
    const gridScale = 2.2; 

    const project = (x: number, y: number, z: number) => {
      const cx = canvas.width / 2;
      const cy = canvas.height / 2 + 50; // offset center down slightly for layout balance
      
      const sx = cx + (x - y) * cosA * gridScale;
      const sy = cy + (x + y) * sinA * gridScale - z * gridScale;
      return { x: sx, y: sy };
    };

    // Render loop
    const render = () => {
      if (gameState === 'playing') {
        // 1. Handle Wave Spawning
        checkWaveProgression();

        // 2. Clear Screen
        ctx.fillStyle = '#030308';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Screen Shake
        if (screenShakeRef.current > 0) {
          const dx = (Math.random() - 0.5) * screenShakeRef.current;
          const dy = (Math.random() - 0.5) * screenShakeRef.current;
          ctx.translate(dx, dy);
          screenShakeRef.current *= 0.9;
          if (screenShakeRef.current < 0.2) screenShakeRef.current = 0;
        }

        // Full Screen Flash overlay effect
        if (flashBackgroundRef.current) {
          ctx.fillStyle = flashBackgroundRef.current;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          flashBackgroundRef.current = null;
        }

        // 3. Draw Isometric floor grid lines
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.04)';
        ctx.lineWidth = 1;
        const gridBound = 180;
        const gridSpacing = 20;

        for (let i = -gridBound; i <= gridBound; i += gridSpacing) {
          // Lines along X axis
          const p1 = project(-gridBound, i, 0);
          const p2 = project(gridBound, i, 0);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();

          // Lines along Y axis
          const p3 = project(i, -gridBound, 0);
          const p4 = project(i, gridBound, 0);
          ctx.beginPath();
          ctx.moveTo(p3.x, p3.y);
          ctx.lineTo(p4.x, p4.y);
          ctx.stroke();
        }

        // Draw outer ring boundary
        ctx.strokeStyle = 'rgba(176, 38, 255, 0.15)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.1) {
          const rx = Math.cos(a) * 160;
          const ry = Math.sin(a) * 160;
          const pt = project(rx, ry, 0);
          if (a === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();

        // 4. Draw strike zone rings around player
        // Safe Zone (Block Guard) ring
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.1) {
          const rx = Math.cos(a) * 20;
          const ry = Math.sin(a) * 20;
          const pt = project(rx, ry, 0);
          if (a === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();

        // Target Strike Zone ring (glowing boundary)
        ctx.strokeStyle = blockActiveRef.current ? 'rgba(176, 38, 255, 0.4)' : 'rgba(0, 240, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = blockActiveRef.current ? '#b026ff' : '#00f0ff';
        ctx.beginPath();
        for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.1) {
          const rx = Math.cos(a) * 70;
          const ry = Math.sin(a) * 70;
          const pt = project(rx, ry, 0);
          if (a === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0; // reset glow

        // 5. Draw Player (Ronin center pedestal)
        const pLoc = project(0, 0, 0);
        ctx.fillStyle = 'rgba(0, 240, 255, 0.2)';
        ctx.beginPath();
        ctx.ellipse(pLoc.x, pLoc.y, 25 * cosA * gridScale, 25 * sinA * gridScale, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = blockActiveRef.current ? '#b026ff' : '#00f0ff';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 15;
        ctx.shadowColor = blockActiveRef.current ? '#b026ff' : '#00f0ff';
        ctx.beginPath();
        ctx.ellipse(pLoc.x, pLoc.y, 16 * cosA * gridScale, 16 * sinA * gridScale, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0; // reset

        // Draw shield barrier if Block active
        if (blockActiveRef.current) {
          ctx.strokeStyle = 'rgba(176, 38, 255, 0.6)';
          ctx.lineWidth = 4;
          ctx.shadowBlur = 15;
          ctx.shadowColor = '#b026ff';
          ctx.beginPath();
          ctx.ellipse(pLoc.x, pLoc.y - 15, 20 * cosA * gridScale, 10 * sinA * gridScale, 0, Math.PI, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        // 6. Draw Katana (using streaming controller rotation angles)
        const swordLen = 45;
        // Map beta (pitch) and gamma (roll) and alpha (yaw) of phone
        // Start coordinate offset for player's hands: (0, 0, 12)
        const handZ = 12;
        const phone = latestSensor.current.rotation;
        
        // Convert to radians
        const yaw = (phone.alpha * Math.PI) / 180;
        const pitch = (phone.beta * Math.PI) / 180;
        const roll = (phone.gamma * Math.PI) / 180;

        // Apply rotation matrices to default unit sword vector (0, 0, 1)
        // Default sword extends straight up
        let sx = 0;
        let sy = 0;
        let sz = swordLen;

        // 1. Rotate Pitch (X-axis)
        let y1 = sy * Math.cos(pitch) - sz * Math.sin(pitch);
        let z1 = sy * Math.sin(pitch) + sz * Math.cos(pitch);
        let x1 = sx;

        // 2. Rotate Roll (Y-axis)
        let x2 = x1 * Math.cos(roll) + z1 * Math.sin(roll);
        let z2 = -x1 * Math.sin(roll) + z1 * Math.cos(roll);
        let y2 = y1;

        // 3. Rotate Yaw (Z-axis)
        let x3 = x2 * Math.cos(yaw) - y2 * Math.sin(yaw);
        let y3 = x2 * Math.sin(yaw) + y2 * Math.cos(yaw);
        let z3 = z2;

        // Base of blade (projected)
        const bladeBase = project(0, 0, handZ);
        // Tip of blade (projected)
        const bladeTip = project(x3, y3, handZ + z3);

        // Store sword tip for ribbon slash trail
        swordTrailRef.current.push({ x: x3, y: y3, z: handZ + z3 });
        if (swordTrailRef.current.length > 8) {
          swordTrailRef.current.shift();
        }

        // Draw Slash Ribbon Trail
        if (swordTrailRef.current.length > 1) {
          ctx.beginPath();
          const startPt = project(swordTrailRef.current[0].x, swordTrailRef.current[0].y, swordTrailRef.current[0].z);
          ctx.moveTo(startPt.x, startPt.y);
          for (let k = 1; k < swordTrailRef.current.length; k++) {
            const nextPt = project(swordTrailRef.current[k].x, swordTrailRef.current[k].y, swordTrailRef.current[k].z);
            ctx.lineTo(nextPt.x, nextPt.y);
          }
          ctx.strokeStyle = blockActiveRef.current ? 'rgba(176, 38, 255, 0.4)' : 'rgba(0, 240, 255, 0.4)';
          ctx.lineWidth = 12;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();
        }

        // Draw Katana Hilt
        ctx.strokeStyle = '#333344';
        ctx.lineWidth = 5;
        const hiltBase = project(-x3 * 0.15, -y3 * 0.15, handZ - z3 * 0.15);
        ctx.beginPath();
        ctx.moveTo(hiltBase.x, hiltBase.y);
        ctx.lineTo(bladeBase.x, bladeBase.y);
        ctx.stroke();

        // Draw Glowing Blade
        ctx.strokeStyle = blockActiveRef.current ? '#b026ff' : '#00f0ff';
        ctx.lineWidth = 4;
        ctx.shadowBlur = 15;
        ctx.shadowColor = blockActiveRef.current ? '#b026ff' : '#00f0ff';
        ctx.beginPath();
        ctx.moveTo(bladeBase.x, bladeBase.y);
        ctx.lineTo(bladeTip.x, bladeTip.y);
        ctx.stroke();

        // White core of blade
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.moveTo(bladeBase.x, bladeBase.y);
        ctx.lineTo(bladeTip.x, bladeTip.y);
        ctx.stroke();

        // 7. Update & Draw Enemies
        for (let idx = enemiesRef.current.length - 1; idx >= 0; idx--) {
          const enemy = enemiesRef.current[idx];
          enemy.pulseTimer += 0.05;

          // Compute distance to center
          const dist = Math.sqrt(enemy.x * enemy.x + enemy.y * enemy.y);

          // State Machine
          if (enemy.state === 'approach') {
            // Check if entered strike/attack zone (dist < 22)
            if (dist < 22) {
              enemy.state = 'windup';
              enemy.windupCounter = 0;
              playSound('alarm');
            } else {
              // Move towards center (0,0)
              enemy.x -= Math.cos(enemy.angle) * enemy.speed;
              enemy.y -= Math.sin(enemy.angle) * enemy.speed;
            }
          } else if (enemy.state === 'windup') {
            enemy.windupCounter += 1;
            // Check attack trigger expiration
            if (enemy.windupCounter >= enemy.windupTime) {
              // Attack completed successfully - damage player
              if (blockActiveRef.current) {
                // Attack blocked!
                playSound('hit');
                createExplosion(enemy.x, enemy.y, enemy.z, '#b026ff', 8);
                // Send minor block vibrate feedback to phone: 40ms
                if (socketRef.current) socketRef.current.emit('game-event', { type: 'hit', duration: 40 });
              } else {
                // Attacked player!
                takeDamage(enemy.type === 'samurai' ? 30 : enemy.type === 'kamikaze' ? 20 : 15);
              }
              // Kill enemy after attack delivery
              enemy.state = 'dead';
              enemiesRef.current.splice(idx, 1);
              continue;
            }
          } else if (enemy.state === 'slashed') {
            // Slashed animation delay before disposal
            enemy.state = 'dead';
            enemiesRef.current.splice(idx, 1);
            continue;
          }

          // Draw Enemy shape
          const ep = project(enemy.x, enemy.y, enemy.z);
          const isWindup = enemy.state === 'windup';
          
          // Outer shell color pulse
          const pulse = Math.sin(enemy.pulseTimer) * 4;
          const radius = enemy.size + (isWindup ? pulse + 2 : 0);
          
          // Draw warning projection shadow on ground
          const shadowLoc = project(enemy.x, enemy.y, 0);
          ctx.fillStyle = 'rgba(255, 0, 0, 0.08)';
          ctx.beginPath();
          ctx.ellipse(shadowLoc.x, shadowLoc.y, 8 * cosA * gridScale, 4 * sinA * gridScale, 0, 0, Math.PI * 2);
          ctx.fill();

          // Render indicators
          ctx.strokeStyle = isWindup ? '#ff3333' : enemy.color;
          ctx.lineWidth = isWindup ? 3 : 2;
          ctx.shadowBlur = 10;
          ctx.shadowColor = ctx.strokeStyle;

          // Draw shape according to enemy type
          if (enemy.type === 'drone') {
            // Hovering Hexagon
            ctx.beginPath();
            for (let s = 0; s < 6; s++) {
              const sa = (s * Math.PI) / 3;
              const sx = ep.x + Math.cos(sa) * radius;
              const sy = ep.y + Math.sin(sa) * radius * sinA;
              if (s === 0) ctx.moveTo(sx, sy);
              else ctx.lineTo(sx, sy);
            }
            ctx.closePath();
            ctx.stroke();
          } 
          else if (enemy.type === 'shieldbot') {
            // Quad Box
            ctx.beginPath();
            ctx.strokeRect(ep.x - radius, ep.y - radius * sinA, radius * 2, radius * 2 * sinA);
            // Draw a heavy neon line across front
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(ep.x - radius, ep.y + radius * sinA);
            ctx.lineTo(ep.x + radius, ep.y + radius * sinA);
            ctx.stroke();
          } 
          else if (enemy.type === 'cyberninja') {
            // Sleek Diamond
            ctx.beginPath();
            ctx.moveTo(ep.x, ep.y - radius);
            ctx.lineTo(ep.x + radius, ep.y);
            ctx.lineTo(ep.x, ep.y + radius);
            ctx.lineTo(ep.x - radius, ep.y);
            ctx.closePath();
            ctx.stroke();
          } 
          else if (enemy.type === 'kamikaze') {
            // Triangle
            ctx.beginPath();
            ctx.moveTo(ep.x, ep.y - radius);
            ctx.lineTo(ep.x + radius, ep.y + radius);
            ctx.lineTo(ep.x - radius, ep.y + radius);
            ctx.closePath();
            ctx.stroke();
          } 
          else if (enemy.type === 'samurai') {
            // Red Crown helmet outline
            ctx.beginPath();
            ctx.moveTo(ep.x - radius, ep.y + radius);
            ctx.lineTo(ep.x - radius, ep.y - radius * 0.3);
            ctx.lineTo(ep.x - radius * 0.5, ep.y - radius);
            ctx.lineTo(ep.x, ep.y - radius * 0.5);
            ctx.lineTo(ep.x + radius * 0.5, ep.y - radius);
            ctx.lineTo(ep.x + radius, ep.y - radius * 0.3);
            ctx.lineTo(ep.x + radius, ep.y + radius);
            ctx.closePath();
            ctx.stroke();
          }

          // Draw health indicators for shieldbots/elites
          if (enemy.maxHealth > 1) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(ep.x - 12, ep.y - radius - 10, 24, 4);
            ctx.fillStyle = '#33ff33';
            ctx.fillRect(ep.x - 12, ep.y - radius - 10, 24 * (enemy.health / enemy.maxHealth), 4);
          }

          // Draw attack progress ring (windup alarm)
          if (isWindup) {
            ctx.strokeStyle = 'rgba(255, 51, 51, 0.4)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(ep.x, ep.y, radius + 8, 0, Math.PI * 2 * (1 - enemy.windupCounter / enemy.windupTime));
            ctx.stroke();
          }

          ctx.shadowBlur = 0; // reset
        }

        // 8. Update & Draw Particles
        for (let pIdx = particlesRef.current.length - 1; pIdx >= 0; pIdx--) {
          const p = particlesRef.current[pIdx];
          p.life += 1;

          // Apply kinetics
          p.x += p.vx;
          p.y += p.vy;
          p.z += p.vz;
          p.vz -= 0.25; // gravity

          // Floor bounce
          if (p.z <= 0) {
            p.z = 0;
            p.vz = -p.vz * 0.6; // bounce coefficient
            p.vx *= 0.8;
            p.vy *= 0.8;
          }

          if (p.life >= p.maxLife) {
            particlesRef.current.splice(pIdx, 1);
            continue;
          }

          // Draw particle
          const pp = project(p.x, p.y, p.z);
          ctx.fillStyle = p.color;
          const pAlpha = 1 - p.life / p.maxLife;
          ctx.globalAlpha = pAlpha;
          ctx.beginPath();
          ctx.arc(pp.x, pp.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1.0;
        }

        // Restores canvas offset translation from screen shake
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [gameState]);

  // Handle player damage events
  const takeDamage = (damage: number) => {
    playSound('damage');
    screenShakeRef.current = 15;
    flashBackgroundRef.current = 'rgba(255, 0, 127, 0.25)';

    const curHp = Math.max(0, healthRef.current - damage);
    healthRef.current = curHp;
    setHealth(curHp);

    // Reset combos on hit
    comboRef.current = 0;
    setCombo(0);

    // Send haptic feedback trigger to mobile: 200ms vibration
    if (socketRef.current) socketRef.current.emit('game-event', { type: 'damage', duration: 200 });

    if (curHp <= 0) {
      triggerGameOver();
    }
  };

  const triggerGameOver = () => {
    setGameState('gameover');
    if (scoreRef.current > highScore) {
      setHighScore(scoreRef.current);
    }
    // Disconnect controller or halt loop
    enemiesRef.current = [];
    particlesRef.current = [];
    swordTrailRef.current = [];
  };

  const startPlaying = () => {
    initAudio();
    setGameState('playing');
    scoreRef.current = 0;
    comboRef.current = 0;
    healthRef.current = 100;
    waveRef.current = 1;
    nextWaveTimer.current = 0;
    setScore(0);
    setCombo(0);
    setHealth(100);
    setWave(1);
    
    // Initial Spawn list
    triggerWaveSpawns(1);
  };

  // Re-enter lobby config
  const exitToLobby = () => {
    setGameState('lobby');
  };

  // Toggle Mute settings
  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (!isMuted) {
      if (synthIntervalRef.current) clearInterval(synthIntervalRef.current);
    } else {
      if (audioContextRef.current) {
        startSynthDrone();
      }
    }
  };

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (synthIntervalRef.current) clearInterval(synthIntervalRef.current);
    };
  }, []);

  return (
    <div className="game-container">
      {/* Audio Controller Widget */}
      <button 
        onClick={toggleMute}
        style={{
          position: 'absolute',
          top: '24px',
          right: '24px',
          background: 'var(--panel-bg)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '50%',
          width: '44px',
          height: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          cursor: 'pointer',
          zIndex: 12
        }}
      >
        {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>

      {/* LOBBY / SETUP SCREEN */}
      {gameState === 'lobby' && (
        <div className="lobby-screen">
          <h1 className="lobby-title">Neon Ronin</h1>
          <h2 className="lobby-subtitle">Cyber-Katana Motion Slasher</h2>

          <div className="lobby-panels">
            {/* Host Server configurations */}
            <div className="lobby-panel">
              <div className="subtitle" style={{ fontSize: '0.8rem', marginBottom: '20px' }}>Step 1: Configure Port Link</div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label className="subtitle" style={{ fontSize: '0.7rem', alignSelf: 'flex-start' }}>Backend Server URL</label>
                  <input
                    type="text"
                    style={{
                      background: 'rgba(0,0,0,0.5)',
                      border: '1px solid var(--text-secondary)',
                      borderRadius: '4px',
                      color: '#fff',
                      padding: '10px',
                      fontSize: '0.9rem',
                      fontFamily: 'var(--font-display)',
                      outline: 'none'
                    }}
                    value={backendUrl}
                    onChange={(e) => setBackendUrl(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label className="subtitle" style={{ fontSize: '0.7rem', alignSelf: 'flex-start' }}>Controller client url base</label>
                  <input
                    type="text"
                    style={{
                      background: 'rgba(0,0,0,0.5)',
                      border: '1px solid var(--text-secondary)',
                      borderRadius: '4px',
                      color: '#fff',
                      padding: '10px',
                      fontSize: '0.9rem',
                      fontFamily: 'var(--font-display)',
                      outline: 'none'
                    }}
                    value={controllerUrlBase}
                    onChange={(e) => setControllerUrlBase(e.target.value)}
                  />
                </div>
              </div>

              {!roomId ? (
                <button className="cyber-btn" style={{ width: '100%', marginTop: '30px' }} onClick={hostGameSession} disabled={isSearchingHost}>
                  {isSearchingHost ? 'Pairing...' : 'Open Dojo Portal'}
                </button>
              ) : (
                <div style={{ width: '100%', textAlign: 'center', marginTop: '20px' }}>
                  <span className="subtitle" style={{ fontSize: '0.65rem' }}>Dojo Portal Open</span>
                  <div className="room-display">{roomId}</div>
                </div>
              )}
            </div>

            {/* QR Connection client pairing */}
            <div className={`lobby-panel paired ${isControllerConnected ? 'paired' : ''}`}>
              <div className="subtitle" style={{ fontSize: '0.8rem', marginBottom: '20px' }}>Step 2: Sync Cyber Katana</div>

              {qrCodeUrl && !isControllerConnected ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                  <div className="qr-placeholder">
                    <img src={qrCodeUrl} alt="Scan to connect controller" style={{ width: '200px', height: '200px' }} />
                  </div>
                  <span className="subtitle" style={{ fontSize: '0.65rem', textAlign: 'center' }}>
                    Scan with smartphone QR scanner or navigate to the controller URL to connect.
                  </span>
                </div>
              ) : isControllerConnected ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1, gap: '20px' }}>
                  <Swords size={60} color="var(--neon-pink)" style={{ animation: 'sword-glow 1.5s infinite alternate' }} />
                  <span className="subtitle" style={{ color: 'var(--neon-pink)', letterSpacing: '4px', fontWeight: 'bold' }}>
                    KATANA SYNCED & ARMED
                  </span>
                  
                  <button className="cyber-btn pink" style={{ marginTop: '20px', padding: '16px 50px' }} onClick={startPlaying}>
                    Enter Dojo
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1, color: 'var(--text-secondary)' }}>
                  <Smartphone size={40} style={{ marginBottom: '10px' }} />
                  <span style={{ fontSize: '0.8rem', letterSpacing: '1px' }}>Awaiting Dojo Portal initiation...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* GAME OVER SCREEN */}
      {gameState === 'gameover' && (
        <div className="game-over-screen">
          <h1 className="game-over-title">Dojo Fallen</h1>
          <div style={{ display: 'flex', gap: '30px', margin: '20px 0' }}>
            <div style={{ textAlign: 'center' }}>
              <div className="subtitle" style={{ fontSize: '0.75rem' }}>Final Score</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--neon-blue)', fontFamily: 'var(--font-display)' }}>{score}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="subtitle" style={{ fontSize: '0.75rem' }}>Highest Combo</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--neon-pink)', fontFamily: 'var(--font-display)' }}>{maxCombo}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '20px' }}>
            <button className="cyber-btn pink" onClick={startPlaying}>
              Re-enter Dojo
            </button>
            <button className="cyber-btn" onClick={exitToLobby}>
              Dojo Lobby
            </button>
          </div>
        </div>
      )}

      {/* GAMEPLAY OVERLAY HUD */}
      {gameState === 'playing' && (
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
                <span style={{ color: blockActiveRef.current ? 'var(--neon-purple)' : 'var(--text-secondary)', fontWeight: 'bold' }}>
                  {blockActiveRef.current ? 'BLOCK ACTIVE' : 'UNGUARDED'}
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Main Game Screen Canvas */}
      <canvas ref={canvasRef} className="game-canvas" />
    </div>
  );
}
