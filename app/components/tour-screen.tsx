import React, { useState } from "react";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Linking, Share, Modal, Pressable, Text, View } from "react-native";
import {
  buildGoogleMapsDirectionsUrl,
  buildTourShareUrl,
} from "@/lib/tour-links";
import { SafeAreaView } from "react-native-safe-area-context";
import { GroupSelector } from "@/components/group-selector";
import { SignInRequiredScreen } from "@/components/auth-locked-state";
import { TourExperience } from "@/components/tour-experience";
import {
  useTourDetailQuery,
  usePointsOfInterestQuery,
  useDeleteTourMutation,
} from "@/lib/queries";
import { useAuth, useIdTokenClaims } from "@/lib/auth";
import { useHikingGroup } from "@/lib/hiking-group";
import { routeStops } from "@/lib/tour-automation";
import type { HikingRouteResult } from "@/lib/api";
export default function TourScreen({ Editor }: { Editor: React.ComponentType }) {
  const params = useLocalSearchParams<{ id?: string; edit?: string }>();
  return params.edit === "1" || params.edit === "true" ? (
    <Editor />
  ) : (
    <SavedTour id={String(params.id ?? "")} />
  );
}
function SavedTour({ id }: { id: string }) {
  const router = useRouter();
  const { isAuthenticated, canPerformWrites } = useAuth();
  const sub = useIdTokenClaims<{ sub?: string }>()?.sub;
  const group = useHikingGroup();
  const { data, error } = useTourDetailQuery(id, {
    groupUserIds: group.groupUserIds,
  });
  const { data: points = [] } = usePointsOfInterestQuery();
  const remove = useDeleteTourMutation(id);
  const [menu, setMenu] = useState(false),
    [confirm, setConfirm] = useState(false),
    [notice, setNotice] = useState("");
  if (!isAuthenticated)
    return (
      <SignInRequiredScreen
        title="Tour ansehen"
        body="Melde dich an, um diese Tour anzusehen."
        onSignIn={() => router.push("/login" as never)}
      />
    );
  if (!data)
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          padding: 24,
          backgroundColor: "#f5f3ee",
        }}
      >
        <Text>{error ? "Tour nicht gefunden." : "Tour wird geladen …"}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace("/tours" as never)}
        >
          <Text>Zurück zu Touren</Text>
        </Pressable>
      </View>
    );
  const t = data.tour;
  const route: HikingRouteResult = {
    id: t.ID,
    path: data.path,
    stampCount: t.stampCount,
    newStampCountForUser: t.newStampCountForUser,
    distance: t.distance,
    duration: t.duration,
    groupSize: group.groupUserIds.length || 1,
    averageGroupStampings: t.averageGroupStampings,
    idListTravelTimes: t.idListTravelTimes,
    matchingStampCount: t.newStampCountForUser ?? 0,
    totalElevationGain: t.totalElevationGain,
    totalElevationLoss: t.totalElevationLoss,
  };
  const own = Boolean(sub && t.createdBy === sub);
  const locations = routeStops(route, points)
    .filter(
      (p) => typeof p.latitude === "number" && typeof p.longitude === "number",
    )
    .map((p) => `${p.latitude},${p.longitude}`);
  const url = buildGoogleMapsDirectionsUrl(locations);
  const navigate = () => {
    if (url)
      void Linking.openURL(url).catch(() =>
        setNotice("Die Navigation konnte nicht geöffnet werden."),
      );
  };
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
            paddingHorizontal: 4,
            gap: 4,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Zurück zu Touren"
            onPress={() => router.replace("/tours" as never)}
            style={{
              width: 44,
              height: 48,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="chevron-left" size={24} color="#2e6b4b" />
          </Pressable>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: "#1e2a1e",
              flex: 1,
            }}
          >
            Deine Tour
          </Text>
          <GroupSelector />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Touraktionen"
            onPress={() => {
              setConfirm(false);
              setMenu(true);
            }}
            style={{
              width: 40,
              height: 48,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="more-horizontal" size={22} color="#2e6b4b" />
          </Pressable>
        </View>
        <TourExperience
          route={route}
          points={points}
          title={t.name}
          disabled={own && !canPerformWrites}
          primaryLabel={
            own
              ? "Tour bearbeiten"
              : url
                ? "Ganze Tour starten"
                : "Zurück zu Touren"
          }
          notification={notice}
          error={
            remove.error ? "Die Tour konnte nicht gelöscht werden." : undefined
          }
          secondaryLabel={own && url ? "Ganze Tour starten" : undefined}
          onSecondary={own && url ? navigate : undefined}
          onPrimary={() =>
            own
              ? router.setParams({ edit: "1" })
              : url
                ? navigate()
                : router.replace("/tours" as never)
          }
        />
        <Modal
          transparent
          visible={menu}
          animationType="fade"
          onRequestClose={() => {
            setMenu(false);
            setConfirm(false);
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(20,35,24,.35)",
              justifyContent: "center",
              alignItems: "center",
              padding: 24,
            }}
          >
            <View
              accessibilityViewIsModal
              style={{
                backgroundColor: "#fff",
                padding: 24,
                borderRadius: 24,
                width: "100%",
                maxWidth: 350,
                gap: 12,
              }}
            >
              <Text
                style={{ fontSize: 21, fontWeight: "700", color: "#1e2a1e" }}
              >
                {confirm ? "Tour löschen?" : "Touraktionen"}
              </Text>
              {confirm ? (
                <>
                  <Text style={{ lineHeight: 22, color: "#596553" }}>
                    „{t.name}“ wird aus deinen gespeicherten Touren entfernt.
                  </Text>
                  <Action
                    label={
                      remove.isPending
                        ? "Wird gelöscht …"
                        : "Tour endgültig löschen"
                    }
                    danger
                    disabled={remove.isPending}
                    onPress={() => {
                      void remove
                        .mutateAsync()
                        .then(() => router.replace("/tours" as never))
                        .catch(() => {
                          setMenu(false);
                        });
                    }}
                  />
                </>
              ) : (
                <>
                  {own && canPerformWrites && (
                    <Action
                      label="Tour bearbeiten"
                      onPress={() => {
                        setMenu(false);
                        router.setParams({ edit: "1" });
                      }}
                    />
                  )}
                  <Action
                    label="Tour teilen"
                    onPress={() => {
                      setMenu(false);
                      const url = buildTourShareUrl(id, t.name);
                      void Share.share({
                        title: t.name,
                        message: `${t.name}\n${url}`,
                        url,
                      }).catch(() =>
                        setNotice("Die Tour konnte nicht geteilt werden."),
                      );
                    }}
                  />
                  {own && canPerformWrites && (
                    <Action
                      label="Tour löschen"
                      danger
                      onPress={() => setConfirm(true)}
                    />
                  )}
                </>
              )}
              <Action
                label="Abbrechen"
                onPress={() => {
                  setMenu(false);
                  setConfirm(false);
                }}
              />
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}
function Action({
  label,
  onPress,
  danger,
  disabled,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 8 }}
    >
      <Text
        style={{
          fontSize: 16,
          color: danger ? "#a63d2f" : "#2e6b4b",
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
