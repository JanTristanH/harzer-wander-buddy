export const geometry: {
  width: number;
  height: number;
  outputWidth: number;
  outputHeight: number;
  pinPath: string;
  badgeY: number;
  badgeRy: number;
  labelY: number;
  labelStyles: { fontSize: number; badgeRx: number }[];
};
export function resolveMapMarkerLabelStyle(label: string): { fontSize: number; badgeRx: number };
