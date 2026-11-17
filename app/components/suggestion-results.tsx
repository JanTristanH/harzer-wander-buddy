import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TourExperience } from "@/components/tour-experience";
import { useAuth } from "@/lib/auth";
import { usePointsOfInterestQuery } from "@/lib/queries";
import { routeName } from "@/lib/tour-automation";
import {
  useTourSuggestions,
  type TourSuggestions,
} from "@/lib/tour-suggestions";
export function SuggestionResults({
  suggestions,
  index,
  onSelect,
  onBack,
  onParameters,
}: {
  suggestions: TourSuggestions;
  index: number;
  onSelect: (index: number) => void;
  onBack: () => void;
  onParameters: () => void;
}) {
  const router = useRouter();
  const { save } = useTourSuggestions();
  const { canPerformWrites } = useAuth();
  const { data: points = [] } = usePointsOfInterestQuery();
  const route = suggestions.results[index];
  const savedId = route ? suggestions.savedTourIds[route.id] : undefined;
  if (!route) return null;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f5f3ee" }}>
      <View
        style={{ flex: 1, maxWidth: 720, width: "100%", alignSelf: "center" }}
      >
        <View
          style={{
            height: 52,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 4,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Vorheriger Schritt"
            onPress={onBack}
            style={{
              width: 48,
              height: 48,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="chevron-left" size={24} color="#2e6b4b" />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#1e2a1e" }}>
            {(route.groupSize ?? 1) > 1
              ? "Eure nächste Runde"
              : "Deine nächste Runde"}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tourenautomatik schließen"
            onPress={() => router.replace("/tours" as never)}
            style={{
              width: 48,
              height: 48,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="x" size={22} color="#1e2a1e" />
          </Pressable>
        </View>
        <TourExperience
          route={route}
          points={points}
          index={index}
          total={suggestions.results.length}
          onSelect={(value) => {
            save.reset();
            onSelect(value);
          }}
          description={`${suggestions.searchLimited ? "Die Suche wurde begrenzt. Weitere passende Touren sind möglich. " : ""}Zeit und Strecke sind Schätzwerte. Anreise und Pausen bitte zusätzlich einplanen.`}
          primaryLabel={
            savedId
              ? "Gespeichert · Bearbeiten"
              : save.isPending
                ? "Wird gespeichert …"
                : "Als Tour speichern"
          }
          busy={save.isPending}
          disabled={!savedId && !canPerformWrites}
          error={
            save.error
              ? "Die Tour konnte nicht gespeichert werden. Bitte versuche es erneut."
              : undefined
          }
          notification={savedId ? "In „Meine Touren“ gespeichert" : undefined}
          onParameters={onParameters}
          onPrimary={() => {
            if (savedId) {
              router.push({
                pathname: "/tours/[id]",
                params: { id: savedId, edit: "1" },
              } as never);
              return;
            }
            void save
              .mutateAsync({
                route,
                name: routeName(route, points, index),
                sessionId: suggestions.sessionId,
              })
              .catch(() => {});
          }}
        />
      </View>
    </SafeAreaView>
  );
}
