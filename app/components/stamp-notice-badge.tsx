import React from "react";
import { Text } from "react-native";
import { parseActiveNotices } from "@/lib/stamp-notices";

export function StampNoticeBadge({ value }: { value?: string }) {
  const notices = parseActiveNotices(value);
  if (!notices.length) return null;
  return (
    <Text
      accessibilityLabel={`${notices.length} aktuelle Sperrungen oder Hinweise`}
      style={{
        color: "#824616",
        backgroundColor: "#fff0c2",
        borderRadius: 8,
        paddingHorizontal: 6,
        fontSize: 12,
        fontWeight: "700",
      }}
    >
      ⚡{" "}
      {notices.some((n) => n.kind === "closure")
        ? "Sperrung"
        : notices.some((n) => n.kind === "defect")
          ? "Defekt"
          : "Hinweis"}
    </Text>
  );
}
