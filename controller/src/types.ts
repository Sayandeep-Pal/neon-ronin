export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Rotation {
  alpha: number;
  beta: number;
  gamma: number;
}

export interface SensorData {
  accel: Vec3;
  rotation: Rotation;
  gyro: Rotation;
}

export type GestureType = 'HORIZONTAL' | 'VERTICAL' | 'DIAGONAL' | 'THRUST' | 'BLOCK' | 'IDLE';

export type FeedbackFlash = 'hit' | 'perfect' | 'damage' | '';
