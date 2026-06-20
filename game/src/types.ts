export interface SensorData {
  accel: { x: number; y: number; z: number };
  rotation: { alpha: number; beta: number; gamma: number };
  gyro: { alpha: number; beta: number; gamma: number };
  timestamp: number;
}

export interface Enemy {
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

export interface Particle {
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
