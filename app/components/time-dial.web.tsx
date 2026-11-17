import React, { useRef } from "react";
import {
  clampDialMinutes,
  dialAngleDelta,
  dialMinutesLabel,
  snapDialMinutes,
  TIME_DIAL_MIN,
  TIME_DIAL_MAX,
} from "@/lib/time-dial";
import { MaterialIcons } from "@expo/vector-icons";

type Props = {
  minutes: string;
  onInteract: () => void;
  onChange: (minutes: string) => void;
};
/** One turn = one hour. Pointer capture keeps touch and mouse drags on the dial. */
export function TimeDial({ minutes, onInteract, onChange }: Props) {
  const numeric = Number(minutes);
  const value =
    Number.isFinite(numeric) &&
    numeric >= TIME_DIAL_MIN &&
    numeric <= TIME_DIAL_MAX
      ? numeric
      : 120;
  const gesture = useRef<{
    pointer: number;
    lastAngle: number;
    rawMinutes: number;
    cx: number;
    cy: number;
  } | null>(null);
  const angle = (value % 60) * 6;
  const radians = (angle * Math.PI) / 180;
  const ring = 2 * Math.PI * 104;
  const fraction = value % 60 === 0 ? 1 : (value % 60) / 60;
  const pointerAngle = (x: number, y: number, cx: number, cy: number) =>
    ((Math.atan2(x - cx, cy - y) * 180) / Math.PI + 360) % 360;
  const end = (event: React.PointerEvent<HTMLDivElement>) => {
    if (gesture.current?.pointer !== event.pointerId) return;
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Zeitbudget durch Drehen einstellen"
      aria-valuemin={TIME_DIAL_MIN}
      aria-valuemax={TIME_DIAL_MAX}
      aria-valuenow={value}
      aria-valuetext={dialMinutesLabel(value)}
      data-testid="time-dial"
      style={{
        width: 214,
        height: 214,
        position: "relative",
        touchAction: "none",
        userSelect: "none",
        cursor: "grab",
        borderRadius: "50%",
        outlineOffset: 8,
        flexShrink: 0,
      }}
      onPointerDown={(event) => {
        if (
          !event.isPrimary ||
          (event.pointerType === "mouse" && event.button !== 0)
        )
          return;
        const bounds = event.currentTarget.getBoundingClientRect(),
          cx = bounds.left + bounds.width / 2,
          cy = bounds.top + bounds.height / 2;
        const radius = Math.hypot(event.clientX - cx, event.clientY - cy);
        if (radius < 70 || radius > 135) return;
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        gesture.current = {
          pointer: event.pointerId,
          lastAngle: pointerAngle(event.clientX, event.clientY, cx, cy),
          rawMinutes: value,
          cx,
          cy,
        };
        onInteract();
      }}
      onPointerMove={(event) => {
        const current = gesture.current;
        if (!current || current.pointer !== event.pointerId) return;
        event.preventDefault();
        const next = pointerAngle(
          event.clientX,
          event.clientY,
          current.cx,
          current.cy,
        );
        current.rawMinutes = clampDialMinutes(
          current.rawMinutes + dialAngleDelta(current.lastAngle, next) / 6,
        );
        current.lastAngle = next;
        onChange(String(snapDialMinutes(current.rawMinutes)));
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={() => {
        gesture.current = null;
      }}
      onKeyDown={(event) => {
        const values: Record<string, number> = {
          ArrowUp: value + 5,
          ArrowRight: value + 5,
          ArrowDown: value - 5,
          ArrowLeft: value - 5,
          PageUp: value + 60,
          PageDown: value - 60,
          Home: TIME_DIAL_MIN,
          End: TIME_DIAL_MAX,
        };
        if (!(event.key in values)) return;
        event.preventDefault();
        onInteract();
        onChange(String(snapDialMinutes(values[event.key])));
      }}
    >
      <svg
        width="214"
        height="214"
        viewBox="0 0 214 214"
        aria-hidden="true"
        style={{
          overflow: "visible",
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
        }}
      >
        <circle
          cx="107"
          cy="107"
          r="104"
          fill="none"
          stroke="#c7d2c3"
          strokeWidth="5"
        />
        <circle
          cx="107"
          cy="107"
          r="104"
          fill="none"
          stroke="#2e6b4b"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${ring * fraction} ${ring}`}
          transform="rotate(-90 107 107)"
        />
        {Array.from({ length: 12 }, (_, i) => (
          <line
            key={i}
            x1="107"
            y1="16"
            x2="107"
            y2={i % 3 === 0 ? 24 : 20}
            stroke="#a4b5a0"
            strokeWidth={i % 3 === 0 ? 2 : 1}
            transform={`rotate(${i * 30} 107 107)`}
          />
        ))}
      </svg>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 107 + 104 * Math.sin(radians) - 22,
          top: 107 - 104 * Math.cos(radians) - 22,
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "#2e6b4b",
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 2px 7px #183c2926",
          pointerEvents: "auto",
        }}
      >
        <MaterialIcons name="hiking" size={27} color="#ffffff" />
      </div>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 30,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 7,
          pointerEvents: "none",
          color: "#1e2a1e",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <span
          style={{
            fontSize: value % 60 ? 27 : 36,
            lineHeight: 1.2,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
        >
          {dialMinutesLabel(value)}
        </span>
        <span style={{ color: "#596553", fontSize: 12 }}>
          Drehen für eigene Zeit
        </span>
      </div>
    </div>
  );
}
