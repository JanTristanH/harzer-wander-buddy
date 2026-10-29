import { AccessibilityInfo } from "react-native";
import React, { useEffect, useRef, useState } from "react";
import type { HikingRouteResult, PointOfInterest } from "@/lib/api";
import { TourRouteMap } from "@/components/tour-planner-ui";
import {
  formatTourDistance,
  formatTourDuration,
  routeName,
  routeStops,
} from "@/lib/tour-automation";

type Props = {
  route: HikingRouteResult;
  points: PointOfInterest[];
  title?: string;
  index?: number;
  total?: number;
  onSelect?: (index: number) => void;
  primaryLabel: string;
  onPrimary: () => void;
  busy?: boolean;
  disabled?: boolean;
  error?: string;
  notification?: string;
  onParameters?: () => void;
  description?: string;
  secondaryLabel?: string;
  onSecondary?: () => void;
};
const green = "#2e6b4b",
  ink = "#1e2a1e";
export function TourExperience({
  route,
  points,
  title,
  index = 0,
  total = 1,
  onSelect,
  primaryLabel,
  onPrimary,
  busy,
  disabled,
  error,
  notification,
  onParameters,
  secondaryLabel,
  onSecondary,
  description,
}: Props) {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduced(value);
      })
      .catch(() => {});
    const listener = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => {
      mounted = false;
      listener.remove();
    };
  }, []);
  const root = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(700);
  const [sheet, setSheet] = useState(350);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: number; y: number; start: number } | null>(null);
  const moved = useRef(false);
  const measured = useRef(false);
  const max = Math.max(240, height - 44),
    peek = Math.min(270, max),
    middle = Math.min(350, Math.round(height * 0.52));
  const bounded = (v: number) => Math.max(peek, Math.min(max, v));
  useEffect(() => {
    if (!root.current) return;
    const observer = new ResizeObserver((entries) => {
      const h = entries[0].contentRect.height;
      setHeight(h);
      if (!measured.current) {
        setSheet(Math.min(350, Math.round(h * 0.52)));
        measured.current = true;
      } else
        setSheet((old) =>
          Math.max(Math.min(270, h - 44), Math.min(h - 44, old)),
        );
    });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  const stops = routeStops(route, points);
  const expanded = sheet > middle + 30;
  const compact = sheet < middle - 30;
  useEffect(() => {
    if (content.current) content.current.scrollTop = 0;
  }, [route.id]);
  const cycle = () => setSheet((old) => (old < max - 30 ? max : middle));
  const stop = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    setSheet((old) =>
      [peek, middle, max].reduce(
        (best, v) => (Math.abs(v - old) < Math.abs(best - old) ? v : best),
        middle,
      ),
    );
  };
  return (
    <div
      ref={root}
      data-testid="tour-map-sheet"
      style={{
        flex: "1 1 0",
        minHeight: 0,
        width: "100%",
        position: "relative",
        overflow: "hidden",
        background: "#e7eddc",
        fontFamily: "system-ui,sans-serif",
        color: ink,
      }}
    >
      <div style={{ position: "absolute", inset: 0 }}>
        <TourRouteMap key={route.id} route={route} points={points} fullHeight />
      </div>
      <section
        aria-label="Tour und Stationen"
        data-testid="tour-bottom-sheet"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: bounded(sheet),
          background: "#fff",
          borderRadius: "28px 28px 0 0",
          boxShadow: "0 -5px 25px #243e2526",
          display: "flex",
          flexDirection: "column",
          transition: dragging || reduced ? "none" : "height 220ms ease",
          overflow: "hidden",
        }}
      >
        <div
          role="slider"
          tabIndex={0}
          aria-label="Höhe der Touren-Details"
          aria-orientation="vertical"
          aria-valuemin={Math.round(peek)}
          aria-valuemax={Math.round(max)}
          aria-valuenow={Math.round(sheet)}
          aria-valuetext={
            expanded ? "Details aufgeklappt" : "Kartenvorschau mit Tour"
          }
          data-testid="tour-sheet-handle"
          style={{
            flexShrink: 0,
            padding: "12px 22px 8px",
            touchAction: "none",
            cursor: dragging ? "grabbing" : "grab",
            userSelect: "none",
            outlineOffset: -4,
          }}
          onPointerDown={(event) => {
            if (!event.isPrimary || event.button !== 0) return;
            event.preventDefault();
            moved.current = false;
            drag.current = {
              id: event.pointerId,
              y: event.clientY,
              start: sheet,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragging(true);
          }}
          onPointerMove={(event) => {
            const d = drag.current;
            if (!d || d.id !== event.pointerId) return;
            event.preventDefault();
            if (Math.abs(event.clientY - d.y) > 4) moved.current = true;
            setSheet(bounded(d.start + d.y - event.clientY));
          }}
          onPointerUp={stop}
          onPointerCancel={stop}
          onLostPointerCapture={() => {
            drag.current = null;
            setDragging(false);
          }}
          onClick={() => {
            if (!moved.current) cycle();
          }}
          onKeyDown={(event) => {
            if (
              ["ArrowUp", "ArrowDown", "Home", "End", "Enter", " "].includes(
                event.key,
              )
            ) {
              event.preventDefault();
              setSheet((old) =>
                event.key === "Home"
                  ? peek
                  : event.key === "End"
                    ? max
                    : event.key === "ArrowDown"
                      ? bounded(old - 100)
                      : event.key === "ArrowUp"
                        ? bounded(old + 100)
                        : old < max - 30
                          ? max
                          : middle,
              );
            }
          }}
        >
          <div
            style={{
              width: 42,
              height: 4,
              borderRadius: 4,
              background: "#c7d2c3",
              margin: "0 auto 9px",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: green }}>
              {title
                ? "Gespeicherte Tour"
                : `${route.matchingStampCount} ${(route.groupSize ?? 1) > 1 ? "passende" : "neue"} Stempel`}
            </span>
            <span style={{ fontSize: 12, color: "#596553" }}>
              Tour & Stationen {expanded ? "⌄" : "⌃"}
            </span>
          </div>
        </div>
        <div
          data-testid="tour-sheet-summary"
          style={{ flexShrink: 0, padding: "0 22px" }}
        >
          <h2
            style={{
              fontSize: compact ? 19 : 24,
              lineHeight: 1.2,
              letterSpacing: "-.6px",
              margin: compact ? "2px 0 6px" : "5px 0 8px",
              fontWeight: 750,
              ...(compact
                ? {
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }
                : {}),
            }}
          >
            {title || routeName(route, points, index)}
          </h2>
          <div
            style={{
              fontSize: compact ? 14 : 16,
              color: "#42563e",
              marginBottom: compact ? 6 : 10,
            }}
          >
            {formatTourDuration(route.duration)} ·{" "}
            {formatTourDistance(route.distance)}
          </div>
          {onSelect && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                border: "1px solid #d7dfd3",
                borderRadius: 14,
                marginBottom: compact ? 6 : 16,
              }}
            >
              <button
                type="button"
                aria-label="Vorheriger Vorschlag"
                disabled={index === 0}
                onClick={() => onSelect(index - 1)}
                style={{
                  ...pagerButton(index === 0),
                  height: compact ? 32 : 42,
                }}
              >
                ‹
              </button>
              <span
                aria-live="polite"
                style={{ fontSize: 14, fontVariantNumeric: "tabular-nums" }}
              >
                {index + 1} / {total} Vorschläge
              </span>
              <button
                type="button"
                aria-label="Nächster Vorschlag"
                disabled={index === total - 1}
                onClick={() => onSelect(index + 1)}
                style={{
                  ...pagerButton(index === total - 1),
                  height: compact ? 32 : 42,
                }}
              >
                ›
              </button>
            </div>
          )}
        </div>
        <div
          ref={content}
          data-testid="tour-sheet-content"
          style={{
            overflowY: "auto",
            overscrollBehavior: "contain",
            minHeight: 0,
            flex: 1,
            padding: "0 22px 18px",
            touchAction: "pan-y",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 14,
              flexWrap: "wrap",
              fontSize: 13,
              color: "#596553",
              padding: "10px 0 14px",
              borderBottom: "1px solid #edf0e9",
            }}
          >
            <span>↑ {Math.round(route.totalElevationGain ?? 0)} m</span>
            <span>↓ {Math.round(route.totalElevationLoss ?? 0)} m</span>
            <span>{route.stampCount ?? 0} Stempel</span>
          </div>
          <h3 style={{ fontSize: 17, margin: "18px 0 10px" }}>Stationen</h3>
          <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {stops.map((point, i) => (
              <li
                key={`${point.ID}-${i}`}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "11px 0",
                  borderBottom: "1px solid #edf0e9",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    background:
                      point.poiType === "parking" ? "#e5edf5" : "#e6eee4",
                    color: green,
                    minWidth: 34,
                    height: 34,
                    borderRadius: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 750,
                  }}
                >
                  {point.poiType === "parking"
                    ? "P"
                    : `#${point.stampNumber || "·"}`}
                </span>
                <span style={{ fontSize: 14, lineHeight: 1.4 }}>
                  {point.name}
                  <small
                    style={{ display: "block", color: "#6b7765", fontSize: 11 }}
                  >
                    {i === 0
                      ? "Start"
                      : i === stops.length - 1
                        ? point.ID === stops[0]?.ID
                          ? "Ziel / Rückkehr"
                          : "Ziel"
                        : `Stopp ${i}`}
                  </small>
                </span>
              </li>
            ))}
          </ol>
          {stops.length === 0 && (
            <p style={{ color: "#596553", fontSize: 14 }}>
              Diese Tour hat noch keine Stationen. Im Editor kannst du Start und
              Ziel hinzufügen.
            </p>
          )}
          {description && (
            <p style={{ fontSize: 13, color: "#596553", lineHeight: 1.5 }}>
              {description}
            </p>
          )}
          {(route.groupSize ?? 1) > 1 && (
            <p style={{ fontSize: 13, color: "#596553" }}>
              {route.newStampCountForUser ?? 0} neue Stempel für dich ·{" "}
              {route.groupSize} Personen in der Planung.
            </p>
          )}
        </div>
        <footer
          style={{
            flexShrink: 0,
            padding: "10px 22px max(12px, env(safe-area-inset-bottom))",
            borderTop: "1px solid #edf0e9",
            background: "#fff",
          }}
        >
          {notification && !compact && (
            <div
              role="status"
              style={{ color: green, fontSize: 12, marginBottom: 6 }}
            >
              {notification}
            </div>
          )}
          {error && (
            <div
              role="alert"
              style={{ color: "#ac3427", fontSize: 13, marginBottom: 6 }}
            >
              {error}
            </div>
          )}
          <button
            type="button"
            disabled={Boolean(disabled || busy)}
            onClick={onPrimary}
            style={{
              width: "100%",
              minHeight: 50,
              border: 0,
              borderRadius: 15,
              background: green,
              color: "#fff",
              font: "700 16px system-ui",
              cursor: "pointer",
              opacity: disabled || busy ? 0.55 : 1,
            }}
          >
            {primaryLabel}
          </button>
          {onSecondary && (
            <button
              type="button"
              onClick={onSecondary}
              style={{
                width: "100%",
                minHeight: 36,
                border: 0,
                background: "transparent",
                color: green,
                font: "14px system-ui",
                cursor: "pointer",
                marginTop: 3,
              }}
            >
              {secondaryLabel}
            </button>
          )}
          {onParameters && (
            <button
              type="button"
              onClick={onParameters}
              style={{
                width: "100%",
                minHeight: 36,
                border: 0,
                background: "transparent",
                color: green,
                font: "14px system-ui",
                cursor: "pointer",
                marginTop: 3,
              }}
            >
              Parameter ändern
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
function pagerButton(disabled: boolean): React.CSSProperties {
  return {
    width: 48,
    height: 42,
    border: 0,
    background: "transparent",
    color: green,
    fontSize: 28,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.35 : 1,
  };
}
