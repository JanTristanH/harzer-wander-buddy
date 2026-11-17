import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SuggestionResults } from "@/components/suggestion-results";
import { PlannerButton } from "@/components/tour-planner-ui";
import { SignInRequiredScreen } from "@/components/auth-locked-state";
import { useAuth } from "@/lib/auth";
import { useTourSuggestions } from "@/lib/tour-suggestions";
export default function TourProposalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ session?: string; index?: string }>();
  const { isAuthenticated } = useAuth();
  const { suggestions } = useTourSuggestions();
  const index = Number(params.index ?? 0);
  if (!isAuthenticated)
    return (
      <SignInRequiredScreen
        title="Tourvorschlag"
        body="Melde dich an, um deine Tourvorschläge anzusehen."
        onSignIn={() => router.push("/login" as never)}
      />
    );
  if (
    !suggestions ||
    params.session !== suggestions.sessionId ||
    !Number.isInteger(index) ||
    index < 0 ||
    !suggestions.results[index]
  )
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f5f3ee" }}>
        <View style={{ padding: 24, gap: 18 }}>
          <Text>Vorschlag nicht mehr verfügbar</Text>
          <PlannerButton
            title="Touren finden"
            onPress={() => router.replace("/tours/automatic" as never)}
          />
        </View>
      </SafeAreaView>
    );
  return (
    <SuggestionResults
      suggestions={suggestions}
      index={index}
      onSelect={(value) => router.setParams({ index: String(value) })}
      onBack={() => router.back()}
      onParameters={() => router.replace("/tours/automatic" as never)}
    />
  );
}
