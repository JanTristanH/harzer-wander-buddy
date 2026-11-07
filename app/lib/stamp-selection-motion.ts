// Keep the complete success moment at least as deliberate as the approved demo.
export const STAMP_SELECTION_FILL_MS = 1200;
export const STAMP_FLIGHT_MS = 1000;
export const STAMP_SEAL_ENTER_MS = 250;
export const STAMP_SEAL_HOLD_MS = 1250;
export const STAMP_SEAL_EXIT_MS = 450;

export function stampSelectionTiming(count: number) {
  // Every visit gets a particle. Large batches share a bounded stagger window.
  const staggerWindowMs = Math.min(Math.max(0, count - 1) * 180, 1080);
  const sealStartMs = STAMP_FLIGHT_MS + staggerWindowMs + 150;
  const durationMs = sealStartMs + STAMP_SEAL_ENTER_MS + STAMP_SEAL_HOLD_MS + STAMP_SEAL_EXIT_MS;
  return { staggerWindowMs, sealStartMs, durationMs };
}
