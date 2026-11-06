import type { StampNotice } from "./api";

export const noticeKindLabels: Record<StampNotice["kind"], string> = {
  closure: "Sperrung",
  defect: "Defekt",
  info: "Hinweis",
};
export function parseActiveNotices(value?: string): StampNotice[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is StampNotice =>
            item &&
            typeof item.ID === "string" &&
            typeof item.message === "string" &&
            ["closure", "defect", "info"].includes(item.kind) &&
            ["official", "community"].includes(item.source),
        )
      : [];
  } catch {
    return [];
  }
}
