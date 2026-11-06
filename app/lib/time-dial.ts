export const TIME_DIAL_MIN = 15;
export const TIME_DIAL_MAX = 720;
export const TIME_DIAL_STEP = 5;
export function clampDialMinutes(minutes: number) {
  return Math.max(TIME_DIAL_MIN, Math.min(TIME_DIAL_MAX, minutes));
}
export function snapDialMinutes(minutes: number) {
  return clampDialMinutes(
    Math.round(minutes / TIME_DIAL_STEP) * TIME_DIAL_STEP,
  );
}
/** Small signed delta across twelve o'clock, supporting repeated rotations. */
export function dialAngleDelta(previous: number, next: number) {
  return ((next - previous + 540) % 360) - 180;
}
export function dialMinutesLabel(minutes: number) {
  const hours = Math.floor(minutes / 60),
    rest = minutes % 60;
  return `${hours ? `${hours} Std.` : ""}${hours && rest ? " " : ""}${rest ? `${rest} Min.` : ""}`;
}
