import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SignInRequiredScreen } from '@/components/auth-locked-state';
import {
  PlannerButton,
  TourProposal,
  ui,
  usePlannerColors,
} from '@/components/tour-planner-ui';
import { useAuth } from '@/lib/auth';
import { usePointsOfInterestQuery } from '@/lib/queries';
import { routeName, routeStops } from '@/lib/tour-automation';
import { useTourSuggestions } from '@/lib/tour-suggestions';

export default function TourProposalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ session?: string; index?: string }>();
  const { isAuthenticated, canPerformWrites } = useAuth();
  const colors = usePlannerColors();
  const { suggestions, save } = useTourSuggestions();
  const { data: points = [], error: pointsError } = usePointsOfInterestQuery();
  const [names, setNames] = useState<Record<string, string>>({});
  const index = Number(params.index ?? 0);
  const route =
    suggestions &&
    params.session === suggestions.sessionId &&
    Number.isInteger(index) &&
    index >= 0
      ? suggestions.results[index]
      : undefined;
  const savedId = route ? suggestions?.savedTourIds[route.id] : undefined;
  const name = route
    ? (names[route.id] ?? routeName(route, points, index))
    : '';
  const stops = route ? routeStops(route, points) : [];
  const saveRoute = async () => {
    if (!route || !suggestions || !name.trim()) return;
    try {
      await save.mutateAsync({
        route,
        name: name.trim(),
        sessionId: suggestions.sessionId,
      });
    } catch {
      /* Show the recoverable error inline, keeping the current proposal. */
    }
  };
  if (!isAuthenticated)
    return (
      <SignInRequiredScreen
        title="Tourvorschlag"
        body="Melde dich an, um deine Tourvorschläge anzusehen."
        onSignIn={() => router.push('/login' as never)}
      />
    );
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <View style={styles.nav}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Zurück zu den Vorschlägen"
              onPress={() => router.back()}
              style={ui.iconButton}>
              <Feather name="chevron-left" color={colors.accent} size={24} />
            </Pressable>
            <Text
              accessibilityRole="header"
              style={[styles.navTitle, { color: colors.text }]}>
              Tourvorschau
            </Text>
            <View style={ui.iconButton} />
          </View>
          {!route || !suggestions ? (
            <View style={styles.empty}>
              <Text style={[ui.title, { color: colors.text }]}>
                Vorschlag nicht mehr verfügbar
              </Text>
              <Text style={[ui.body, { color: colors.secondary }]}>
                Öffne deine aktuellen Buddy-Empfehlungen oder berechne eine neue
                Runde.
              </Text>
              <PlannerButton
                title="Touren finden"
                onPress={() => router.replace('/tours/automatic' as never)}
              />
            </View>
          ) : (
            <>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.scroll}>
                <TourProposal
                  route={route}
                  points={points}
                  index={index}
                  total={suggestions.results.length}
                  groupMode={suggestions.parameters.groupMode}
                  onSelect={(value) => {
                    router.setParams({ index: String(value) });
                    save.reset();
                  }}
                />
                <View style={styles.content}>
                  <View
                    style={[styles.panel, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.label, { color: colors.text }]}>
                      Tourname
                    </Text>
                    <TextInput
                      accessibilityLabel="Tourname für den Vorschlag"
                      editable={!savedId && !save.isPending}
                      value={name}
                      onChangeText={(value) =>
                        setNames((previous) => ({
                          ...previous,
                          [route.id]: value,
                        }))
                      }
                      maxLength={180}
                      style={[
                        styles.input,
                        { color: colors.text, borderColor: colors.border },
                      ]}
                    />
                    <Text style={[ui.body, { color: colors.secondary }]}>
                      {savedId
                        ? 'Die Tour ist gespeichert. Über „Bearbeiten“ kannst du sie weiter anpassen.'
                        : 'Du kannst den Namen vor dem Speichern anpassen.'}
                    </Text>
                  </View>
                  <View
                    style={[styles.panel, { backgroundColor: colors.surface }]}>
                    <Text
                      accessibilityRole="header"
                      style={[styles.label, { color: colors.text }]}>
                      Stationen und Rückweg
                    </Text>
                    {stops.map((point, n) => (
                      <Pressable
                        key={`${point.ID}-${n}`}
                        accessibilityRole="button"
                        accessibilityLabel={`${n === 0 ? 'Start' : n === stops.length - 1 ? 'Ziel' : 'Station'}, ${point.name}`}
                        onPress={() =>
                          router.push(
                            `/${point.poiType === 'parking' ? 'parking' : 'stamps'}/${point.ID}` as never
                          )
                        }
                        style={[styles.stop, { borderColor: colors.border }]}>
                        <View
                          style={[
                            styles.number,
                            { backgroundColor: colors.soft },
                          ]}>
                          <Text
                            style={{ color: colors.accent, fontWeight: '700' }}>
                            {point.poiType === 'parking'
                              ? 'P'
                              : point.stampNumber || n}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[ui.body, { color: colors.text }]}>
                            {point.name}
                          </Text>
                          <Text
                            style={[
                              styles.caption,
                              { color: colors.secondary },
                            ]}>
                            {n === 0
                              ? 'Startpunkt'
                              : n === stops.length - 1
                                ? 'Zurück am Parkplatz'
                                : point.poiType === 'parking'
                                  ? 'Parkplatz'
                                  : 'Stempelstelle'}
                          </Text>
                        </View>
                        <Feather
                          name="chevron-right"
                          color={colors.accent}
                          size={18}
                        />
                      </Pressable>
                    ))}
                    {!stops.length ? (
                      <Text style={[ui.body, { color: colors.secondary }]}>
                        {pointsError
                          ? 'Stationen konnten nicht geladen werden. Der Kartenverlauf bleibt verfügbar.'
                          : 'Stationen werden geladen …'}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[ui.body, { color: colors.secondary }]}>
                    Zeit und Strecke sind Schätzwerte. Pausen und die Anreise
                    zum ersten Parkplatz kommen dazu. Prüfe die Bedingungen vor
                    Ort.
                  </Text>
                  {savedId ? (
                    <Text
                      accessibilityLiveRegion="polite"
                      style={[ui.body, { color: colors.accent }]}>
                      Gespeichert in „Meine Touren“. Du kannst alle weiteren
                      Vorschläge ebenfalls speichern.
                    </Text>
                  ) : null}
                  {save.error ? (
                    <Text accessibilityRole="alert" style={styles.error}>
                      Die Tour konnte nicht gespeichert werden. Bitte versuche
                      es erneut.
                    </Text>
                  ) : null}
                </View>
              </ScrollView>
              <View
                style={[styles.footer, { backgroundColor: colors.background }]}>
                <PlannerButton
                  title={
                    savedId
                      ? 'Gespeichert · Bearbeiten'
                      : save.isPending
                        ? 'Wird gespeichert …'
                        : 'Als Tour speichern'
                  }
                  disabled={
                    save.isPending ||
                    (!savedId && (!canPerformWrites || !name.trim()))
                  }
                  onPress={() =>
                    savedId
                      ? router.push({
                          pathname: '/tours/[id]',
                          params: { id: savedId, edit: '1' },
                        } as never)
                      : void saveRoute()
                  }
                />
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  navTitle: { fontSize: 17, fontWeight: '600' },
  scroll: { paddingBottom: 24 },
  content: { paddingHorizontal: 24, paddingTop: 4, gap: 20 },
  panel: { padding: 18, borderRadius: 18, gap: 14 },
  label: { fontSize: 18, fontWeight: '700' },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 17,
  },
  stop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 58,
  },
  number: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  caption: { fontSize: 13 },
  footer: { paddingHorizontal: 24, paddingVertical: 12 },
  empty: { padding: 24, gap: 18 },
  error: { color: '#ac3427', fontSize: 15, lineHeight: 23 },
});
