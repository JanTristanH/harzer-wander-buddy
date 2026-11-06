/** Legacy rows have no kind; a numbered special stamp must never become HWN 1–222. */
export function isRegularStamp(stamp: { number: string; stampKind?: string }) {
  return stamp.stampKind !== 'special' && /^\d+$/.test(stamp.number) && Number(stamp.number) >= 1 && Number(stamp.number) <= 222;
}
