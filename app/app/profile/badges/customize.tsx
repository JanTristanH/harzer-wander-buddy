import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AuthGuard } from '@/components/auth-guard';
import { BadgeTitle } from '@/components/badge-title';
import { BadgeArtwork } from '@/components/badge-artwork';
import {
  BadgeButton,
  BadgeLoadState,
  BadgePage,
  badgeStyles as s,
} from '@/components/badge-ui';
import { saveBadgeProfile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useBadgeAlbum } from '@/lib/badges';
import { badgeTitle, type BadgeSelection } from '@/lib/badge-types';
import { useAuthorizedRequest } from '@/lib/queries';
import { requireOnlineForWrite } from '@/lib/offline-write';

function Customize() {
  const { data, error, refetch } = useBadgeAlbum();
  const { badge } = useLocalSearchParams<{
    badge?: string;
    section?: string;
  }>();
  const { currentUserProfile, canPerformWrites, isOffline } = useAuth();
  const router = useRouter();
  const request = useAuthorizedRequest();
  const client = useQueryClient();
  const [selection, setSelection] = useState<BadgeSelection | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!data || selection) return;
    const featured = [...data.selection.featured];
    if (
      badge &&
      data.entries.some((e) => e.id === badge && e.unlocked) &&
      !featured.includes(badge) &&
      featured.length < 3
    )
      featured.push(badge);
    setSelection({ ...data.selection, featured });
  }, [data, selection, badge]);
  const unlocked = data?.entries.filter((e) => e.unlocked) ?? [];
  const preview = data && selection ? { ...data, selection } : undefined;
  const update = (value: Partial<BadgeSelection>) =>
    setSelection((current) => (current ? { ...current, ...value } : current));
  function toggle(id: string) {
    if (!selection) return;
    if (selection.featured.includes(id))
      update({ featured: selection.featured.filter((value) => value !== id) });
    else if (selection.featured.length < 3)
      update({ featured: [...selection.featured, id] });
    else
      setMessage(
        'Du kannst bis zu drei Abzeichen hervorheben. Entferne zuerst eines aus deiner Auswahl.'
      );
  }
  function move(index: number, direction: number) {
    if (!selection) return;
    const next = [...selection.featured];
    [next[index], next[index + direction]] = [
      next[index + direction],
      next[index],
    ];
    update({ featured: next });
  }
  async function save() {
    if (!selection) return;
    setSaving(true);
    setMessage('');
    try {
      requireOnlineForWrite(canPerformWrites);
      const result = await request((token) =>
        saveBadgeProfile(token, selection)
      );
      await client.invalidateQueries({ queryKey: ['badgeAlbum'] });
      setSelection(result.selection);
      router.replace('/(tabs)/profile');
    } catch (nextError) {
      setMessage(
        nextError instanceof Error
          ? nextError.message
          : 'Die Auswahl konnte nicht gespeichert werden.'
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <BadgePage
      title="Profil gestalten"
      footer={
        data && selection ? (
          <>
            {message ? (
              <Text accessibilityRole="alert" style={[s.text, s.notice]}>
                {message}
              </Text>
            ) : null}
            <BadgeButton
              disabled={saving || isOffline}
              onPress={() => void save()}
            >
              {saving ? 'Wird gespeichert …' : 'Auswahl speichern'}
            </BadgeButton>
          </>
        ) : undefined
      }
    >
      {!data || !selection ? (
        <BadgeLoadState error={error} retry={() => void refetch()} />
      ) : (
        <>
          {data.selectionChanged ? (
            <Text style={[s.text, s.notice]}>
              Nicht mehr berechtigte Abzeichen, Titel oder Rahmen wurden aus
              deiner aktiven Auswahl entfernt.
            </Text>
          ) : null}
          <View style={[s.card, s.center]}>
            <BadgeArtwork
              frame={data.entries.find((e) => e.id === selection.frame)?.frame}
              image={currentUserProfile?.picture}
              initials={(currentUserProfile?.name || 'Wanderbuddy')
                .slice(0, 2)
                .toUpperCase()}
              size={120}
            />
            <Text style={s.heading}>
              {currentUserProfile?.name || 'Dein Profil'}
            </Text>
            <BadgeTitle title={badgeTitle(preview)} />
            <View style={s.row}>
              {selection.featured.map((id) => {
                const entry = data.entries.find((e) => e.id === id);
                return entry ? (
                  <BadgeArtwork key={id} entry={entry} size={64} />
                ) : null;
              })}
            </View>
          </View>
          <View style={s.card}>
            <Text style={s.heading}>Titel</Text>
            {[
              { id: '', label: 'Kein Titel' },
              { id: 'wanderer', label: 'Wanderer' },
              ...unlocked.flatMap((e) => e.titles),
            ].map((title) => (
              <Pressable
                key={title.id}
                accessibilityRole="radio"
                accessibilityLabel={title.label}
                accessibilityState={{ checked: selection.title === title.id }}
                onPress={() => update({ title: title.id })}
                style={[s.divider, s.row]}
              >
                <Feather
                  name={
                    selection.title === title.id ? 'check-circle' : 'circle'
                  }
                  size={22}
                  color="#2e6b4b"
                />
                <Text style={[s.text, { flex: 1 }]}>{title.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={s.card}>
            <Text style={s.heading}>Avatarrahmen</Text>
            <Text style={s.text}>Unabhängig vom Titel wählbar.</Text>
            <View style={s.row}>
              {[{ id: '', name: 'Ohne', frame: '' }, ...unlocked].map(
                (entry) => (
                  <Pressable
                    key={entry.id}
                    accessibilityRole="radio"
                    accessibilityLabel={`Rahmen ${entry.name}`}
                    accessibilityState={{
                      checked: selection.frame === entry.id,
                    }}
                    onPress={() => update({ frame: entry.id })}
                    style={{
                      width: 90,
                      alignItems: 'center',
                      padding: 5,
                      borderWidth: selection.frame === entry.id ? 2 : 1,
                      borderColor:
                        selection.frame === entry.id ? '#2e6b4b' : '#e8ece6',
                      borderRadius: 14,
                      gap: 5,
                    }}
                  >
                    <BadgeArtwork frame={entry.frame} size={70} />
                    <Text
                      style={[s.text, { fontSize: 12, textAlign: 'center' }]}
                    >
                      {entry.name}
                      {selection.frame === entry.id ? ' ✓' : ''}
                    </Text>
                  </Pressable>
                )
              )}
            </View>
          </View>
          <View style={s.card}>
            <Text style={s.heading}>Abzeichen im Profil</Text>
            <Text style={s.text}>
              Bis zu 3 auswählen und anordnen. Auch eine leere Auswahl ist
              möglich.
            </Text>
            {!unlocked.length ? (
              <Text style={s.text}>
                Deine ersten Abzeichen erscheinen hier, sobald du sie
                freigeschaltet hast.
              </Text>
            ) : null}
            {unlocked.map((entry) => (
              <Pressable
                key={entry.id}
                accessibilityRole="checkbox"
                accessibilityLabel={entry.name}
                accessibilityState={{
                  checked: selection.featured.includes(entry.id),
                }}
                onPress={() => toggle(entry.id)}
                style={[s.row, s.divider]}
              >
                <BadgeArtwork entry={entry} size={64} />
                <Text style={[s.text, { flex: 1 }]}>{entry.name}</Text>
                <Feather
                  name={
                    selection.featured.includes(entry.id)
                      ? 'check-square'
                      : 'square'
                  }
                  size={22}
                  color="#2e6b4b"
                />
              </Pressable>
            ))}
            {selection.featured.length ? (
              <Text style={s.heading}>Reihenfolge</Text>
            ) : null}
            {selection.featured.map((id, index) => (
              <View key={id} style={s.row}>
                <Text style={[s.text, { flex: 1 }]}>
                  {index + 1}. {data.entries.find((e) => e.id === id)?.name}
                </Text>
                <Pressable
                  disabled={index === 0}
                  accessibilityRole="button"
                  accessibilityLabel="Nach oben verschieben"
                  accessibilityState={{ disabled: index === 0 }}
                  onPress={() => move(index, -1)}
                  style={{ padding: 12, opacity: index === 0 ? 0.3 : 1 }}
                >
                  <Feather name="arrow-up" size={20} color="#2e6b4b" />
                </Pressable>
                <Pressable
                  disabled={index === selection.featured.length - 1}
                  accessibilityRole="button"
                  accessibilityLabel="Nach unten verschieben"
                  accessibilityState={{
                    disabled: index === selection.featured.length - 1,
                  }}
                  onPress={() => move(index, 1)}
                  style={{
                    padding: 12,
                    opacity: index === selection.featured.length - 1 ? 0.3 : 1,
                  }}
                >
                  <Feather name="arrow-down" size={20} color="#2e6b4b" />
                </Pressable>
              </View>
            ))}
          </View>
        </>
      )}
    </BadgePage>
  );
}
export default function CustomizeBadgesScreen() {
  return (
    <AuthGuard>
      <Customize />
    </AuthGuard>
  );
}
