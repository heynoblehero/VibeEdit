import { Easing } from 'remotion';

export const snappy = Easing.bezier(0.5, 0, 0.2, 1); // fast-in, slow-settle
export const anticipation = Easing.bezier(0.8, -0.2, 0.2, 1); // goes backward first
export const bouncy = Easing.bezier(0.2, 1.3, 0.4, 1); // overshoots
export const settle = Easing.bezier(0.1, 0.4, 0.2, 1); // soft landing
export const cartoonIn = Easing.bezier(0.55, 0, 0.4, 1.4); // classic cartoon pop

// Step function for "animating on 2s" — quantizes frame to every Nth frame
export const stepFrame = (frame: number, step: number) =>
  Math.floor(frame / step) * step;
