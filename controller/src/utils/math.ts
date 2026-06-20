import { LP_ALPHA } from '../constants';

export function lpf(prev: number, next: number, alpha = LP_ALPHA): number {
  return prev + alpha * (next - prev);
}
