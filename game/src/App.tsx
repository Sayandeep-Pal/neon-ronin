import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Volume2, VolumeX } from 'lucide-react';
import QRCode from 'qrcode';
import { soundManager } from './audio/SoundManager';
import { Lobby } from './components/Lobby';
import { GameOver } from './components/GameOver';
import { GameHUD } from './components/GameHUD';
import { CalibrationCheck } from './components/CalibrationCheck';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createSamuraiCharacter, createEnemyMesh, parseColor } from './engine/samuraiModel';
import type { SensorData, Enemy, Particle } from './types';

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
  const [gameState, setGameState] = useState<'lobby' | 'calibration' | 'playing' | 'gameover'>('lobby');
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

  // Canvas mount ref
  const mountRef = useRef<HTMLDivElement | null>(null);

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
      soundManager.initAudio();
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
    soundManager.playSound('swing');
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
        soundManager.playSound('perfect');
        flashBackgroundRef.current = 'rgba(255, 255, 255, 0.15)';
        // Send haptic feedback trigger to mobile: 150ms vibration
        if (socketRef.current) socketRef.current.emit('game-event', { type: 'perfect', duration: 150 });
      } else {
        soundManager.playSound('hit');
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
    soundManager.playSound('alarm');
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

  // Main Three.js Render Loop (60fps)
  useEffect(() => {
    if (gameState === 'lobby') return; // Only setup scene when calibrating or playing

    const container = mountRef.current;
    if (!container) return;

    // 1. Scene & Renderer setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030308);

    const w = window.innerWidth;
    const h = window.innerHeight;

    const camera = new THREE.PerspectiveCamera(45, w / h, 1, 1000);
    camera.position.set(0, 110, 160);
    camera.lookAt(0, 10, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Clear and attach
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight.position.set(60, 180, 80);
    scene.add(dirLight);

    // Glowing cyberpunk spotlight
    const spotLight = new THREE.SpotLight(0x00f0ff, 4.0, 300, Math.PI / 4, 0.5, 1);
    spotLight.position.set(0, 150, 0);
    scene.add(spotLight);

    // 3. Floor Helpers (Grid & boundaries)
    const gridHelper = new THREE.GridHelper(360, 36, 0x00f0ff, 0x111122);
    gridHelper.position.y = 0;
    (gridHelper.material as THREE.Material).transparent = true;
    (gridHelper.material as THREE.Material).opacity = 0.15;
    scene.add(gridHelper);

    // Outer boundary ring (purple)
    const outerRingGeo = new THREE.RingGeometry(158, 162, 64);
    const outerRingMat = new THREE.MeshBasicMaterial({ color: 0xb026ff, side: THREE.DoubleSide, transparent: true, opacity: 0.15 });
    const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    outerRing.rotation.x = Math.PI / 2;
    scene.add(outerRing);

    // Strike Zone ring (neon blue)
    const strikeRingGeo = new THREE.RingGeometry(68, 72, 64);
    const strikeRingMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide, transparent: true, opacity: 0.25 });
    const strikeRing = new THREE.Mesh(strikeRingGeo, strikeRingMat);
    strikeRing.rotation.x = Math.PI / 2;
    scene.add(strikeRing);

    // 4. Create Samurai Character
    const { group: playerGroup, armPivot, bladeMat, blade, shieldBarrier } = createSamuraiCharacter();
    scene.add(playerGroup);

    // Load custom GLB Samurai Model
    const loader = new GLTFLoader();
    loader.load(
      '/iron_man_-_iron_samurai.glb',
      (gltf) => {
        const glbModel = gltf.scene;

        // Apply metallic cyberpunk styling and hide any built-in swords/weapons
        glbModel.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (child.material) {
              const materials = Array.isArray(child.material) ? child.material : [child.material];
              materials.forEach((mat) => {
                if (mat instanceof THREE.MeshStandardMaterial) {
                  mat.metalness = 0.85;
                  mat.roughness = 0.25;
                }
              });
            }

            // Hide pre-built swords/weapons inside the GLB model
            const nameLower = child.name.toLowerCase();
            if (
              nameLower.includes('sword') || 
              nameLower.includes('katana') || 
              nameLower.includes('blade') || 
              nameLower.includes('hilt') || 
              nameLower.includes('weapon') ||
              nameLower.includes('sheath') ||
              nameLower.includes('scabbard')
            ) {
              child.visible = false;
            }
          }
        });

        // Auto-scale using bounding box normalization (target height = 22 units)
        const box = new THREE.Box3().setFromObject(glbModel);
        const size = new THREE.Vector3();
        box.getSize(size);
        const height = size.y;
        
        const targetHeight = 22;
        const scaleFactor = targetHeight / (height || 1);
        glbModel.scale.set(scaleFactor, scaleFactor, scaleFactor);

        // Center the model's pivot relative to its bounding box min/center
        const center = new THREE.Vector3();
        box.getCenter(center);
        glbModel.position.set(-center.x * scaleFactor, -box.min.y * scaleFactor, -center.z * scaleFactor);

        // Hide the original simple placeholder meshes
        playerGroup.children.forEach((child) => {
          if ((child as any).isPlaceholder) {
            child.visible = false;
          }
        });

        // Add the loaded GLB model to the player group
        playerGroup.add(glbModel);
      },
      (xhr) => {
        console.log(`GLB Loading: ${Math.round((xhr.loaded / xhr.total) * 100)}%`);
      },
      (error) => {
        console.error('Error loading samurai GLB model:', error);
      }
    );

    // 5. Track 3D objects
    const enemyMeshes = new Map<string, THREE.Object3D>();
    const ghosts: { mesh: THREE.Mesh; opacity: number; material: THREE.MeshBasicMaterial }[] = [];

    // Particle system (using BufferGeometry + Points for speed & memory safety)
    const maxParticles = 500;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(maxParticles * 3);
    const colors = new Float32Array(maxParticles * 3);

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particleMaterial = new THREE.PointsMaterial({
      size: 2.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    const particlePoints = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particlePoints);

    // Resize handler
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    let animId: number;

    // Render loop
    const render = () => {
      if (gameState === 'playing' || gameState === 'calibration') {
        // 1. Spawning
        if (gameState === 'playing') {
          checkWaveProgression();
        }

        // 2. Camera shake
        if (screenShakeRef.current > 0) {
          const shake = screenShakeRef.current;
          const dx = (Math.random() - 0.5) * shake * 0.8;
          const dy = (Math.random() - 0.5) * shake * 0.8;
          const dz = (Math.random() - 0.5) * shake * 0.8;
          camera.position.set(dx, 110 + dy, 160 + dz);
          screenShakeRef.current *= 0.9;
          if (screenShakeRef.current < 0.2) screenShakeRef.current = 0;
        } else {
          camera.position.set(0, 110, 160);
        }
        camera.lookAt(0, 10, 0);

        // Flash pointlight glow
        if (flashBackgroundRef.current) {
          spotLight.intensity = 15.0;
          flashBackgroundRef.current = null;
        } else {
          spotLight.intensity = THREE.MathUtils.lerp(spotLight.intensity, 4.0, 0.1);
        }

        // 3. Position Player's Arm & Katana
        const phone = latestSensor.current.rotation;
        const yaw = (phone.alpha * Math.PI) / 180;
        const pitch = (phone.beta * Math.PI) / 180;
        const roll = (phone.gamma * Math.PI) / 180;
        armPivot.rotation.set(-pitch, yaw, roll, 'YXZ');

        // Dynamic Katana light and block shield
        if (blockActiveRef.current) {
          bladeMat.emissive.setHex(0xb026ff);
          shieldBarrier.visible = true;
          (shieldBarrier.material as THREE.MeshStandardMaterial).opacity = 0.22 + Math.sin(Date.now() / 150) * 0.08;
        } else {
          bladeMat.emissive.setHex(0x00f0ff);
          shieldBarrier.visible = false;
        }

        // Sword blade ghost trail
        const totalRotRate = Math.abs(latestSensor.current.gyro.alpha) + Math.abs(latestSensor.current.gyro.beta) + Math.abs(latestSensor.current.gyro.gamma);
        if (totalRotRate > 1.2) {
          const ghostGeo = new THREE.BoxGeometry(0.2, 28, 0.8);
          const ghostMat = new THREE.MeshBasicMaterial({
            color: blockActiveRef.current ? 0xb026ff : 0x00f0ff,
            transparent: true,
            opacity: 0.35
          });
          const ghost = new THREE.Mesh(ghostGeo, ghostMat);
          blade.updateMatrixWorld();
          ghost.matrix.copy(blade.matrixWorld);
          ghost.matrixAutoUpdate = false;
          scene.add(ghost);
          ghosts.push({ mesh: ghost, opacity: 0.35, material: ghostMat });
        }

        // Update trail ghosts
        for (let i = ghosts.length - 1; i >= 0; i--) {
          const g = ghosts[i];
          g.opacity -= 0.06;
          g.material.opacity = g.opacity;
          if (g.opacity <= 0) {
            scene.remove(g.mesh);
            g.mesh.geometry.dispose();
            g.material.dispose();
            ghosts.splice(i, 1);
          }
        }

        // 4. Draw & Update Enemies
        const activeEnemies = enemiesRef.current;
        activeEnemies.forEach(enemy => {
          enemy.pulseTimer += 0.05;

          const dist = Math.sqrt(enemy.x * enemy.x + enemy.y * enemy.y);
          if (enemy.state === 'approach') {
            if (dist < 22) {
              enemy.state = 'windup';
              enemy.windupCounter = 0;
              soundManager.playSound('alarm');
            } else {
              enemy.x -= Math.cos(enemy.angle) * enemy.speed;
              enemy.y -= Math.sin(enemy.angle) * enemy.speed;
            }
          } else if (enemy.state === 'windup') {
            enemy.windupCounter += 1;
            if (enemy.windupCounter >= enemy.windupTime) {
              if (blockActiveRef.current) {
                soundManager.playSound('hit');
                createExplosion(enemy.x, enemy.y, enemy.z, '#b026ff', 8);
                if (socketRef.current) socketRef.current.emit('game-event', { type: 'hit', duration: 40 });
              } else {
                takeDamage(enemy.type === 'samurai' ? 30 : enemy.type === 'kamikaze' ? 20 : 15);
              }
              enemy.state = 'dead';
              const idx = activeEnemies.indexOf(enemy);
              if (idx !== -1) activeEnemies.splice(idx, 1);
              return;
            }
          } else if (enemy.state === 'slashed') {
            enemy.state = 'dead';
            const idx = activeEnemies.indexOf(enemy);
            if (idx !== -1) activeEnemies.splice(idx, 1);
            return;
          }

          // Create if new
          if (!enemyMeshes.has(enemy.id)) {
            const mesh = createEnemyMesh(enemy.type, enemy.color);
            scene.add(mesh);
            enemyMeshes.set(enemy.id, mesh);
          }

          // Update position & lookAt
          const mesh = enemyMeshes.get(enemy.id);
          if (mesh) {
            mesh.position.set(enemy.x, enemy.z + 4, enemy.y);
            mesh.rotation.y += 0.025;
            
            if (enemy.type === 'drone') {
              mesh.position.y += Math.sin(enemy.pulseTimer) * 0.25;
              const rotors = (mesh as any).rotors;
              if (rotors) {
                rotors[0].rotation.y += 0.25;
                rotors[1].rotation.y += 0.25;
              }
            } else if (enemy.type === 'cyberninja') {
              mesh.rotation.x += 0.05;
              mesh.rotation.z += 0.02;
            } else if (enemy.type === 'shieldbot') {
              mesh.lookAt(0, 4, 0);
            }

            if (enemy.state === 'windup') {
              const scale = 1.0 + Math.sin(enemy.pulseTimer * 2.5) * 0.15;
              mesh.scale.set(scale, scale, scale);
              mesh.traverse(child => {
                if (child instanceof THREE.Mesh && child.material && 'emissive' in child.material) {
                  (child.material as THREE.MeshStandardMaterial).emissive.setHex(0xff3333);
                }
              });
            } else {
              mesh.scale.set(1, 1, 1);
            }
          }
        });

        // Clean disposed enemies
        for (const [id, mesh] of enemyMeshes.entries()) {
          const found = activeEnemies.some(e => e.id === id);
          if (!found) {
            scene.remove(mesh);
            mesh.traverse(child => {
              if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
                if (Array.isArray(child.material)) {
                  child.material.forEach(m => m.dispose());
                } else {
                  child.material.dispose();
                }
              }
            });
            enemyMeshes.delete(id);
          }
        }

        // 5. Update & Draw Particles
        const activeParticles = particlesRef.current;
        const posAttr = particleGeometry.getAttribute('position') as THREE.BufferAttribute;
        const colorAttr = particleGeometry.getAttribute('color') as THREE.BufferAttribute;

        let activeCount = 0;
        for (let pIdx = activeParticles.length - 1; pIdx >= 0; pIdx--) {
          const p = activeParticles[pIdx];
          p.life += 1;
          p.x += p.vx;
          p.y += p.vy;
          p.z += p.vz;
          p.vz -= 0.25; // gravity

          if (p.z <= 0) {
            p.z = 0;
            p.vz = -p.vz * 0.6;
            p.vx *= 0.8;
            p.vy *= 0.8;
          }

          if (p.life >= p.maxLife) {
            activeParticles.splice(pIdx, 1);
            continue;
          }

          if (activeCount < maxParticles) {
            posAttr.setXYZ(activeCount, p.x, p.z, p.y);
            const { r, g, b } = parseColor(p.color);
            colorAttr.setXYZ(activeCount, r, g, b);
            activeCount++;
          }
        }

        // Push inactive off-screen
        for (let i = activeCount; i < maxParticles; i++) {
          posAttr.setXYZ(i, 9999, 9999, 9999);
        }

        posAttr.needsUpdate = true;
        colorAttr.needsUpdate = true;

        // Render Frame
        renderer.render(scene, camera);
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      container.innerHTML = '';
      
      // Deep dispose scene
      scene.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
      particleGeometry.dispose();
      particleMaterial.dispose();
    };
  }, [gameState]);

  // Handle player damage events
  const takeDamage = (damage: number) => {
    soundManager.playSound('damage');
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

  const enterCalibrationScreen = () => {
    soundManager.initAudio();
    setGameState('calibration');
    enemiesRef.current = [];
    particlesRef.current = [];
    swordTrailRef.current = [];
  };

  const startGameplay = () => {
    soundManager.initAudio();
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
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    soundManager.setMuted(nextMuted);
  };

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      soundManager.cleanup();
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
        <Lobby
          roomId={roomId}
          backendUrl={backendUrl}
          setBackendUrl={setBackendUrl}
          controllerUrlBase={controllerUrlBase}
          setControllerUrlBase={setControllerUrlBase}
          isSearchingHost={isSearchingHost}
          isControllerConnected={isControllerConnected}
          qrCodeUrl={qrCodeUrl}
          hostGameSession={hostGameSession}
          startPlaying={startGameplay}
          onEnterCalibration={enterCalibrationScreen}
        />
      )}

      {/* CALIBRATION CHECK SCREEN */}
      {gameState === 'calibration' && (
        <CalibrationCheck
          detectedGesture={detectedGesture}
          blockActive={blockActiveRef.current}
          onBackToLobby={exitToLobby}
        />
      )}

      {/* GAME OVER SCREEN */}
      {gameState === 'gameover' && (
        <GameOver
          score={score}
          maxCombo={maxCombo}
          startPlaying={startGameplay}
          exitToLobby={exitToLobby}
        />
      )}

      {/* GAMEPLAY OVERLAY HUD */}
      {gameState === 'playing' && (
        <GameHUD
          health={health}
          combo={combo}
          score={score}
          wave={wave}
          detectedGesture={detectedGesture}
          latestSensor={latestSensor}
          blockActive={blockActiveRef.current}
        />
      )}

      {/* Main Game Screen Canvas */}
      <div ref={mountRef} className="game-canvas" />
    </div>
  );
}
