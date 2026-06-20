import type { GestureType } from './types';

export const LP_ALPHA = 0.18; // tuned for motion-controller feel
export const SLASH_THRESHOLD = 14;
export const GESTURE_COOLDOWN_MS = 350;
export const BLOCK_MOTION_THRESHOLD = 2.5;
export const BLOCK_BETA_MIN = 55;
export const BLOCK_BETA_MAX = 115;
export const BLOCK_GAMMA_MAX = 28;

export const GESTURE_META: Record<GestureType, { label: string; color: string; hint: string }> = {
  HORIZONTAL: { label: '← HORIZONTAL →', color: '#00f0ff', hint: 'vs Drones'       },
  VERTICAL:   { label: '↓ VERTICAL ↓',   color: '#b026ff', hint: 'vs Shield Bots'  },
  DIAGONAL:   { label: '↘ DIAGONAL ↖',   color: '#ff007f', hint: 'vs Cyber Ninjas' },
  THRUST:     { label: '▶ THRUST',        color: '#ffaa00', hint: 'vs Kamikazes'    },
  BLOCK:      { label: '⛊  BLOCKING',     color: '#7df9ff', hint: 'Guard Active'    },
  IDLE:       { label: '',                color: 'transparent', hint: ''           },
};
