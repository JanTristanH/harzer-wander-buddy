import React, { useState } from "react";
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { reportStampNotice, type StampNotice } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useConnectivity } from "@/lib/connectivity";
import { noticeKindLabels, parseActiveNotices } from "@/lib/stamp-notices";

export function StampNoticesSection({
  stampId,
  value,
}: {
  stampId: string;
  value?: string;
}) {
  const notices = parseActiveNotices(value);
  const { accessToken } = useAuth();
  const { isOffline } = useConnectivity();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<StampNotice["kind"]>("defect");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!accessToken || isOffline || busy) return;
    setBusy(true);
    setStatus("");
    try {
      await reportStampNotice(accessToken, stampId, kind, message.trim());
      setMessage("");
      setOpen(false);
      setStatus(
        "Danke! Deine Meldung wird geprüft und erst nach Freigabe veröffentlicht.",
      );
    } catch {
      setStatus(
        "Die Meldung konnte nicht gesendet werden. Bitte erneut versuchen.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Sperrungen & Defekte</Text>
      {notices.length ? (
        notices.map((notice) => (
          <View key={notice.ID} style={styles.warning}>
            <Text style={styles.warningTitle}>
              ⚡ {noticeKindLabels[notice.kind]}
            </Text>
            <Text style={styles.body}>{notice.message}</Text>
            <Text style={styles.meta}>
              {notice.source === "official"
                ? "Harzer Wandernadel"
                : "Community · vom Admin freigegeben"}
              {notice.checkedAt || notice.reviewedAt
                ? ` · Stand ${new Date(notice.checkedAt || notice.reviewedAt!).toLocaleDateString("de-DE")}`
                : ""}
            </Text>
            {notice.source === "official" ? (
              <Pressable
                accessibilityRole="link"
                onPress={() =>
                  void Linking.openURL(
                    "https://www.harzer-wandernadel.de/defektmeldungen/",
                  )
                }
              >
                <Text style={styles.link}>Offizielle Quelle öffnen ↗</Text>
              </Pressable>
            ) : null}
          </View>
        ))
      ) : (
        <Text style={styles.meta}>
          Keine freigegebenen Meldungen bekannt. Das ist keine Garantie für
          freie Wege oder einen intakten Stempel.
        </Text>
      )}
      {isOffline ? (
        <Text style={styles.meta}>
          Offline: zuletzt geladener Stand. Meldungen können erst online
          gesendet werden.
        </Text>
      ) : null}
      {status ? (
        <Text accessibilityRole="alert" style={styles.body}>
          {status}
        </Text>
      ) : null}
      {!open ? (
        <Pressable
          accessibilityRole="button"
          disabled={isOffline}
          onPress={() => (accessToken ? setOpen(true) : router.push("/login"))}
          style={styles.button}
        >
          <Text style={styles.link}>
            {accessToken
              ? "Sperrung oder Defekt melden"
              : "Zum Melden anmelden"}
          </Text>
        </Pressable>
      ) : (
        <View style={{ gap: 10 }}>
          <Text style={styles.meta}>
            Beschreibe deine Beobachtung vor Ort. Die Meldung ist bis zur
            Admin-Freigabe nicht öffentlich. Sie wird nicht an die Harzer
            Wandernadel weitergeleitet.
          </Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {(["defect", "closure", "info"] as const).map((item) => (
              <Pressable
                key={item}
                accessibilityRole="radio"
                accessibilityState={{ checked: kind === item }}
                onPress={() => setKind(item)}
                style={[styles.button, kind === item && styles.selected]}
              >
                <Text>{noticeKindLabels[item]}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            accessibilityLabel="Beschreibung der Meldung"
            multiline
            maxLength={2000}
            placeholder="Was ist passiert? Seit wann? Welcher Zugang ist betroffen?"
            value={message}
            onChangeText={setMessage}
            style={styles.input}
          />
          <Text style={styles.meta}>
            {message.trim().length}/2000 Zeichen · mindestens 10
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={busy || isOffline || message.trim().length < 10}
            onPress={() => void submit()}
            style={[
              styles.button,
              (busy || message.trim().length < 10) && { opacity: 0.5 },
            ]}
          >
            <Text style={styles.link}>
              {busy ? "Wird gesendet …" : "Zur Prüfung senden"}
            </Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setOpen(false)}>
            <Text style={styles.meta}>Abbrechen</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  section: { gap: 12, paddingVertical: 18 },
  heading: { color: "#1e2a1e", fontSize: 19, fontWeight: "700" },
  warning: {
    backgroundColor: "#fff4d7",
    borderColor: "#e5bb62",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 7,
  },
  warningTitle: { color: "#75400d", fontWeight: "700", fontSize: 16 },
  body: { color: "#3e483c", fontSize: 14, lineHeight: 21 },
  meta: { color: "#64705f", fontSize: 12, lineHeight: 18 },
  link: { color: "#2e6b4b", fontWeight: "600", fontSize: 14 },
  button: {
    alignSelf: "flex-start",
    borderRadius: 10,
    backgroundColor: "#e8eee3",
    padding: 12,
  },
  selected: {
    backgroundColor: "#c6dbb8",
    borderWidth: 1,
    borderColor: "#2e6b4b",
  },
  input: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: "#aebca6",
    padding: 12,
    borderRadius: 10,
    color: "#1e2a1e",
    backgroundColor: "#fff",
  },
});
