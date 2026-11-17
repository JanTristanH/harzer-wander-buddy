import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchNoticeReports,
  reviewStampNotice,
  syncOfficialNotices,
  type NoticeSyncResult,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useConnectivity } from "@/lib/connectivity";
import { noticeKindLabels } from "@/lib/stamp-notices";

export function AdminNoticesPanel() {
  const { accessToken } = useAuth();
  const { isOffline } = useConnectivity();
  const client = useQueryClient();
  const [sync, setSync] = useState<NoticeSyncResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const reports = useQuery({
    queryKey: ["admin-notices"],
    queryFn: () => fetchNoticeReports(accessToken!),
    enabled: Boolean(accessToken) && !isOffline,
    staleTime: 0,
    refetchOnMount: true,
  });
  async function run(work: () => Promise<void>) {
    if (busy || isOffline || !accessToken) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Aktion fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }
  async function moderate(ID: string, status: string) {
    await reviewStampNotice(accessToken!, ID, status);
    await client.invalidateQueries();
    setMessage("Meldung aktualisiert.");
  }
  const disabled = busy || isOffline;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Sperrungen & Defektmeldungen</Text>
      <Text style={styles.body}>
        Offizielle Hinweise werden von der Harzer Wandernadel übernommen.
        Nutzermeldungen werden erst nach deiner Freigabe veröffentlicht.
      </Text>
      <Text style={styles.meta}>
        Import: eindeutige Stempelnummer oder exakter Name. Nicht zuordenbare
        Einträge bleiben zur Prüfung sichtbar; bestehende Warnungen werden dann
        nicht automatisch entfernt.
      </Text>
      {isOffline ? (
        <Text style={styles.error}>Nur online verfügbar.</Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        style={styles.button}
        onPress={() =>
          void run(async () =>
            setSync(await syncOfficialNotices(accessToken!, true)),
          )
        }
      >
        <Text style={styles.link}>
          {busy ? "Bitte warten …" : "Offizielle Quelle prüfen (Vorschau)"}
        </Text>
      </Pressable>
      {sync ? (
        <View style={styles.preview}>
          <Text style={styles.subtitle}>
            {sync.preview ? "Importvorschau" : "Synchronisierung abgeschlossen"}
          </Text>
          <Text style={styles.body}>
            {sync.matched.length} zugeordnet · {sync.unmatched.length} nicht
            zugeordnet
          </Text>
          <Text style={styles.meta}>
            Abgerufen: {new Date(sync.checkedAt).toLocaleString("de-DE")}
          </Text>
          {sync.matched.map((entry, i) => (
            <Text key={i} style={styles.meta}>
              {entry.stampName}: {entry.message}
            </Text>
          ))}
          {sync.unmatched.map((entry, i) => (
            <Text key={i} style={styles.error}>
              Zuordnung prüfen: {entry.message}
            </Text>
          ))}
          {sync.retainedPrevious ? (
            <Text style={styles.error}>
              Bisherige Warnungen wurden wegen offener Zuordnungen beibehalten.
            </Text>
          ) : null}
          {sync.preview ? (
            <Pressable
              accessibilityRole="button"
              disabled={disabled}
              style={styles.button}
              onPress={() =>
                void run(async () => {
                  setSync(await syncOfficialNotices(accessToken!, false));
                  await client.invalidateQueries();
                })
              }
            >
              <Text style={styles.link}>Jetzt synchronisieren</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {message ? (
        <Text accessibilityRole="alert" style={styles.body}>
          {message}
        </Text>
      ) : null}
      <Text style={styles.subtitle}>Nutzermeldungen prüfen</Text>
      {reports.isPending ? (
        <Text style={styles.meta}>Meldungen werden geladen …</Text>
      ) : null}
      {reports.isError ? (
        <Pressable onPress={() => void reports.refetch()}>
          <Text style={styles.error}>
            Meldungen nicht geladen. Erneut versuchen.
          </Text>
        </Pressable>
      ) : null}
      {reports.data
        ?.filter(
          (report) =>
            report.source === "community" &&
            ["pending", "approved"].includes(report.status),
        )
        .map((report) => (
          <View style={styles.preview} key={report.ID}>
            <Text style={styles.subtitle}>
              {report.stamp?.number} · {report.stamp?.name || report.stamp_ID}
            </Text>
            <Text style={styles.meta}>
              {noticeKindLabels[report.kind]} ·{" "}
              {report.status === "pending" ? "In Prüfung" : "Veröffentlicht"} ·{" "}
              {new Date(report.createdAt).toLocaleDateString("de-DE")}
            </Text>
            <Text style={styles.body}>{report.message}</Text>
            <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
              {(report.status === "pending"
                ? [
                    ["approved", "Freigeben"],
                    ["rejected", "Ablehnen"],
                  ]
                : [["resolved", "Als erledigt markieren"]]
              ).map(([status, label]) => (
                <Pressable
                  key={status}
                  accessibilityRole="button"
                  disabled={disabled}
                  style={styles.button}
                  onPress={() => void run(() => moderate(report.ID, status))}
                >
                  <Text style={styles.link}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      {reports.data &&
      !reports.data.some(
        (report) =>
          report.source === "community" &&
          ["pending", "approved"].includes(report.status),
      ) ? (
        <Text style={styles.meta}>Keine offenen Nutzermeldungen.</Text>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 18, gap: 14 },
  title: { color: "#1e2a1e", fontSize: 19, fontWeight: "700" },
  subtitle: { color: "#1e2a1e", fontSize: 15, fontWeight: "600" },
  body: { color: "#3e483c", fontSize: 14, lineHeight: 20 },
  meta: { color: "#64705f", fontSize: 12, lineHeight: 18 },
  error: { color: "#a13e2e", fontSize: 13 },
  link: { color: "#2e6b4b", fontWeight: "600" },
  button: {
    alignSelf: "flex-start",
    borderRadius: 10,
    backgroundColor: "#e8eee3",
    padding: 12,
  },
  preview: {
    borderWidth: 1,
    borderColor: "#dfd6b8",
    backgroundColor: "#fffcf3",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
});
