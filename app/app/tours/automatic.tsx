import { Feather, MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GroupSelector } from '@/components/group-selector';
import { FriendAvatar } from '@/components/friends-list';
import { SignInRequiredScreen } from '@/components/auth-locked-state';
import {
  PlannerButton,
  PlannerStepper,
  TourProposal,
  ui,
  usePlannerColors,
} from '@/components/tour-planner-ui';
import { useAuth } from '@/lib/auth';
import { useHikingGroup } from '@/lib/hiking-group';
import { usePointsOfInterestQuery } from '@/lib/queries';
import { routeName, validateTimeBudget } from '@/lib/tour-automation';
import { useTourSuggestions } from '@/lib/tour-suggestions';

type Start = { latitude: number; longitude: number; name: string };

export default function AutomaticTourScreen() {
  const router = useRouter();
  const colors = usePlannerColors();
  const { isAuthenticated, canPerformWrites, isOffline } = useAuth();
  const group = useHikingGroup();
  const { data: points = [], isPending: pointsPending } =
    usePointsOfInterestQuery();
  const { suggestions, generation, save } = useTourSuggestions();
  const [step, setStep] = useState(1);
  const [minutes, setMinutes] = useState('120');
  const [customTime, setCustomTime] = useState(false);
  const [start, setStart] = useState<Start | null>(null);
  const [startSearch, setStartSearch] = useState('');
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [audience, setAudience] = useState<'solo' | 'group' | null>(null);
  const [groupMode, setGroupMode] = useState<'missing_all' | 'missing_any'>(
    'missing_any'
  );
  const [advanced, setAdvanced] = useState(false);
  const [maxKm, setMaxKm] = useState('20');
  const [minStamps, setMinStamps] = useState(1);
  const [allowDrive, setAllowDrive] = useState(false);
  const [index, setIndex] = useState(0);
  const [savedName, setSavedName] = useState<string | null>(null);
  // Read the active group when step 2 is first entered, after friend loading.
  // An explicit solo selection stays solo even if the global group changes.
  useEffect(() => {
    if (step === 2 && audience === null && !group.isLoading)
      setAudience(group.selectedFriendIds.length ? 'group' : 'solo');
  }, [audience, group.isLoading, group.selectedFriendIds.length, step]);

  const validBudget = validateTimeBudget(minutes);
  const validDistance =
    Number.isFinite(Number(maxKm.replace(',', '.'))) &&
    Number(maxKm.replace(',', '.')) > 0 &&
    Number(maxKm.replace(',', '.')) <= 200;
  const results = suggestions?.results ?? [];
  const current = results[index];
  const parking = points
    .filter(
      (point) =>
        point.poiType === 'parking' &&
        point.latitude !== undefined &&
        point.longitude !== undefined &&
        startSearch.trim().length > 0 &&
        point.name
          .toLocaleLowerCase('de')
          .includes(startSearch.trim().toLocaleLowerCase('de'))
    )
    .slice(0, 6);
  const locate = async () => {
    setLocating(true);
    setLocationError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationError(
          'Standortzugriff ist ausgeschaltet. Du kannst stattdessen einen Parkplatz suchen.'
        );
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setStart({ ...position.coords, name: 'Mein Standort' });
      setStartSearch('');
    } catch {
      setLocationError(
        'Dein Standort konnte nicht ermittelt werden. Versuche es erneut oder suche einen Parkplatz.'
      );
    } finally {
      setLocating(false);
    }
  };
  const generate = async () => {
    if (
      !start ||
      !validBudget ||
      !validDistance ||
      audience === null ||
      (audience === 'group' && group.selectedFriendIds.length === 0)
    )
      return;
    try {
      await generation.mutateAsync({
        maxDepth: 16,
        maxDuration: Number(minutes) * 60,
        maxDistance: Math.round(Number(maxKm.replace(',', '.')) * 1000),
        minStampCount: minStamps,
        allowDriveInRoute: allowDrive,
        latitudeStart: String(start.latitude),
        longitudeStart: String(start.longitude),
        groupFilterStampings:
          audience === 'group' ? group.selectedFriendIds.join(',') : '',
        groupMode,
      });
      setIndex(0);
      setStep(3);
      save.reset();
    } catch {
      /* The error is rendered next to the action; parameters stay intact. */
    }
  };
  const saveCurrent = async () => {
    if (!current || !suggestions) return;
    try {
      await save.mutateAsync({
        route: current,
        name: routeName(current, points, index),
        sessionId: suggestions.sessionId,
      });
      setSavedName(routeName(current, points, index));
    } catch {
      /* Inline retry remains available. */
    }
  };
  const savedId = current ? suggestions?.savedTourIds[current.id] : undefined;
  const bodyStyle = { color: colors.secondary };
  const panel = { backgroundColor: colors.surface, borderColor: colors.border };
  if (!isAuthenticated)
    return (
      <SignInRequiredScreen
        title="Deine nächste Stempelrunde"
        body="Melde dich an, um passende Touren für dich oder deine Wandergruppe zu finden."
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
              accessibilityLabel={
                step > 1 ? 'Vorheriger Schritt' : 'Zurück zu Touren'
              }
              disabled={generation.isPending}
              onPress={() => (step > 1 ? setStep(step - 1) : router.back())}
              style={ui.iconButton}>
              <Feather name="chevron-left" size={24} color={colors.accent} />
            </Pressable>
            <Text style={[styles.premium, { color: colors.secondary }]}>
              <MaterialIcons name="auto-awesome" size={14} /> TOURENAUTOMATIK
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tourenautomatik schließen"
              onPress={() => router.back()}
              style={ui.iconButton}>
              <Feather name="x" size={22} color={colors.text} />
            </Pressable>
          </View>
          <PlannerStepper
            step={step}
            onStepPress={generation.isPending ? undefined : setStep}
          />
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {step === 1 ? (
              <View style={styles.content}>
                <Text style={[styles.heading, { color: colors.text }]}>
                  Wie viel Zeit hast du?
                </Text>
                <Text style={[styles.body, bodyStyle]}>
                  Wir finden neue Stempel auf deinem Weg.
                </Text>
                <View style={styles.clockWrap}>
                  <View
                    accessible
                    accessibilityLabel={`Zeitbudget: ${minutes} Minuten`}
                    style={[
                      styles.clock,
                      {
                        borderColor: colors.border,
                        borderTopColor: colors.accent,
                        borderRightColor: colors.accent,
                      },
                    ]}>
                    <View
                      style={[
                        styles.hiker,
                        { backgroundColor: colors.button },
                      ]}>
                      <MaterialIcons name="hiking" size={28} color="#ffffff" />
                    </View>
                    <Text style={[styles.clockValue, { color: colors.text }]}>
                      {validBudget
                        ? Number(minutes) % 60 === 0
                          ? `${Number(minutes) / 60} Std.`
                          : `${minutes} Min.`
                        : '– Min.'}
                    </Text>
                    <Text style={[styles.clockCaption, bodyStyle]}>
                      dein Zeitbudget
                    </Text>
                  </View>
                </View>
                <View style={styles.timeOptions}>
                  {[60, 120, 180].map((value) => (
                    <Pressable
                      key={value}
                      accessibilityRole="button"
                      accessibilityState={{
                        selected: !customTime && minutes === String(value),
                      }}
                      onPress={() => {
                        setMinutes(String(value));
                        setCustomTime(false);
                      }}
                      style={[
                        styles.timeChip,
                        {
                          backgroundColor:
                            !customTime && minutes === String(value)
                              ? colors.button
                              : colors.surface,
                        },
                      ]}>
                      <Text
                        style={{
                          fontSize: 15,
                          color:
                            !customTime && minutes === String(value)
                              ? '#ffffff'
                              : colors.text,
                        }}>
                        {value / 60} Std.
                      </Text>
                    </Pressable>
                  ))}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: customTime }}
                    onPress={() => setCustomTime(true)}
                    style={[
                      styles.timeChip,
                      {
                        backgroundColor: customTime
                          ? colors.button
                          : colors.surface,
                      },
                    ]}>
                    <Text
                      style={{
                        fontSize: 15,
                        color: customTime ? '#ffffff' : colors.text,
                      }}>
                      Eigene
                    </Text>
                  </Pressable>
                </View>
                {customTime ? (
                  <View>
                    <Text style={[styles.label, { color: colors.text }]}>
                      Zeitbudget in Minuten
                    </Text>
                    <TextInput
                      accessibilityLabel="Zeitbudget in Minuten"
                      keyboardType="number-pad"
                      value={minutes}
                      onChangeText={setMinutes}
                      style={[styles.input, panel, { color: colors.text }]}
                    />
                    {!validBudget ? (
                      <Text style={styles.error}>
                        Bitte gib 15 bis 720 Minuten ein.
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                <Text style={[styles.note, bodyStyle]}>
                  {allowDrive
                    ? 'Wanderzeit und Fahrten zwischen Parkplätzen, inklusive Rückweg.'
                    : 'Wanderzeit ab Parkplatz, inklusive Rückweg.'}{' '}
                  Anreise und Pausen bitte zusätzlich einplanen.
                </Text>
                <View style={[styles.panel, panel]}>
                  <Text style={[styles.label, { color: colors.text }]}>
                    Startpunkt
                  </Text>
                  {start ? (
                    <View style={styles.row}>
                      <Feather name="map-pin" color={colors.accent} size={20} />
                      <Text
                        style={[styles.body, { color: colors.text, flex: 1 }]}>
                        {start.name}
                      </Text>
                      <Feather
                        name="check-circle"
                        color={colors.accent}
                        size={20}
                      />
                    </View>
                  ) : null}
                  <PlannerButton
                    title={
                      locating
                        ? 'Standort wird ermittelt …'
                        : 'Meinen Standort verwenden'
                    }
                    onPress={() => void locate()}
                    disabled={locating}
                    secondary
                  />
                  <TextInput
                    accessibilityLabel="Parkplatz suchen"
                    placeholder="Oder Parkplatz suchen"
                    placeholderTextColor={colors.secondary}
                    value={startSearch}
                    onChangeText={setStartSearch}
                    style={[
                      styles.input,
                      { borderColor: colors.border, color: colors.text },
                    ]}
                  />
                  {parking.map((point) => (
                    <Pressable
                      key={point.ID}
                      accessibilityRole="button"
                      onPress={() => {
                        setStart({
                          name: point.name,
                          latitude: point.latitude!,
                          longitude: point.longitude!,
                        });
                        setStartSearch('');
                      }}
                      style={styles.parkingRow}>
                      <Feather name="map-pin" size={18} color={colors.accent} />
                      <Text
                        style={[styles.body, { color: colors.text, flex: 1 }]}>
                        {point.name}
                      </Text>
                    </Pressable>
                  ))}
                  {startSearch.trim() && !parking.length ? (
                    <Text style={[styles.note, bodyStyle]}>
                      {pointsPending
                        ? 'Parkplätze werden geladen …'
                        : 'Kein Parkplatz gefunden. Ändere die Suche oder verwende deinen Standort.'}
                    </Text>
                  ) : null}
                  {locationError ? (
                    <Text accessibilityRole="alert" style={styles.error}>
                      {locationError}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: advanced }}
                  onPress={() => setAdvanced(!advanced)}
                  style={styles.optionsToggle}>
                  <Text style={[styles.body, { color: colors.accent }]}>
                    Weitere Optionen
                  </Text>
                  <Feather
                    name={advanced ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.accent}
                  />
                </Pressable>
                {advanced ? (
                  <View style={[styles.panel, panel]}>
                    <Text style={[styles.label, { color: colors.text }]}>
                      Maximale Gehstrecke in km
                    </Text>
                    <TextInput
                      accessibilityLabel="Maximale Gehstrecke in Kilometern"
                      keyboardType="decimal-pad"
                      value={maxKm}
                      onChangeText={setMaxKm}
                      style={[
                        styles.input,
                        { color: colors.text, borderColor: colors.border },
                      ]}
                    />
                    {!validDistance ? (
                      <Text style={styles.error}>
                        Bitte gib eine Strecke größer als 0 bis 200 km ein.
                      </Text>
                    ) : null}
                    <View style={styles.row}>
                      <Text
                        style={[styles.body, { color: colors.text, flex: 1 }]}>
                        Mindestens {minStamps} passende Stempel
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Weniger passende Stempel"
                        onPress={() => setMinStamps(Math.max(1, minStamps - 1))}
                        style={ui.iconButton}>
                        <Feather name="minus" size={20} color={colors.accent} />
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Mehr passende Stempel"
                        onPress={() =>
                          setMinStamps(Math.min(20, minStamps + 1))
                        }
                        style={ui.iconButton}>
                        <Feather name="plus" size={20} color={colors.accent} />
                      </Pressable>
                    </View>
                    <View style={styles.row}>
                      <Text
                        style={[styles.body, { color: colors.text, flex: 1 }]}>
                        Fahrten zwischen Parkplätzen erlauben
                      </Text>
                      <Switch
                        accessibilityLabel="Fahrten zwischen Parkplätzen erlauben"
                        value={allowDrive}
                        onValueChange={setAllowDrive}
                        trackColor={{ true: '#2e6b4b' }}
                      />
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}
            {step === 2 ? (
              <View style={styles.content}>
                <Text style={[styles.heading, { color: colors.text }]}>
                  Für wen planst du?
                </Text>
                <Text style={[styles.body, bodyStyle]}>
                  Allein unterwegs oder gemeinsam neue Stempel sammeln.
                </Text>
                {group.isLoading && audience === null ? (
                  <ActivityIndicator color={colors.accent} />
                ) : null}
                {(['solo', 'group'] as const).map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    aria-checked={audience === value}
                    accessibilityState={{ checked: audience === value }}
                    disabled={generation.isPending}
                    onPress={() => setAudience(value)}
                    style={[
                      styles.choice,
                      {
                        backgroundColor:
                          audience === value ? colors.soft : colors.surface,
                        borderColor:
                          audience === value ? colors.accent : colors.border,
                      },
                    ]}>
                    <Feather
                      name={value === 'solo' ? 'user' : 'users'}
                      size={26}
                      color={colors.accent}
                    />
                    <View style={{ flex: 1, gap: 5 }}>
                      <Text style={[styles.label, { color: colors.text }]}>
                        {value === 'solo' ? 'Nur ich' : 'Mit Gruppe'}
                      </Text>
                      <Text style={[styles.note, bodyStyle]}>
                        {value === 'solo'
                          ? 'Neue Stempel für mich entdecken.'
                          : 'Gemeinsam mit Freunden sammeln.'}
                      </Text>
                    </View>
                    <Feather
                      name={audience === value ? 'check-circle' : 'circle'}
                      size={22}
                      color={colors.accent}
                    />
                  </Pressable>
                ))}
                {audience === 'solo' ? (
                  <View
                    style={[styles.panel, { backgroundColor: colors.soft }]}>
                    <Text style={[styles.label, { color: colors.text }]}>
                      Deine fehlenden Stempel
                    </Text>
                    <Text style={[styles.body, bodyStyle]}>
                      Wir berücksichtigen nur Stempel, die du noch nicht
                      gesammelt hast.
                    </Text>
                  </View>
                ) : null}
                {audience === 'group' ? (
                  <>
                    <View style={[styles.panel, panel]}>
                      <View style={styles.row}>
                        <Text
                          style={[
                            styles.label,
                            { color: colors.text, flex: 1 },
                          ]}>
                          Deine Wandergruppe
                        </Text>
                        <GroupSelector />
                      </View>
                      <View style={[styles.row, { flexWrap: 'wrap' }]}>
                        <Text style={[styles.body, { color: colors.text }]}>
                          Du
                        </Text>
                        {group.selectedMembers.map((member, n) => (
                          <View key={member.id} style={styles.member}>
                            <FriendAvatar
                              name={member.name}
                              image={member.picture}
                              index={n}
                              size={32}
                              radius={16}
                            />
                            <Text style={[styles.note, { color: colors.text }]}>
                              {member.name}
                            </Text>
                          </View>
                        ))}
                      </View>
                      {!group.selectedFriendIds.length ? (
                        <Text style={[styles.note, bodyStyle]}>
                          Wähle mindestens einen Freund aus oder plane mit „Nur
                          ich“.
                        </Text>
                      ) : null}
                    </View>
                    {(['missing_all', 'missing_any'] as const).map((mode) => (
                      <Pressable
                        key={mode}
                        accessibilityRole="radio"
                        aria-checked={groupMode === mode}
                        accessibilityState={{ checked: groupMode === mode }}
                        onPress={() => setGroupMode(mode)}
                        disabled={generation.isPending}
                        style={[
                          styles.choice,
                          {
                            backgroundColor:
                              groupMode === mode ? colors.soft : colors.surface,
                            borderColor:
                              groupMode === mode
                                ? colors.accent
                                : colors.border,
                          },
                        ]}>
                        <Feather
                          name={groupMode === mode ? 'check-circle' : 'circle'}
                          size={22}
                          color={colors.accent}
                        />
                        <View style={{ flex: 1, gap: 5 }}>
                          <Text style={[styles.label, { color: colors.text }]}>
                            {mode === 'missing_all'
                              ? 'Fehlt allen'
                              : 'Fehlt mindestens einer Person'}
                          </Text>
                          <Text style={[styles.note, bodyStyle]}>
                            {mode === 'missing_all'
                              ? 'Für alle in der Gruppe neu.'
                              : 'Jemandem fehlt dieser Stempel noch.'}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </>
                ) : null}
                <Text
                  style={[
                    styles.note,
                    bodyStyle,
                  ]}>{`${minutes} Min. · ${start?.name ?? ''}${audience === 'group' ? ` · ${group.selectedFriendIds.length + 1} Personen` : ' · Nur du'}`}</Text>
                {generation.error ? (
                  <Text accessibilityRole="alert" style={styles.error}>
                    Die Vorschläge konnten nicht berechnet werden. Bitte
                    versuche es erneut. Deine Einstellungen bleiben erhalten.
                  </Text>
                ) : null}
                {generation.isPending ? (
                  <View style={styles.row} accessibilityLiveRegion="polite">
                    <ActivityIndicator color={colors.accent} />
                    <Text style={[styles.body, bodyStyle]}>
                      Passende Stempel und Rückwege werden geprüft …
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
            {step === 3 ? (
              <>
                <View style={styles.content}>
                  <Text style={[styles.heading, { color: colors.text }]}>
                    {(current?.groupSize ?? 1) > 1
                      ? 'Eure nächste Runde'
                      : 'Deine nächste Runde'}
                  </Text>
                  <Text style={[styles.note, bodyStyle]}>
                    {results.length
                      ? `${results.length} Vorschläge · Bis ${suggestions ? Math.round(suggestions.parameters.maxDuration / 60) : minutes} Min.`
                      : 'Für diese Einstellungen wurde keine passende Runde gefunden. Erhöhe das Zeitbudget oder ändere den Startpunkt.'}
                  </Text>
                  {suggestions?.searchLimited ? (
                    <Text style={[styles.note, bodyStyle]}>
                      Die Suche wurde begrenzt. Diese Routen passen zu deinem
                      Budget; weitere passende Touren sind möglich.
                    </Text>
                  ) : null}
                </View>
                {current && suggestions ? (
                  <TourProposal
                    route={current}
                    points={points}
                    index={index}
                    total={results.length}
                    groupMode={suggestions.parameters.groupMode}
                    onSelect={(value) => {
                      setIndex(value);
                      save.reset();
                      setSavedName(null);
                    }}
                    onDetail={() =>
                      router.push({
                        pathname: '/tours/proposal',
                        params: {
                          session: suggestions.sessionId,
                          index: String(index),
                        },
                      } as never)
                    }
                  />
                ) : null}
                {savedName ? (
                  <Text
                    accessibilityLiveRegion="polite"
                    style={[styles.saved, { color: colors.accent }]}>
                    {savedName} wurde in „Meine Touren“ gespeichert. Die anderen
                    Vorschläge bleiben verfügbar.
                  </Text>
                ) : null}
                {save.error ? (
                  <Text
                    accessibilityRole="alert"
                    style={[styles.error, { marginHorizontal: 24 }]}>
                    Die Tour konnte nicht gespeichert werden. Bitte versuche es
                    erneut.
                  </Text>
                ) : null}
              </>
            ) : null}
          </ScrollView>
          <View style={[styles.footer, { backgroundColor: colors.background }]}>
            {isOffline ? (
              <Text style={[styles.note, bodyStyle]}>
                Zum Berechnen und Speichern brauchst du eine Internetverbindung.
              </Text>
            ) : null}
            {step === 1 ? (
              <PlannerButton
                title="Weiter"
                disabled={!validBudget || !validDistance || !start}
                onPress={() => setStep(2)}
              />
            ) : null}
            {step === 2 ? (
              <PlannerButton
                title={
                  generation.isPending
                    ? 'Touren werden gesucht …'
                    : generation.error
                      ? 'Erneut Touren finden'
                      : 'Touren finden'
                }
                disabled={
                  !canPerformWrites ||
                  generation.isPending ||
                  audience === null ||
                  (audience === 'group' && !group.selectedFriendIds.length)
                }
                onPress={() => void generate()}
              />
            ) : null}
            {step === 3 ? (
              <>
                {current ? (
                  <PlannerButton
                    title={
                      savedId
                        ? 'Gespeichert · Bearbeiten'
                        : save.isPending
                          ? 'Wird gespeichert …'
                          : 'Als Tour speichern'
                    }
                    disabled={save.isPending || (!savedId && !canPerformWrites)}
                    onPress={() =>
                      savedId
                        ? router.push({
                            pathname: '/tours/[id]',
                            params: { id: savedId, edit: '1' },
                          } as never)
                        : void saveCurrent()
                    }
                  />
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setStep(1)}
                  style={styles.optionsToggle}>
                  <Text style={[styles.body, { color: colors.accent }]}>
                    Parameter ändern
                  </Text>
                </Pressable>
              </>
            ) : null}
          </View>
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
  premium: { fontSize: 10, letterSpacing: 1.2, fontWeight: '600' },
  scroll: { paddingBottom: 24, gap: 16 },
  content: { paddingHorizontal: 24, gap: 17 },
  heading: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -0.7,
  },
  body: { fontSize: 17, lineHeight: 25 },
  label: { fontSize: 17, fontWeight: '600' },
  note: { fontSize: 14, lineHeight: 21 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  panel: {
    padding: 16,
    borderRadius: 18,
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    minHeight: 48,
    padding: 12,
    fontSize: 17,
    borderWidth: 1,
    borderRadius: 12,
  },
  clockWrap: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  clock: {
    width: 214,
    height: 214,
    borderRadius: 107,
    borderWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  clockValue: {
    fontSize: 36,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  clockCaption: { fontSize: 13 },
  hiker: {
    position: 'absolute',
    top: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  timeChip: {
    flex: 1,
    minWidth: 60,
    minHeight: 46,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  optionsToggle: {
    minHeight: 44,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 15,
    borderWidth: 1.5,
    borderRadius: 18,
    minHeight: 90,
  },
  footer: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12, gap: 8 },
  error: { color: '#ac3427', fontSize: 15, lineHeight: 23 },
  parkingRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  member: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  saved: { paddingHorizontal: 24, fontSize: 15, lineHeight: 23 },
});
