export const geometry: {
  width: number;
  height: number;
  outputWidth: number;
  outputHeight: number;
  pinPath: string;
  badgeY: number;
  labelY: number;
  labelStyles: { fontSize: number; badgeRadius: number; textWidth: number }[];
};
export function resolveMapMarkerLabelStyle(label: string): { fontSize: number; badgeRadius: number; textWidth: number };
